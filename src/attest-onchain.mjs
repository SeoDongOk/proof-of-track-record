/**
 * zkTLS 공증 → 실제 온체인 트랜잭션.
 *
 * attestation-live.mjs 는 회로를 로컬에서 실행해 거부/통과만 보여준다.
 * 이 스크립트는 같은 흐름을 devnet 에 실제 트랜잭션으로 올린다.
 *
 *   1. Primus 공증인이 거래소 엔드포인트를 zkTLS 로 읽는다
 *   2. registerAttestor    — 트랜잭션
 *   3. submitAttestation   — 트랜잭션. 커밋만 올라간다
 *   4. proveAttestedNav    — 트랜잭션. ZK 증명 포함, NAV 는 witness
 *   5. 인디서로 원장 상태를 되읽어 확인
 *
 *   nvm use 22 && node src/attest-onchain.mjs
 *   node src/attest-onchain.mjs --binance
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { requireNode } from './require-node.mjs';

requireNode(22);

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const RED = (s) => `\x1b[31m${s}\x1b[0m`, DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const hex = (u8, n = 16) => Buffer.from(u8).toString('hex').slice(0, n);

const NET = process.env.MN_NETWORK ?? 'local';

// ── 자격증명 ─────────────────────────────────────────────────────────────────
const appId = process.env.PRIMUS_APP_ID, appSecret = process.env.PRIMUS_APP_SECRET;
if (!appId || !appSecret) {
  console.error(`\n${RED('✗ PRIMUS_APP_ID / PRIMUS_APP_SECRET 이 없습니다.')}`);
  console.error(DIM('  .env.example 을 .env 로 복사해 채우세요.'));
  console.error(DIM('  https://dev.primuslabs.xyz/myDevelopment/myProjects\n'));
  process.exit(1);
}

const { primusAttestor } = await import('./attestor.mjs');
const { binanceSpot, binanceFutures, publicTicker } = await import('./exchanges.mjs');

const binanceCreds = () => {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET ?? process.env.BINANCE_SECRET_KEY;
  if (!apiKey || !apiSecret) {
    console.error(`\n${RED('✗ BINANCE_API_KEY / BINANCE_API_SECRET 이 없습니다.')}\n`);
    process.exit(1);
  }
  return { apiKey, apiSecret };
};

let adapter;
if (has('--futures')) {
  adapter = binanceFutures({ ...binanceCreds(), field: opt('--field', 'totalMarginBalance') });
} else if (has('--binance')) {
  adapter = binanceSpot(binanceCreds());
} else {
  adapter = publicTicker({ symbol: opt('--symbol', 'BTCUSDT') });
  console.log(DIM('공개 시세로 진행합니다. 실계좌 잔고는 --futures / --binance.\n'));
}

// ── 1) zkTLS 공증 ────────────────────────────────────────────────────────────
console.log(`[1] zkTLS 공증  ${DIM(`(${adapter.name})`)}`);
const salt = new Uint8Array(randomBytes(32));
const attestor = primusAttestor({ appId, appSecret, algorithmType: opt('--mode', 'mpctls') });
const t0 = Date.now();
let att;
try {
  att = await attestor.attest(adapter, { salt });
} catch (e) {
  console.error(`\n${RED('✗ 공증 실패')}: ${e.message}`);
  await attestor.close?.(); process.exit(1);
}
console.log(`    ${att.raw.keyName} = ${att.raw.value}  →  NAV ${att.nav}  ${DIM(`(${((Date.now()-t0)/1000).toFixed(1)}s)`)}`);
for (const a of att.attestation?.attestors ?? []) console.log(`    공증인: ${a.attestorAddr}`);

// ── 체인 연결 ────────────────────────────────────────────────────────────────
const { default: pino } = await import('pino');
const { WebSocket } = await import('ws');
const { LocalTestConfiguration,
        PreviewTestEnvironment, PreprodTestEnvironment } = await import('@midnight-ntwrk/testkit-js');
const { buildWallet, startAndSync } = await import('./wallet.mjs');
const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
const { deployContract, findDeployedContract } = await import('@midnight-ntwrk/midnight-js-contracts');
const { CompiledContract } = await import('@midnight-ntwrk/midnight-js-protocol/compact-js');
const { NodeZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-node-zk-config-provider');
const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');
const { Contract: AttestationContract, ledger } = await import('../build/attestation/contract/index.js');
const { requireLocalDevnet, requireProofServer } = await import('./preflight.mjs');

if (NET === 'local') await requireLocalDevnet('http://127.0.0.1:8088/api/v4/graphql');
await requireProofServer(process.env.PROOF_SERVER ?? 'http://127.0.0.1:6300');

const env = NET === 'preview' ? new PreviewTestEnvironment().getEnvironmentConfiguration()
          : NET === 'preprod' ? new PreprodTestEnvironment().getEnvironmentConfiguration()
          : new LocalTestConfiguration({ indexer: process.env.MN_INDEXER_PORT ?? '8088',
                                          node: process.env.MN_NODE_PORT ?? '9944',
                                          proofServer: process.env.MN_PROOF_PORT ?? '6300' });
// 공개 테스트넷 설정에는 proofServer 가 비어 있다.
env.proofServer ??= process.env.PROOF_SERVER ?? 'http://127.0.0.1:6300';
setNetworkId(env.networkId);

// 수수료 오버헤드가 필요한 이유는 src/wallet.mjs 주석 참고.
const { seedFor } = await import('./address.mjs');
const walletProvider = await buildWallet(
  pino({ level: 'warn' }), env, seedFor(NET),
  BigInt(process.env.PTR_FEE_OVERHEAD ?? '1000000'));
await startAndSync(walletProvider, NET);
console.log(`\n[2] 지갑 동기화  ${DIM(`(${NET}, ${env.networkId})`)}`);

// witness 키 이름은 초기 private state 와 일치해야 한다 (deploy.mjs 와 동일)
const attestWitnesses = {
  navValue: ({ privateState }) => [privateState, privateState.navValue],
  navSalt: ({ privateState }) => [privateState, privateState.navSalt],
};
const compiled = CompiledContract.make('attestation', AttestationContract).pipe(
  CompiledContract.withWitnesses(attestWitnesses),
  CompiledContract.withCompiledFileAssets('build/attestation'),
);

const PSID = 'ptr-attest-live';
const privateStateProvider = levelPrivateStateProvider({
  privateStateStoreName: 'ptr-private-state',
  accountId: 'ptr-local',
  privateStoragePasswordProvider: async () => 'PtrLocalDevnet2026!',
});
// httpClientProofProvider(url, zkConfigProvider) — 두 번째 인자가 필수다.
// 빠뜨리면 내부 getKeyMaterial 이 예외를 삼키고 undefined 를 돌려주어,
// ZK IR 없이 248바이트짜리 요청이 나가고 증명서버가 "bad input" 400 을 준다.
const zkConfigProvider = new NodeZkConfigProvider('build/attestation');
const providers = {
  privateStateProvider,
  publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS, WebSocket),
  zkConfigProvider,
  proofProvider: httpClientProofProvider(env.proofServer, zkConfigProvider),
  walletProvider, midnightProvider: walletProvider,
};

// 공증인이 읽어온 NAV 를 private state 에 넣는다. 이 값이 회로의 witness 가 된다.
const initialPrivateState = { navValue: att.nav, navSalt: att.salt };

// ── 3) 컨트랙트 확보 ─────────────────────────────────────────────────────────
// 컨트랙트는 공증인을 1회만, 계좌당 증언도 1회만 받는다(의도된 설계).
// 그래서 기존 배포를 재사용하되, 이 계좌가 이미 증언되어 있으면 새로 배포한다.
const RECORD = `deployed-attest-${NET}.json`;
let instance = null, address = null;

const eq = (a, b) => a && b && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const usable = async (addr) => {
  try {
    const st = await providers.publicDataProvider.queryContractState(addr);
    if (!st) return null;
    const L = ledger(st.data);
    return {
      registered: L.attestorRegistered,
      // 다른 공증인이 등록된 컨트랙트는 쓸 수 없다. 우리 증언이 아니게 된다.
      sameAttestor: !L.attestorRegistered || eq(L.attestorId, attestor.id()),
      attested: L.attestations.member(att.accountId),
    };
  } catch { return null; }
};

if (existsSync(RECORD)) {
  const prev = JSON.parse(readFileSync(RECORD, 'utf8'));
  const info = await usable(prev.contractAddress);
  if (info && !info.attested && info.sameAttestor) {
    instance = await findDeployedContract(providers, {
      compiledContract: compiled, contractAddress: prev.contractAddress,
      privateStateId: PSID, initialPrivateState,
    });
    address = prev.contractAddress;
    console.log(`[3] 기존 배포 재사용  ${DIM(address.slice(0, 24) + '…')}`);
  } else if (info && !info.sameAttestor) {
    console.log(DIM(`[3] 기존 컨트랙트에 다른 공증인이 등록되어 있어 새로 배포합니다.`));
  } else if (info?.attested) {
    console.log(DIM(`[3] 이 계좌는 기존 컨트랙트에 이미 증언되어 있어 새로 배포합니다.`));
  } else {
    console.log(DIM(`[3] 기존 주소를 인디서에서 찾지 못해 새로 배포합니다.`));
  }
}
if (!instance) {
  console.log('[3] attestation 컨트랙트 배포 중 (증명 포함, 수십 초)...');
  const t = Date.now();
  const d = await deployContract(providers, {
    compiledContract: compiled, privateStateId: PSID, initialPrivateState,
  });
  address = d.deployTxData.public.contractAddress;
  instance = d;
  writeFileSync(RECORD, JSON.stringify({ network: NET, contractAddress: address,
    blockHeight: d.deployTxData.public.blockHeight ?? null,
    deployedAt: new Date().toISOString() }, null, 2));
  console.log(`    배포 완료  ${address.slice(0, 24)}…  블록 ${d.deployTxData.public.blockHeight ?? '?'}  ${DIM(`${((Date.now()-t)/1000).toFixed(0)}s`)}`);
}

// ── 4) 트랜잭션 ──────────────────────────────────────────────────────────────
const txInfo = (r) => {
  const p = r?.public ?? r?.txData?.public ?? {};
  return { tx: p.txId ?? p.txHash ?? '(n/a)', block: p.blockHeight ?? '?' };
};
const send = async (label, fn) => {
  const t = Date.now();
  process.stdout.write(`    ${label} … `);
  const r = await fn();
  const { tx, block } = txInfo(r);
  console.log(`블록 ${block}  ${DIM(`${((Date.now()-t)/1000).toFixed(0)}s  tx ${String(tx).slice(0,20)}…`)}`);
  return r;
};

console.log(`\n[4] 온체인 트랜잭션`);
const pre = ledger((await providers.publicDataProvider.queryContractState(address)).data);
if (!pre.attestorRegistered) {
  await send('registerAttestor ', () => instance.callTx.registerAttestor(attestor.id()));
} else {
  console.log(`    registerAttestor  … ${DIM('이미 등록됨, 건너뜀')}`);
}
await send('submitAttestation', () => instance.callTx.submitAttestation(att.accountId, att.navCommitment));
await send('proveAttestedNav ', () => instance.callTx.proveAttestedNav(att.accountId));

// ── 5) 원장 되읽기 ───────────────────────────────────────────────────────────
console.log(`\n[5] 인디서에서 원장 상태 확인`);
const state = await providers.publicDataProvider.queryContractState(address);
const L = ledger(state.data);
console.log(`    공증인      : ${hex(L.attestorId, 24)}…`);
console.log(`    증언된 계좌 : ${L.attestationCount}`);
console.log(`    계좌 등재?  : ${L.attestations.member(att.accountId)}`);
const onchain = L.attestations.lookup(att.accountId);
console.log(`    저장된 커밋 : ${hex(onchain, 24)}…`);
const matches = Buffer.compare(Buffer.from(onchain), Buffer.from(att.navCommitment)) === 0;
console.log(`    로컬 커밋과 일치: ${matches ? '✅' : RED('❌')}`);
if (!matches) process.exitCode = 1;

console.log(`\n    원장에 NAV ${att.nav} 은 ${RED('없다')} — 커밋만 있다.`);
console.log(`\n    주소: ${address}`);
console.log(DIM(`    curl -s -X POST ${env.indexer} -H 'Content-Type: application/json' \\`));
console.log(DIM(`      -d '{"query":"{ contractAction(address:\\"${address}\\"){ __typename address } }"}'`));

await attestor.close?.();
await walletProvider.stop();
process.exit(process.exitCode ?? 0);
