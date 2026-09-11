/**
 * zkTLS 공증 실연동 — 거래소 잔고를 실제로 읽어 증명까지 잇는다.
 *
 *   1. Primus 공증인 네트워크가 거래소 엔드포인트를 zkTLS 로 읽는다
 *   2. 공증인 서명을 검증한다 (여기서 실패하면 중단)
 *   3. 읽어온 값으로 persistentCommit(nav, salt) 를 만든다
 *   4. submitAttestation 으로 커밋을 원장에 올린다 (NAV 값은 안 올라간다)
 *   5. proveAttestedNav 로 "내 비공개 NAV 가 그 커밋을 연다" 를 증명한다
 *   6. 부풀린 NAV 는 거부되는지 확인한다
 *
 * 이 경로의 요점: 3번의 커밋을 만드는 주체가 트레이더가 아니라 공증인이다.
 *
 *   node src/attestation-live.mjs                    # 공개 시세 (거래소 계정 불필요)
 *   node src/attestation-live.mjs --binance          # 바이낸스 현물 계좌
 *   node src/attestation-live.mjs --mode proxytls    # 빠른 모드
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import * as rt from '@midnight-ntwrk/compact-runtime';
import { primusAttestor } from './attestor.mjs';
import { binanceSpot, publicTicker, NAV_SCALE } from './exchanges.mjs';
import { Contract, ledger } from '../build/attestation/contract/index.js';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const RED = (s) => `\x1b[31m${s}\x1b[0m`, DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const hex = (u8, n = 16) => Buffer.from(u8).toString('hex').slice(0, n);

// ── 자격증명 확인 ────────────────────────────────────────────────────────────
const appId = process.env.PRIMUS_APP_ID, appSecret = process.env.PRIMUS_APP_SECRET;
if (!appId || !appSecret) {
  console.error(`
${RED('✗ Primus 자격증명이 없습니다.')}
${DIM('  zkTLS 공증은 Primus 공증인 네트워크를 거칩니다. 무료 프로젝트를 만들면 발급됩니다.')}

  1) https://dev.primuslabs.xyz/myDevelopment/myProjects 에서 프로젝트 생성
  2) 프로젝트의 App ID / App Secret 복사
  3) 이 저장소 루트에 .env 생성:

       PRIMUS_APP_ID=...
       PRIMUS_APP_SECRET=...

${DIM('  .env 는 gitignore 되어 있습니다.')}
${DIM('  자격증명 없이 회로 동작만 보려면: npm run attest (데모 공증인)')}
`);
  process.exit(1);
}

// ── 어댑터 선택 ──────────────────────────────────────────────────────────────
let adapter;
if (has('--binance')) {
  const apiKey = process.env.BINANCE_API_KEY, apiSecret = process.env.BINANCE_API_SECRET;
  if (!apiKey || !apiSecret) {
    console.error(`
${RED('✗ 바이낸스 자격증명이 없습니다.')}
${DIM('  .env 에 BINANCE_API_KEY / BINANCE_API_SECRET 를 넣으세요.')}
${DIM('  읽기 전용(Enable Reading) 키면 충분합니다. 출금 권한은 절대 켜지 마세요.')}
${DIM('  거래소 계정 없이 파이프라인만 확인하려면 플래그 없이 실행하세요.')}
`);
    process.exit(1);
  }
  adapter = binanceSpot({ apiKey, apiSecret });
} else {
  adapter = publicTicker({ symbol: opt('--symbol', 'BTCUSDT') });
  console.log(DIM('공개 시세로 파이프라인을 확인합니다. 실제 잔고 증명은 --binance 를 쓰세요.\n'));
}

const algorithmType = opt('--mode', 'mpctls');

// ── 1~2) zkTLS 공증 ──────────────────────────────────────────────────────────
console.log(`[1] zkTLS 공증 요청  ${DIM(`(${adapter.name}, ${algorithmType})`)}`);
console.log(DIM(`    ${adapter.method} ${adapter.url.replace(/signature=[0-9a-f]+/, 'signature=…')}`));
console.log(DIM(`    증언 대상: ${adapter.parsePath}`));

const salt = new Uint8Array(randomBytes(32));
const attestor = primusAttestor({ appId, appSecret, algorithmType });

const t0 = Date.now();
let att;
try {
  att = await attestor.attest(adapter, { salt });
} catch (e) {
  console.error(`\n${RED('✗ 공증 실패')}: ${e.message}`);
  if (String(e.message).includes('-1021')) {
    console.error(DIM('  바이낸스 타임스탬프 창을 벗어났습니다. 공증에 걸린 시간이 recvWindow 보다 깁니다.'));
  }
  await attestor.close?.();
  process.exit(1);
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n[2] 공증인 서명 검증 통과  ${DIM(`(${secs}s)`)}`);
console.log(`    읽어온 값: ${att.raw.keyName} = ${att.raw.value}`);
console.log(`    NAV(Uint<48>): ${att.nav}  ${DIM(`(scale ${NAV_SCALE})`)}`);
console.log(DIM(`    공증인이 읽은 것이지 우리가 넣은 값이 아니다.`));

// ── 3~5) 온체인 제출 + ZK 증명 ───────────────────────────────────────────────
const attestWitnesses = () => ({
  navValue: ({ privateState }) => [privateState, privateState.navValue],
  navSalt: ({ privateState }) => [privateState, privateState.navSalt],
});
const contract = new Contract(attestWitnesses());
const ctor = contract.initialState({
  initialPrivateState: { navValue: 0n, navSalt: new Uint8Array(32) },
  initialZswapLocalState: rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32))),
});
let ctx = {
  currentPrivateState: ctor.currentPrivateState,
  currentZswapLocalState: ctor.currentZswapLocalState,
  currentQueryContext: new rt.QueryContext(ctor.currentContractState.data, rt.sampleContractAddress()),
  costModel: rt.CostModel.initialCostModel(),
};
const L = () => ledger(ctx.currentQueryContext.state);

ctx = contract.impureCircuits.registerAttestor(ctx, attestor.id()).context;
console.log(`\n[3] 공증인 등록: ${hex(attestor.id(), 12)}…`);

ctx = contract.impureCircuits.submitAttestation(ctx, att.accountId, att.navCommitment).context;
console.log(`[4] 증언 제출`);
console.log(`    계좌: ${hex(att.accountId, 12)}…  ${DIM('(API 키의 해시. 키는 체인에 없다)')}`);
console.log(`    커밋: ${hex(att.navCommitment)}…`);
console.log(`    원장에 NAV 값 ${att.nav} 은 ${RED('없다')}`);

console.log(`\n[5] 증언된 NAV 로 ZK 증명`);
Object.assign(ctx.currentPrivateState, { navValue: att.nav, navSalt: att.salt });
try {
  ctx = contract.impureCircuits.proveAttestedNav(ctx, att.accountId).context;
  console.log(`    통과. NAV 는 끝까지 비공개다.`);
} catch (e) {
  console.log(`    ${RED('✗ 참인 값이 거부됨')}: ${e.message.split('\n')[0]}`);
  process.exitCode = 1;
}

console.log(`\n[6] NAV 를 3배로 부풀려 시도`);
ctx.currentPrivateState.navValue = att.nav * 3n;
try {
  contract.impureCircuits.proveAttestedNav(ctx, att.accountId);
  console.log(`    ${RED('❌❌ 날조가 통과됨')}`);
  process.exitCode = 1;
} catch (e) {
  console.log(`    거부: ${e.message.split('\n')[0]}`);
}

console.log(`\n── 신뢰 모델 ────────────────────────────────────`);
console.log(`  데모 공증인: NAV 를 넘겨받아 그대로 증언 → 신뢰 가치 없음`);
console.log(`  이 경로   : 공증인 네트워크가 TLS 세션에서 직접 읽음`);
console.log(`  남는 가정 : Primus 공증인 그룹의 정직성, TLS 무결성`);
console.log(`  증언된 계좌 수(공개): ${L().attestationCount}`);

await attestor.close?.();
process.exit(process.exitCode ?? 0);
