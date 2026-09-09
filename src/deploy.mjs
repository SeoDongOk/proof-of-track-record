/**
 * 테스트넷 배포.
 *   MN_NETWORK=preview node src/deploy.mjs
 *
 * 선행: wallet-{network}.seed 가 있고 파우셋에서 tNIGHT 를 받아둔 상태.
 * 결과: deployed-{network}.json 에 컨트랙트 주소 기록.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { NetworkId } from '@midnight-ntwrk/zswap';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { Contract } from '../build/track_record/contract/index.js';
import { makeWitnesses, makePrivateState } from './witnesses.mjs';

const NET = process.env.MN_NETWORK ?? 'preview';
const CFG = {
  preview: { indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
             indexerWs: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
             node: 'https://rpc.preview.midnight.network', zswapNet: NetworkId.TestNet },
  preprod: { indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
             indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
             node: 'https://rpc.preprod.midnight.network', zswapNet: NetworkId.TestNet },
  // 로컬 devnet (midnight-local-dev). 파우셋이 필요 없다 — genesis 지갑이 이미 펀딩돼 있다.
  undeployed: { indexer: 'http://127.0.0.1:8088/api/v4/graphql',
                indexerWs: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
                node: 'http://127.0.0.1:9944', zswapNet: NetworkId.Undeployed },
}[NET];

// 로컬 devnet 배포용 시드. midnight-local-dev 의 genesis(...001) 가 이 주소로
// NIGHT 를 보내고 DUST 를 등록해 준다 (fund-ptr.ts). 로컬 체인에서만 유효하다.
const LOCAL_SEED = process.env.PTR_SEED
  ?? '0000000000000000000000000000000000000000000000000000000000000002';
const PROOF = process.env.PROOF_SERVER ?? 'http://127.0.0.1:6300';
const SEED_FILE = `wallet-${NET}.seed`;
const OUT = `deployed-${NET}.json`;

const seed = NET === 'undeployed'
  ? LOCAL_SEED
  : (existsSync(SEED_FILE) ? readFileSync(SEED_FILE, 'utf8').trim() : null);
if (!seed) { console.error(`시드 없음: 먼저 node src/wallet-init.mjs`); process.exit(1); }
setNetworkId(NET);

// ── 지갑 ────────────────────────────────────────────────────────────────────
const wallet = await WalletBuilder.build(
  CFG.indexer, CFG.indexerWs, PROOF, CFG.node, seed, CFG.zswapNet, 'warn');
wallet.start();

console.log(`[${NET}] 지갑 동기화 대기...`);
const state = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('동기화 타임아웃 120s')), 120000);
  const sub = wallet.state().subscribe({
    next: (s) => {
      const p = s.syncProgress;
      const synced = !p || p.synced === true || (p.lag && p.lag.applyGap === 0n && p.lag.sourceGap === 0n);
      if (synced) { clearTimeout(t); sub.unsubscribe(); res(s); }
    },
    error: (e) => { clearTimeout(t); rej(e); },
  });
});
const bal = Object.entries(state.balances ?? {}).map(([k, v]) => `${k.slice(0, 10)}…=${v}`).join(', ') || '(없음)';
console.log(`  주소 ${state.address}`);
console.log(`  잔액 ${bal}`);

const hasFunds = Object.values(state.balances ?? {}).some((v) => v > 0n);
if (!hasFunds) {
  console.log(`\n❌ 잔액이 없어 배포할 수 없습니다.`);
  console.log(NET === 'undeployed'
    ? '   로컬 devnet 이 기동돼 있는지 확인하세요 (docker compose -f standalone.yml up -d)'
    : `   파우셋: https://midnight-tmnight-${NET}.nethermind.dev/`);
  console.log(`   주소  : ${state.address}`);
  await wallet.close(); process.exit(2);
}

// ── 프로바이더 6종 ───────────────────────────────────────────────────────────
const b32 = (n) => { const a = new Uint8Array(32); a[0] = n; return a; };
const witnesses = makeWitnesses();
const compiled = CompiledContract.make('track_record', Contract)
  .pipe(CompiledContract.withWitnesses(witnesses))
  .pipe(CompiledContract.withCompiledFileAssets('build/track_record'));

const providers = {
  privateStateProvider: levelPrivateStateProvider({
    privateStateStoreName: 'ptr-private-state',
    accountId: state.address,
    privateStoragePasswordProvider: async () => 'ptr-testnet-password',
  }),
  publicDataProvider: indexerPublicDataProvider(CFG.indexer, CFG.indexerWs, WebSocket),
  zkConfigProvider: new NodeZkConfigProvider('build/track_record'),
  proofProvider: httpClientProofProvider(PROOF),
  walletProvider: {
    getCoinPublicKey: () => state.coinPublicKey,
    getEncryptionPublicKey: () => state.encryptionPublicKey,
    balanceTx: async (tx) => {
      const r = await wallet.balanceTransaction(tx, []);
      return wallet.proveTransaction(r);
    },
  },
  midnightProvider: { submitTx: (tx) => wallet.submitTransaction(tx) },
};

// ── 배포 ────────────────────────────────────────────────────────────────────
console.log('\n배포 트랜잭션 생성 중 (증명 생성 포함, 수 분 소요)...');
const t0 = Date.now();
const deployed = await deployContract(providers, {
  compiledContract: compiled,
  privateStateId: 'ptr',
  initialPrivateState: makePrivateState(),
});
const addr = deployed.deployTxData.public.contractAddress;
const txId = deployed.deployTxData.public.txId;
console.log(`\n✅ 배포 완료 (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
console.log(`   컨트랙트 주소: ${addr}`);
console.log(`   트랜잭션     : ${txId}`);
writeFileSync(OUT, JSON.stringify({ network: NET, contractAddress: addr, txId, deployedAt: new Date().toISOString() }, null, 2));
console.log(`   기록         : ${OUT}`);
await wallet.close();
