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

const NET = process.env.MN_NETWORK ?? 'preview';
const CFG = {
  preview: { indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
             indexerWs: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
             node: 'https://rpc.preview.midnight.network' },
  preprod: { indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
             indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
             node: 'https://rpc.preprod.midnight.network' },
}[NET];
const PROOF = process.env.PROOF_SERVER ?? 'http://localhost:6300';
const SEED_FILE = `wallet-${NET}.seed`;
const OUT = `deployed-${NET}.json`;

if (!existsSync(SEED_FILE)) { console.error(`시드 없음: 먼저 node src/wallet-init.mjs`); process.exit(1); }
setNetworkId(NET);

// ── 지갑 ────────────────────────────────────────────────────────────────────
const wallet = await WalletBuilder.build(
  CFG.indexer, CFG.indexerWs, PROOF, CFG.node,
  readFileSync(SEED_FILE, 'utf8').trim(), NetworkId.TestNet, 'warn');
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
  console.log(`   파우셋: https://midnight-tmnight-${NET}.nethermind.dev/`);
  console.log(`   주소  : ${state.address}`);
  await wallet.close(); process.exit(2);
}

// ── 프로바이더 6종 ───────────────────────────────────────────────────────────
const b32 = (n) => { const a = new Uint8Array(32); a[0] = n; return a; };
const w = (k) => ({ privateState }) => [privateState, privateState[k]];
const witnesses = {
  strategyParams: w('strategyParams'), strategyOpening: w('strategyOpening'),
  nextTrade: w('nextTrade'), provenTrades: w('provenTrades'), provenPaths: w('provenPaths'),
  portfolioWeights: w('portfolioWeights'), portfolioOpening: w('portfolioOpening'),
};
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
  initialPrivateState: {
    strategyParams: b32(0xAB), strategyOpening: b32(0xCD), nextTrade: null,
    provenTrades: [], provenPaths: [], portfolioWeights: [], portfolioOpening: b32(0xEF),
  },
});
const addr = deployed.deployTxData.public.contractAddress;
const txId = deployed.deployTxData.public.txId;
console.log(`\n✅ 배포 완료 (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
console.log(`   컨트랙트 주소: ${addr}`);
console.log(`   트랜잭션     : ${txId}`);
writeFileSync(OUT, JSON.stringify({ network: NET, contractAddress: addr, txId, deployedAt: new Date().toISOString() }, null, 2));
console.log(`   기록         : ${OUT}`);
await wallet.close();
