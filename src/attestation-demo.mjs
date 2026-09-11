/**
 * 제3자 증언 — 자기증명을 끊는다.
 *
 * ⚠️ 이 데모에서 공증인은 우리가 겸한다. 아키텍처는 실제지만 "자기가 자기에게
 *    서명" 하는 셈이라 설득력은 반감된다. 실전에서는 이 자리에
 *    zkTLS 공증인(TLSNotary / Reclaim)이 들어간다. 그게 남은 작업이다.
 */
import * as rt from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../build/track_record/contract/index.js';
import { makeWitnesses, makePrivateState } from './witnesses.mjs';

const b32 = (n) => { const a = new Uint8Array(32); a[0] = n & 0xff; a[1] = (n >> 8) & 0xff; return a; };
const u48 = new rt.CompactTypeUnsignedInteger((1n << 48n) - 1n, 6);

const contract = new Contract(makeWitnesses());
const ctor = contract.initialState({
  initialPrivateState: makePrivateState(),
  initialZswapLocalState: rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32))),
});
let ctx = {
  currentPrivateState: ctor.currentPrivateState,
  currentZswapLocalState: ctor.currentZswapLocalState,
  currentQueryContext: new rt.QueryContext(ctor.currentContractState.data, rt.sampleContractAddress()),
  costModel: rt.CostModel.initialCostModel(),
};
const L = () => ledger(ctx.currentQueryContext.state);

const ATTESTOR = b32(0xC0);                  // 공증인 식별자
const ACCOUNT  = b32(0xE1);                  // hash(거래소 계좌ID)
const REAL_NAV = 96_000_000n;                // 거래소가 실제로 보여준 잔고
const SALT     = b32(0x77);

console.log('⚠️  데모용: 공증인 역할을 이 스크립트가 겸한다.');
console.log('    실전에서는 zkTLS 공증인(TLSNotary/Reclaim)이 이 자리에 들어간다.\n');

// ── 공증인 등록 ──────────────────────────────────────────────────────────────
ctx = contract.impureCircuits.registerAttestor(ctx, ATTESTOR).context;
console.log(`공증인 등록: ${Buffer.from(L().attestorId).toString('hex').slice(0, 12)}…`);

// ── 공증 전: 아무 NAV 나 주장할 수 있는가? ───────────────────────────────────
console.log('\n[1] 공증 없이 NAV 를 주장');
Object.assign(ctx.currentPrivateState, { navOpenValue: REAL_NAV, navOpenSalt: SALT });
try {
  contract.impureCircuits.proveAttestedNav(ctx, ACCOUNT);
  console.log('    ❌❌ 공증 없이 통과됨');
} catch (e) {
  console.log(`    거부: ${e.message.split('\n')[0]}`);
  console.log('    → 공증인이 증언하기 전에는 아무것도 주장할 수 없다.');
}

// ── 공증인이 실제 잔고를 증언 ────────────────────────────────────────────────
// 커밋을 만드는 주체가 공증인이라는 점이 핵심. 트레이더가 아니다.
const attested = rt.persistentCommit(u48, REAL_NAV, SALT);
ctx = contract.impureCircuits.submitAttestation(ctx, ACCOUNT, attested).context;
console.log(`\n공증인이 계좌 ${Buffer.from(ACCOUNT).toString('hex').slice(0, 8)}… 의 NAV 를 증언`);
console.log(`    원장에 오른 것: 커밋 ${Buffer.from(attested).toString('hex').slice(0, 16)}…`);
console.log(`    NAV 값 ${REAL_NAV} 은 원장에 없다`);

// ── 공증 후: 진짜 NAV 로 증명 ────────────────────────────────────────────────
console.log('\n[2] 공증된 실제 NAV 로 증명');
try {
  ctx = contract.impureCircuits.proveAttestedNav(ctx, ACCOUNT).context;
  console.log('    통과. NAV 는 여전히 비공개다.');
} catch (e) {
  console.log(`    ❌ 참인 값이 거부됨: ${e.message.split('\n')[0]}`);
}

// ── 날조 시도 ────────────────────────────────────────────────────────────────
console.log('\n[3] NAV 를 부풀려 주장 (D 공격)');
ctx.currentPrivateState.navOpenValue = REAL_NAV * 3n;
try {
  contract.impureCircuits.proveAttestedNav(ctx, ACCOUNT);
  console.log('    ❌❌ 날조된 NAV 가 통과됨');
} catch (e) {
  console.log(`    거부: ${e.message.split('\n')[0]}`);
  console.log('    → 공증된 커밋과 맞지 않으면 열 수 없다.');
}

// ── 다른 계좌인 척 ───────────────────────────────────────────────────────────
console.log('\n[4] 증언되지 않은 계좌로 주장');
ctx.currentPrivateState.navOpenValue = REAL_NAV;
try {
  contract.impureCircuits.proveAttestedNav(ctx, b32(0xE9));
  console.log('    ❌❌ 미증언 계좌가 통과됨');
} catch (e) {
  console.log(`    거부: ${e.message.split('\n')[0]}`);
}

console.log('\n── 신뢰 모델이 어떻게 바뀌나 ───────────────────────');
console.log('  전: "트레이더가 정직하다" 를 믿어야 했다');
console.log('  후: "공증인이 정직하다" 를 믿는다');
console.log('  공증인은 거래소 협조 없이 TLS 세션만으로 증언할 수 있다(zkTLS).');
console.log(`  증언된 계좌 수(공개): ${L().attestationCount}`);
console.log('\n  Sybil 대응: accountId 를 KYC 된 거래소 계좌에 묶으면');
console.log('  신원 10개를 만들려면 KYC 계좌 10개가 필요하다.');
