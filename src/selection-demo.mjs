/**
 * 전략 단위 선택(strategy-level survivorship)이 왜 막히는지 실증한다.
 *
 * 시나리오: 트레이더가 전략 10개를 등록하고 그중 이긴 하나만 보여주려 한다.
 *   커밋만 있으면    → 각 커밋은 전부 유효하다. 검증자는 9개의 존재를 모른다.
 *   레지스트리가 있으면 → 등록 개수가 공개라 "10개 중 1개"가 드러난다.
 */
import * as rt from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../build/track_record/contract/index.js';
import { makeWitnesses, makePrivateState } from './witnesses.mjs';

const b32 = (n) => { const a = new Uint8Array(32); a[0] = n & 0xff; a[1] = (n >> 8) & 0xff; return a; };
const TRADER = b32(0xAA);                       // 트레이더 공개 식별자

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

// ── 전략 10개를 등록 (파라미터는 전부 비공개) ────────────────────────────────
console.log('트레이더가 전략 10개를 등록한다. 파라미터는 공개되지 않는다.\n');
const strategies = [];
for (let i = 1; i <= 10; i++) {
  const params = b32(0x10 + i), opening = b32(0x80 + i);
  ctx.currentPrivateState.strategyParams = params;
  ctx.currentPrivateState.strategyOpening = opening;
  ctx = contract.impureCircuits.registerStrategy(ctx, TRADER).context;
  strategies.push({ i, params, opening });
}
const count = L().strategyCount.lookup(TRADER);
console.log(`원장에 기록된 것: 트레이더 ${Buffer.from(TRADER).toString('hex').slice(0,8)}… 의 등록 수 = ${count}`);
console.log('  (각 전략의 파라미터는 커밋 해시로만 존재)\n');

// ── 9개는 잃고 1개만 이겼다고 하자. 이긴 것만 증명하려 한다 ──────────────────
const WINNER = 7;
const w = strategies[WINNER - 1];
ctx.currentPrivateState.strategyParams = w.params;
ctx.currentPrivateState.strategyOpening = w.opening;

console.log(`[1] 이긴 ${WINNER}번 전략의 성과를 증명하려 한다`);
const r = contract.impureCircuits.provenanceOf(ctx, TRADER, BigInt(WINNER));
ctx = r.context;
console.log(`    증명 통과. 그런데 회로가 함께 반환하는 값: ${r.result}`);
console.log(`    → 검증자는 "10개 중 1개"를 본다. 나머지 9개를 숨길 수 없다.\n`);

// ── 등록하지 않은 전략을 주장하려 하면 ──────────────────────────────────────
console.log('[2] 등록하지 않은 전략을 주장');
ctx.currentPrivateState.strategyParams = b32(0xFF);
ctx.currentPrivateState.strategyOpening = b32(0xFE);
try {
  contract.impureCircuits.provenanceOf(ctx, TRADER, BigInt(WINNER));
  console.log('    ❌❌ 미등록 전략이 통과됨');
} catch (e) {
  console.log(`    거부: ${e.message.split('\n')[0]}`);
  console.log('    → 결과를 본 뒤에 전략을 지어낼 수 없다.\n');
}

// ── 다른 슬롯의 전략인 척하면 ───────────────────────────────────────────────
console.log('[3] 3번 슬롯 전략을 7번인 척 제출');
const other = strategies[2];
ctx.currentPrivateState.strategyParams = other.params;
ctx.currentPrivateState.strategyOpening = other.opening;
try {
  contract.impureCircuits.provenanceOf(ctx, TRADER, BigInt(WINNER));
  console.log('    ❌❌ 슬롯 바꿔치기가 통과됨');
} catch (e) {
  console.log(`    거부: ${e.message.split('\n')[0]}`);
  console.log('    → 커밋과 슬롯이 묶여 있다.\n');
}

console.log('── 결론 ───────────────────────────────────────────');
console.log('  시행 자체를 막지는 않는다. 10개를 돌리는 건 자유다.');
console.log('  다만 몇 번 시도했는지를 숨길 수 없다.');
console.log(`  원장이 말한다: 이 트레이더는 ${count}개를 등록했다.`);
console.log('  "10개 중 이긴 1개"는 "1개를 골라 10번 이겼다"와 다르게 읽힌다.');
