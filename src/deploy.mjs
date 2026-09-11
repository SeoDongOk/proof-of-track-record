/**
 * 온체인 배포. 로컬 devnet / Preview / Preprod 공통.
 *
 *   Node >= 22 필요 (testkit-js 요구사항)
 *   nvm use 22 && node src/deploy.mjs
 *
 * 선행: midnight-local-dev 스택 기동 + 배포 계정 펀딩(NIGHT + DUST 등록).
 *
 * deploy.mjs 와 나눠 둔 이유: 현재 Midnight 은 수수료를 DUST 로 내는데
 * @midnight-ntwrk/wallet 5.0.0 은 Zswap(shielded) 전용이라 DUST 를 다루지
 * 못한다. testkit-js 의 MidnightWalletProvider 는 shielded+unshielded+dust
 * 3-키 모델을 구현하고 WalletProvider/MidnightProvider 를 함께 만족한다.
 */
import { writeFileSync } from 'node:fs';
import { requireNode } from './require-node.mjs';

// testkit-js 는 Node 22+ 전용이다. Node 20 에서는 이 모듈들을 import 하는 것만으로
// undici 내부에서 "webidl.util.markAsUncloneable is not a function" 으로 죽는다.
// 버전 확인이 먼저 일어나야 하므로 나머지는 전부 동적 import 로 미룬다.
requireNode(22);

const { default: pino } = await import('pino');
const { WebSocket } = await import('ws');
const tk = await import('@midnight-ntwrk/testkit-js');
const { LocalTestConfiguration,
        PreviewTestEnvironment, PreprodTestEnvironment } = tk;
const { buildWallet } = await import('./wallet.mjs');
const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts');
const { CompiledContract } = await import('@midnight-ntwrk/midnight-js-protocol/compact-js');
const { NodeZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-node-zk-config-provider');
const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');
const { Contract } = await import('../build/track_record/contract/index.js');
const { Contract: AttestationContract } = await import('../build/attestation/contract/index.js');
const { makeWitnesses, makePrivateState } = await import('./witnesses.mjs');
const { requireLocalDevnet, requireProofServer } = await import('./preflight.mjs');

// midnight-local-dev 의 fund-ptr 로 NIGHT + DUST 를 받은 계정

if ((process.env.MN_NETWORK ?? 'local') === 'local') {
  await requireLocalDevnet('http://127.0.0.1:8088/api/v4/graphql');
}
await requireProofServer(process.env.PROOF_SERVER ?? 'http://127.0.0.1:6300');

const SEED = process.env.PTR_SEED
  ?? '0000000000000000000000000000000000000000000000000000000000000002';

// MN_NETWORK=local(기본) | preview | preprod
// 지갑 계층은 셋 다 동일하다. testkit-js 의 MidnightWalletProvider 가
// shielded+unshielded+dust 3-키 모델을 구현하므로 DUST 수수료를 낼 수 있다.
const NET = process.env.MN_NETWORK ?? 'local';
const env = NET === 'preview' ? new PreviewTestEnvironment().getEnvironmentConfiguration()
          : NET === 'preprod' ? new PreprodTestEnvironment().getEnvironmentConfiguration()
          : new LocalTestConfiguration({ indexer: '8088', node: '9944', proofServer: '6300' });

setNetworkId(env.networkId);
console.log(`[${NET}] network=${env.networkId}`);
console.log(`  indexer ${env.indexer}`);
console.log(`  node    ${env.node}`);

const logger = pino({ level: 'warn' });
// 수수료 오버헤드가 필요한 이유는 src/wallet.mjs 주석 참고.
// 배포만 할 때는 없어도 되지만, 같은 지갑으로 회로를 호출하면 필요하다.
const walletProvider = await buildWallet(logger, env, SEED,
  BigInt(process.env.PTR_FEE_OVERHEAD ?? '1000000'));
await walletProvider.start(true);          // 자금이 보일 때까지 대기
console.log('지갑 동기화 완료');
console.log('  coinPublicKey:', walletProvider.getCoinPublicKey().slice(0, 40) + '…');

const b32 = (n) => { const a = new Uint8Array(32); a[0] = n; return a; };

// pipe 는 한 번에 여러 combinator 를 받는다 (Effect 스타일)
const compiled = CompiledContract.make('track_record', Contract).pipe(
  CompiledContract.withWitnesses(makeWitnesses()),
  CompiledContract.withCompiledFileAssets('build/track_record'),
);

// 공증 레지스트리는 별도 컨트랙트다. 설계상 공증인이 다른 주체이기도 하고,
// 회로 14개를 한 배포 트랜잭션에 넣으면 검증키가 28KB 가 되어 블록 한도를
// 넘는다(RpcError 1010). 11개/23KB 와 3개/4.8KB 로 나누면 둘 다 통과한다.
// 키 이름은 초기 private state 및 attestation-*.mjs 와 반드시 일치해야 한다.
// 배포 트랜잭션은 이 witness 들을 호출하지 않아 불일치가 드러나지 않는다.
// proveAttestedNav 를 실제로 부를 때 undefined 로 터진다.
const attestWitnesses = {
  navValue: ({ privateState }) => [privateState, privateState.navValue],
  navSalt: ({ privateState }) => [privateState, privateState.navSalt],
};
const compiledAttestation = CompiledContract.make('attestation', AttestationContract).pipe(
  CompiledContract.withWitnesses(attestWitnesses),
  CompiledContract.withCompiledFileAssets('build/attestation'),
);

// httpClientProofProvider(url, zkConfigProvider) — 두 번째 인자가 필수다.
// 빠뜨리면 내부에서 예외를 삼키고 ZK IR 없이 요청이 나가, 증명서버가
// "bad input" 400 을 준다. 배포는 통과하지만 회로 호출에서 터진다.
const trackRecordZk = new NodeZkConfigProvider('build/track_record');
const attestationZk = new NodeZkConfigProvider('build/attestation');

const providers = {
  privateStateProvider: levelPrivateStateProvider({
    privateStateStoreName: 'ptr-private-state',
    accountId: 'ptr-local',
    privateStoragePasswordProvider: async () => 'PtrLocalDevnet2026!',  // 16자+ / 대소문자·숫자·기호
  }),
  publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS, WebSocket),
  zkConfigProvider: trackRecordZk,
  proofProvider: httpClientProofProvider(env.proofServer, trackRecordZk),
  walletProvider,
  midnightProvider: walletProvider,
};

// 공증 컨트랙트는 zkConfig 경로가 다르다. proofProvider 도 함께 바꿔야 한다.
const attestProviders = { ...providers,
  zkConfigProvider: attestationZk,
  proofProvider: httpClientProofProvider(env.proofServer, attestationZk) };

console.log('\n배포 트랜잭션 생성 중 (증명 포함, 수 분 소요)...');

const deployOne = async (label, cc, privateStateId, initialPrivateState, prov = providers) => {
  const t0 = Date.now();
  const d = await deployContract(prov, {
    compiledContract: cc, privateStateId, initialPrivateState,
  });
  const pub = d.deployTxData.public;
  console.log(`\n✅ ${label} 배포 완료 (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  console.log(`   주소   : ${pub.contractAddress}`);
  console.log(`   블록   : ${pub.blockHeight ?? '(n/a)'}`);
  return { contractAddress: pub.contractAddress,
           txId: pub.txId ?? pub.txHash ?? null,
           blockHeight: pub.blockHeight ?? null };
};

const trackRecord = await deployOne('track_record', compiled, 'ptr', makePrivateState());
const attestation = await deployOne('attestation', compiledAttestation, 'ptr-attest',
  { navValue: 0n, navSalt: new Uint8Array(32) }, attestProviders);

writeFileSync(`deployed-${NET}.json`, JSON.stringify({
  network: NET, networkId: env.networkId,
  trackRecord, attestation,
  deployedAt: new Date().toISOString(),
}, null, 2));
console.log(`\n   기록   : deployed-${NET}.json`);
await walletProvider.stop();
process.exit(0);
