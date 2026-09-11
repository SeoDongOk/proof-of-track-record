/** proveAttestedNav 회로로 실제 ZK 증명 생성 */
import * as rt from '@midnight-ntwrk/compact-runtime';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { Contract } from '../build/track_record/contract/index.js';
import { FileZkConfigProvider } from './zk-config.mjs';
import { makeWitnesses, makePrivateState } from './witnesses.mjs';
import { requireProofServer } from './preflight.mjs';
const PS = process.env.PROOF_SERVER ?? 'http://127.0.0.1:6300';
await requireProofServer(PS);
const b32=(n)=>{const a=new Uint8Array(32);a[0]=n&0xff;return a;};
const u48 = new rt.CompactTypeUnsignedInteger((1n<<48n)-1n, 6);
const ATTESTOR=b32(0xC0), ACCOUNT=b32(0xE1), NAV=96_000_000n, SALT=b32(0x77);
const contract = new Contract(makeWitnesses());
const ctor = contract.initialState({ initialPrivateState: makePrivateState(),
  initialZswapLocalState: rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32))) });
let ctx = { currentPrivateState: ctor.currentPrivateState,
  currentZswapLocalState: ctor.currentZswapLocalState,
  currentQueryContext: new rt.QueryContext(ctor.currentContractState.data, rt.sampleContractAddress()),
  costModel: rt.CostModel.initialCostModel() };
ctx = contract.impureCircuits.registerAttestor(ctx, ATTESTOR).context;
ctx = contract.impureCircuits.submitAttestation(ctx, ACCOUNT, rt.persistentCommit(u48, NAV, SALT)).context;
Object.assign(ctx.currentPrivateState,{navOpenValue:NAV, navOpenSalt:SALT});
const C='proveAttestedNav';
const pd = contract.impureCircuits[C](ctx, ACCOUNT).proofData;
const pre = rt.proofDataIntoSerializedPreimage(pd.input, pd.output, pd.publicTranscript, pd.privateTranscriptOutputs, C);
const zk = new FileZkConfigProvider(new URL('../build/track_record/', import.meta.url).pathname);
const prover = httpClientProvingProvider(PS, zk, { timeout: 300000 });
await prover.check(pre, C);
const t=Date.now(); const proof=await prover.prove(pre, C);
console.log(`제3자 증언 ZK 증명: ${proof.length} bytes (${((Date.now()-t)/1000).toFixed(1)}s)`);
console.log(`  주장: "내 NAV 가 공증인이 올린 커밋을 연다"`);
console.log(`  비공개: NAV 값 ${NAV}`);
console.log(`  preimage ${pre.length} bytes, transcript ${pd.publicTranscript.length} ops`);
