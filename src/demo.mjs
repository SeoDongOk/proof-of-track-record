import * as rt from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../build/track_record/contract/index.js';

const b32 = (n) => { const a = new Uint8Array(32); a[0] = n & 0xff; a[1] = (n >> 8) & 0xff; return a; };
const OFFSET = 100000n;   // pnlBps 오프셋: 100000 = 0bp

// ── 비공개 상태: witness 가 여기서 값을 꺼낸다 ──────────────────────────────
const ps = {
  strategyParams: b32(0xAB),
  strategyOpening: b32(0xCD),
  nextTrade: null,
  provenTrades: [],
  provenPaths: [],
  portfolioWeights: [],
  portfolioOpening: b32(0xEF),
};

const w = (k) => ({ privateState }) => [privateState, privateState[k]];
const witnesses = {
  strategyParams: w('strategyParams'), strategyOpening: w('strategyOpening'),
  nextTrade: w('nextTrade'), provenTrades: w('provenTrades'),
  provenPaths: w('provenPaths'), portfolioWeights: w('portfolioWeights'),
  portfolioOpening: w('portfolioOpening'),
};

const contract = new Contract(witnesses);
const addr = rt.sampleContractAddress();
const zswap = rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32)));

const ctor = contract.initialState({ initialPrivateState: ps, initialZswapLocalState: zswap });
let ctx = {
  currentPrivateState: ctor.currentPrivateState,
  currentZswapLocalState: ctor.currentZswapLocalState,
  currentQueryContext: new rt.QueryContext(ctor.currentContractState.data, addr),
  costModel: rt.CostModel.initialCostModel(),
};
const L = () => ledger(ctx.currentQueryContext.state);
const step = (name, fn) => {
  const r = fn();
  ctx = r.context;
  return r;
};

console.log('── 1) 전략 사전 커밋 ──────────────────────────────');
step('commitStrategy', () => contract.impureCircuits.commitStrategy(ctx));
console.log('   커밋 해시:', Buffer.from(L().strategyCommitment).toString('hex').slice(0, 24) + '…');
console.log('   locked   :', L().strategyLocked);

console.log('\n── 2) 거래 8건 기록 ───────────────────────────────');
// 실제 손익(bp): +150, -80, +220, +60, -40, +310, -120, +90  => 합 +590
const pnls = [150n, -80n, 220n, 60n, -40n, 310n, -120n, 90n];
const trades = [];
pnls.forEach((p, i) => {
  const t = { timestamp: BigInt(1757000000 + i * 3600), pnlBps: OFFSET + p, salt: b32(i + 1) };
  ctx.currentPrivateState.nextTrade = t;
  step('recordTrade', () => contract.impureCircuits.recordTrade(ctx));
  trades.push(t);
});
console.log('   기록 건수:', L().tradeCount);
console.log('   머클 루트:', L().tradeLog.root().field.toString().slice(0, 20) + '…');

console.log('\n── 3) 수익률 임계값 증명 ──────────────────────────');
const paths = trades.map((t) => L().tradeLog.findPathForLeaf(contract._persistentHash_0(t)));
console.log('   머클 경로 확보:', paths.filter(Boolean).length, '/ 8');
ctx.currentPrivateState.provenTrades = trades;
ctx.currentPrivateState.provenPaths = paths;

const actualSum = pnls.reduce((a, b) => a + b, 0n);          // +590
const encodedSum = 8n * OFFSET + actualSum;                   // 회로가 보는 합계
console.log(`   실제 손익 합계: ${actualSum > 0n ? '+' : ''}${actualSum}bp (인코딩 ${encodedSum})`);

// (A) 참인 주장: "합계 ≥ +500bp"
const trueClaim = 8n * OFFSET + 500n;
try {
  step('proveReturnAtLeast', () => contract.impureCircuits.proveReturnAtLeast(ctx, trueClaim));
  console.log('   ✅ 참인 주장 (≥ +500bp) 통과   원장 기록:', L().provenPnlFloor, `(${L().provenTradeCount}건 근거)`);
} catch (e) {
  console.log('   ❌ 참인 주장이 거부됨:', e.message);
}

// (B) 거짓 주장: "합계 ≥ +900bp"  → 반드시 거부돼야 한다
const falseClaim = 8n * OFFSET + 900n;
try {
  contract.impureCircuits.proveReturnAtLeast(ctx, falseClaim);
  console.log('   ❌❌ 거짓 주장 (≥ +900bp) 이 통과됨 — 증명 시스템 무의미');
} catch (e) {
  console.log('   ✅ 거짓 주장 (≥ +900bp) 거부:', e.message.split('\n')[0]);
}

// (C) 조작 시도: 로그에 없는 거래를 끼워넣기
const fake = { timestamp: 1757999999n, pnlBps: OFFSET + 5000n, salt: b32(99) };
const tampered = [...trades]; tampered[0] = fake;
ctx.currentPrivateState.provenTrades = tampered;
try {
  contract.impureCircuits.proveReturnAtLeast(ctx, trueClaim);
  console.log('   ❌❌ 위조 거래가 통과됨');
} catch (e) {
  console.log('   ✅ 위조 거래 거부:', e.message.split('\n')[0]);
}
ctx.currentPrivateState.provenTrades = trades;

console.log('\n── 4) 리스크 한도 증명 ────────────────────────────');
// 종목당 비중(bp): 최대 1000bp(10%), 합계 6400bp
const weights = [1000n, 1000n, 900n, 800n, 800n, 700n, 700n, 500n];
ctx.currentPrivateState.portfolioWeights = weights;
step('commitPortfolio', () => contract.impureCircuits.commitPortfolio(ctx));
console.log('   포트폴리오 커밋:', Buffer.from(L().portfolioCommitment).toString('hex').slice(0, 24) + '…');

try {
  step('proveMaxWeight', () => contract.impureCircuits.proveMaxWeight(ctx, 1000n));
  console.log('   ✅ "종목당 ≤ 10%" 증명 통과   원장 기록:', L().provenMaxWeightBps, 'bp');
} catch (e) {
  console.log('   ❌ 참인 한도가 거부됨:', e.message.split('\n')[0]);
}
try {
  contract.impureCircuits.proveMaxWeight(ctx, 700n);
  console.log('   ❌❌ 거짓 한도 (≤ 7%) 가 통과됨');
} catch (e) {
  console.log('   ✅ 거짓 한도 (≤ 7%) 거부:', e.message.split('\n')[0]);
}

console.log('\n── 최종 공개 원장 ─────────────────────────────────');
const l = L();
console.log('   전략 커밋      :', Buffer.from(l.strategyCommitment).toString('hex').slice(0, 16) + '…');
console.log('   거래 건수      :', l.tradeCount);
console.log('   증명된 손익하한:', l.provenPnlFloor, `(실제값 ${encodedSum} 은 비공개)`);
console.log('   증명된 비중상한:', l.provenMaxWeightBps, 'bp (실제 비중은 비공개)');
