/** provenanceOf 회로로 실제 ZK 증명 생성 */
import * as rt from '@midnight-ntwrk/compact-runtime';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { Contract, ledger } from '../build/track_record/contract/index.js';
import { FileZkConfigProvider } from './zk-config.mjs';
import { makeWitnesses, makePrivateState } from './witnesses.mjs';
import { requireProofServer } from './preflight.mjs';
const PS = process.env.PROOF_SERVER ?? 'http://127.0.0.1:6300';
await requireProofServer(PS);
const b32 = (n) => { const a=new Uint8Array(32); a[0]=n&0xff; a[1]=(n>>8)&0xff; return a; };
const TRADER = b32(0xAA);
const contract = new Contract(makeWitnesses());
const ctor = contract.initialState({ initialPrivateState: makePrivateState(),
  initialZswapLocalState: rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32))) });
let ctx = { currentPrivateState: ctor.currentPrivateState,
  currentZswapLocalState: ctor.currentZswapLocalState,
  currentQueryContext: new rt.QueryContext(ctor.currentContractState.data, rt.sampleContractAddress()),
  costModel: rt.CostModel.initialCostModel() };
const strategies=[];
for (let i=1;i<=10;i++){
  const params=b32(0x10+i), opening=b32(0x80+i);
  Object.assign(ctx.currentPrivateState,{strategyParams:params,strategyOpening:opening});
  ctx = contract.impureCircuits.registerStrategy(ctx, TRADER).context;
  strategies.push({params,opening});
}
const W=7, w=strategies[W-1];
Object.assign(ctx.currentPrivateState,{strategyParams:w.params,strategyOpening:w.opening});
const CIRCUIT='provenanceOf';
const run = contract.impureCircuits[CIRCUIT](ctx, TRADER, BigInt(W));
const pd = run.proofData;
const pre = rt.proofDataIntoSerializedPreimage(pd.input, pd.output, pd.publicTranscript, pd.privateTranscriptOutputs, CIRCUIT);
const zk = new FileZkConfigProvider(new URL('../build/track_record/', import.meta.url).pathname);
const prover = httpClientProvingProvider(PS, zk, { timeout: 300000 });
await prover.check(pre, CIRCUIT);
const t=Date.now(); const proof = await prover.prove(pre, CIRCUIT);
console.log(`전략 출처 ZK 증명: ${proof.length} bytes (${((Date.now()-t)/1000).toFixed(1)}s)`);
console.log(`  주장: "이 전략은 트레이더가 등록한 ${W}번째이고, 총 등록 수는 ${run.result}"`);
console.log(`  비공개: 전략 파라미터 10개 전부`);
console.log(`  preimage ${pre.length} bytes, transcript ${pd.publicTranscript.length} ops`);
