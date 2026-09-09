/**
 * 실제 ZK 증명 생성 — 증명 서버(localhost:6300)에 붙어 proof 를 만든다.
 * 여기까지 되어야 "회로 시뮬레이션"이 아니라 ZK 다.
 */
import * as rt from '@midnight-ntwrk/compact-runtime';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { Contract, ledger } from '../build/track_record/contract/index.js';
import { FileZkConfigProvider } from './zk-config.mjs';

const PROOF_SERVER = process.env.PROOF_SERVER ?? 'http://localhost:6300';
import { readFileSync } from 'node:fs';
import { makeWitnesses, makePrivateState } from './witnesses.mjs';
const TRADES_FILE = process.argv.find((a, i) => process.argv[i - 1] === '--trades');
const BATCH_IDX = Number(process.argv.find((a, i) => process.argv[i - 1] === '--batch') ?? 0);
const hexToBytes = (h) => Uint8Array.from(Buffer.from(h, 'hex'));
const b32 = (n) => { const a = new Uint8Array(32); a[0] = n & 0xff; a[1] = (n >> 8) & 0xff; return a; };
const OFFSET = 100000n;

const ps = makePrivateState();
const contract = new Contract(makeWitnesses());

const addr = rt.sampleContractAddress();
const ctor = contract.initialState({
  initialPrivateState: ps,
  initialZswapLocalState: rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32))),
});
let ctx = {
  currentPrivateState: ctor.currentPrivateState,
  currentZswapLocalState: ctor.currentZswapLocalState,
  currentQueryContext: new rt.QueryContext(ctor.currentContractState.data, addr),
  costModel: rt.CostModel.initialCostModel(),
};
const L = () => ledger(ctx.currentQueryContext.state);

// 상태 구성: 전략 커밋 + 거래 8건
ctx = contract.impureCircuits.commitStrategy(ctx).context;
let pnls, trades = [], source;
if (TRADES_FILE) {
  const f = JSON.parse(readFileSync(TRADES_FILE, 'utf8'));
  const bt = f.batches[BATCH_IDX];
  if (!bt) { console.error(`배치 ${BATCH_IDX} 없음 (총 ${f.batches.length})`); process.exit(1); }
  pnls = bt.trades.map((r) => BigInt(r.pnl_bps_actual));
  source = `${TRADES_FILE} 배치${BATCH_IDX} [${bt.trades.map((r) => r.ticker).join(',')}]`;
  for (const r of bt.trades) {
    const t = { timestamp: BigInt(r.timestamp), pnlBps: BigInt(r.pnlBps), salt: hexToBytes(r.salt) };
    ctx.currentPrivateState.nextTrade = t;
    ctx = contract.impureCircuits.recordTrade(ctx).context;
    trades.push(t);
  }
} else {
  pnls = [150n, -80n, 220n, 60n, -40n, 310n, -120n, 90n];
  source = '내장 샘플';
  pnls.forEach((p, i) => {
    const t = { timestamp: BigInt(1757000000 + i * 3600), pnlBps: OFFSET + p, salt: b32(i + 1) };
    ctx.currentPrivateState.nextTrade = t;
    ctx = contract.impureCircuits.recordTrade(ctx).context;
    trades.push(t);
  });
}
console.log(`데이터: ${source}`);
ctx.currentPrivateState.provenTrades = trades;
ctx.currentPrivateState.provenPaths =
  trades.map((t) => L().tradeLog.findPathForLeaf(contract._persistentHash_0(t)));

// ── 참인 주장: 증명 생성 ────────────────────────────────────────────────────
const CIRCUIT = 'proveReturnAtLeast';
const actual = pnls.reduce((a, b) => a + b, 0n);          // +590bp
const floorTo50 = (x) => (x >= 0n ? (x / 50n) * 50n : -((-x + 49n) / 50n) * 50n);
const claimBps = floorTo50(actual);                        // 실제값을 50bp 단위로 내림
const trueClaim = 8n * OFFSET + claimBps;                  // 참
const falseClaim = 8n * OFFSET + claimBps + 400n;          // +400bp 부풀림 (거짓)

console.log(`거래 8건 기록 완료. 실제 손익 합계 ${actual > 0n ? '+' : ''}${actual}bp (비공개)`);

const run = contract.impureCircuits.proveReturnAtLeast(ctx, trueClaim);
const pd = run.proofData;
console.log(`\n[1] 참인 주장 "손익 합계 ≥ ${claimBps >= 0n ? '+' : ''}${claimBps}bp"`);
console.log('    회로 실행 OK   public transcript', pd.publicTranscript.length, 'ops /',
            'private outputs', pd.privateTranscriptOutputs.length);

const preimage = rt.proofDataIntoSerializedPreimage(
  pd.input, pd.output, pd.publicTranscript, pd.privateTranscriptOutputs, CIRCUIT);
console.log('    preimage      ', preimage.length, 'bytes');

const zk = new FileZkConfigProvider(new URL('../build/track_record/', import.meta.url).pathname);
const prover = httpClientProvingProvider(PROOF_SERVER, zk, { timeout: 300000 });
console.log(`    증명 서버      ${PROOF_SERVER}`);

await prover.check(preimage, CIRCUIT);
console.log('    /check         통과');

const t1 = Date.now();
const proof = await prover.prove(preimage, CIRCUIT);
const secs = ((Date.now() - t1) / 1000).toFixed(1);
console.log(`    /prove         ✅ ZK 증명 ${proof.length} bytes 생성 (${secs}s)`);

// ── 거짓 주장: 증명 자체가 불가능 ───────────────────────────────────────────
console.log(`\n[2] 거짓 주장 "손익 합계 ≥ ${claimBps + 400n >= 0n ? '+' : ''}${claimBps + 400n}bp"`);
try {
  contract.impureCircuits.proveReturnAtLeast(ctx, falseClaim);
  console.log('    ❌❌ 회로가 거짓 주장을 받아들임');
} catch (e) {
  console.log('    회로 실행 거부:', e.message.split('\n')[0]);
  console.log('    → proofData 가 안 나오므로 증명 서버에 보낼 것 자체가 없다.');
  console.log('    ✅ 거짓 주장은 증명을 만들 수 없다');
}

// ── 위조 거래 삽입 ──────────────────────────────────────────────────────────
console.log('\n[3] 로그에 없는 거래를 끼워넣어 수익률 부풀리기');
const fake = { timestamp: 1757999999n, pnlBps: OFFSET + 5000n, salt: b32(99) };
const tampered = [...trades]; tampered[0] = fake;
ctx.currentPrivateState.provenTrades = tampered;
try {
  contract.impureCircuits.proveReturnAtLeast(ctx, trueClaim);
  console.log('    ❌❌ 위조 거래가 통과됨');
} catch (e) {
  console.log('    회로 실행 거부:', e.message.split('\n')[0]);
  console.log('    ✅ 커밋된 로그에 없는 거래는 증명에 못 넣는다');
}

console.log('\n── 검증자가 보는 것 ───────────────────────────────────────');
const l = L();
console.log('   전략 커밋 해시 :', Buffer.from(l.strategyCommitment).toString('hex').slice(0, 16) + '…');
console.log('   거래 건수      :', l.tradeCount.toString());
console.log('   머클 루트      :', l.tradeLog.root().field.toString().slice(0, 20) + '…');
console.log(`   ZK 증명        : ${proof.length} bytes`);
console.log('\n   검증자가 알 수 없는 것: 전략 파라미터, 8건의 개별 손익,');
console.log(`   실제 합계(${actual >= 0n ? '+' : ''}${actual}bp). 확인 가능한 것은 "≥ ${claimBps >= 0n ? '+' : ''}${claimBps}bp" 라는 사실뿐.`);
