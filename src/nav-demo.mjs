/**
 * NAV 델타 증명 — 체리피킹이 왜 통하지 않는지 실증한다.
 *
 * 시나리오: 실제로는 8건 중 3건이 손실. 트레이더가 손실을 숨기고 싶다.
 *   회로3(거래 로그)  : 수익 난 5건만 커밋하면 "합계 ≥ +X" 가 참이 된다  ← 구멍
 *   회로5(NAV 델타)   : 잔고는 그대로라 같은 주장이 거부된다          ← 막힘
 */
import * as rt from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../build/track_record/contract/index.js';
import { makeWitnesses, makePrivateState } from './witnesses.mjs';

const b32 = (n) => { const a = new Uint8Array(32); a[0] = n & 0xff; a[1] = (n >> 8) & 0xff; return a; };
const OFF = 10000n;                       // returnOffset()

const ps = {
  strategyParams: b32(1), strategyOpening: b32(2), nextTrade: null,
  provenTrades: [], provenPaths: [], portfolioWeights: [], portfolioOpening: b32(3),
  navOpenValue: 0n, navOpenSalt: b32(10), navCloseValue: 0n, navCloseSalt: b32(11),
};
const contract = new Contract(makeWitnesses());

const ctor = contract.initialState({
  initialPrivateState: ps,
  initialZswapLocalState: rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32))),
});
let ctx = {
  currentPrivateState: ctor.currentPrivateState,
  currentZswapLocalState: ctor.currentZswapLocalState,
  currentQueryContext: new rt.QueryContext(ctor.currentContractState.data, rt.sampleContractAddress()),
  costModel: rt.CostModel.initialCostModel(),
};
const L = () => ledger(ctx.currentQueryContext.state);

// 실제 거래: 5승 3패. 총합 -400bp (= -4%)
const wins = [300n, 250n, 180n, 120n, 100n];
const losses = [-600n, -450n, -300n];
const all = [...wins, ...losses];
const actualBps = all.reduce((a, b) => a + b, 0n);

const NAV0 = 100_000_000n;                                   // 1억 (최소단위)
const NAV1 = NAV0 * (OFF + actualBps) / OFF;                 // 실제 종료 잔고

console.log('실제 거래  : 5승 3패, 합계 ' + actualBps + 'bp');
console.log(`NAV        : ${NAV0} -> ${NAV1}  (실제 ${actualBps}bp)`);
console.log('\n트레이더가 "이번 기간 +9% 냈다"고 주장하려 한다.\n');

// ── 기간 커밋 (결과를 알기 전에 시작 NAV 를 못 박는다) ──────────────────────
ctx.currentPrivateState.navOpenValue = NAV0;
ctx = contract.impureCircuits.openNavPeriod(ctx).context;
ctx.currentPrivateState.navCloseValue = NAV1;
ctx = contract.impureCircuits.closeNavPeriod(ctx).context;
console.log('NAV 기간 커밋 완료 (값은 비공개, 해시만 원장에)');

const claim = (bps) => OFF + bps;
const tryProve = (label, bps) => {
  try {
    ctx = contract.impureCircuits.proveNavReturnAtLeast(ctx, claim(bps)).context;
    console.log(`  ${label} → 통과   원장 기록: ${L().provenReturnBps}`);
    return true;
  } catch (e) {
    console.log(`  ${label} → 거부: ${e.message.split('\n')[0]}`);
    return false;
  }
};

console.log('\n[1] 수익 난 거래만 골라낸 주장 (회로3 이라면 통과했을 값)');
const cherry = wins.reduce((a, b) => a + b, 0n);
console.log(`    수익 난 5건만 합치면 +${cherry}bp`);
tryProve(`"수익률 ≥ +${cherry}bp"`, cherry);

console.log('\n[2] 실제 성과에 대한 참인 주장');
tryProve(`"수익률 ≥ ${actualBps}bp"`, actualBps);

console.log('\n[3] 조금이라도 부풀리면');
tryProve(`"수익률 ≥ ${actualBps + 1n}bp"`, actualBps + 1n);

console.log('\n[4] 시작 NAV 를 사후에 낮춰 수익률 부풀리기');
ctx.currentPrivateState.navOpenValue = NAV0 / 2n;
tryProve('"시작 잔고가 절반이었다"', cherry);
ctx.currentPrivateState.navOpenValue = NAV0;

console.log('\n── 결론 ───────────────────────────────────────────');
console.log('  거래 로그만으로는 손실을 빼고 커밋할 수 있다.');
console.log('  NAV 는 잔고 자체라, 거래를 빼도 숫자가 바뀌지 않는다.');
console.log(`  원장에 남은 것: 수익률 하한 ${L().provenReturnBps} (오프셋 ${OFF} = 0bp)`);
console.log(`  NAV 실제값 ${NAV0}, ${NAV1} 은 끝까지 비공개.`);
