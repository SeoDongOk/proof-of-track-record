/** NAV 델타 회로로 실제 ZK 증명 생성 */
import * as rt from '@midnight-ntwrk/compact-runtime';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { Contract } from '../build/track_record/contract/index.js';
import { FileZkConfigProvider } from './zk-config.mjs';
import { makeWitnesses, makePrivateState } from './witnesses.mjs';
const PS = process.env.PROOF_SERVER ?? 'http://127.0.0.1:6300';
const b32 = (n) => { const a = new Uint8Array(32); a[0] = n & 0xff; return a; };
const OFF = 10000n, NAV0 = 100000000n, ACTUAL = -400n, NAV1 = NAV0 * (OFF + ACTUAL) / OFF;
const ps = { strategyParams:b32(1), strategyOpening:b32(2), nextTrade:null, provenTrades:[],
  provenPaths:[], portfolioWeights:[], portfolioOpening:b32(3),
  navOpenValue:NAV0, navOpenSalt:b32(10), navCloseValue:NAV1, navCloseSalt:b32(11) };
const contract = new Contract(makeWitnesses());
const ctor = contract.initialState({ initialPrivateState: ps,
  initialZswapLocalState: rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32))) });
let ctx = { currentPrivateState: ctor.currentPrivateState,
  currentZswapLocalState: ctor.currentZswapLocalState,
  currentQueryContext: new rt.QueryContext(ctor.currentContractState.data, rt.sampleContractAddress()),
  costModel: rt.CostModel.initialCostModel() };
ctx = contract.impureCircuits.openNavPeriod(ctx).context;
ctx = contract.impureCircuits.closeNavPeriod(ctx).context;
const CIRCUIT = 'proveNavReturnAtLeast';
const run = contract.impureCircuits[CIRCUIT](ctx, OFF + ACTUAL);
const pd = run.proofData;
const pre = rt.proofDataIntoSerializedPreimage(pd.input, pd.output, pd.publicTranscript, pd.privateTranscriptOutputs, CIRCUIT);
const zk = new FileZkConfigProvider(new URL('../build/track_record/', import.meta.url).pathname);
const prover = httpClientProvingProvider(PS, zk, { timeout: 300000 });
await prover.check(pre, CIRCUIT);
const t = Date.now();
const proof = await prover.prove(pre, CIRCUIT);
console.log(`NAV 델타 ZK 증명: ${proof.length} bytes (${((Date.now()-t)/1000).toFixed(1)}s)`);
console.log(`  주장: 수익률 >= ${ACTUAL}bp | NAV ${NAV0}->${NAV1} 는 비공개`);
console.log(`  preimage ${pre.length} bytes, transcript ${pd.publicTranscript.length} ops`);
