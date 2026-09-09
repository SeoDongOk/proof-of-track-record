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
const { LocalTestConfiguration, MidnightWalletProvider,
        PreviewTestEnvironment, PreprodTestEnvironment } = tk;
const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts');
const { CompiledContract } = await import('@midnight-ntwrk/midnight-js-protocol/compact-js');
const { NodeZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-node-zk-config-provider');
const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
const { levelPrivateStateProvider } = await import('@midnight-ntwrk/midnight-js-level-private-state-provider');
const { Contract } = await import('../build/track_record/contract/index.js');
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
const walletProvider = await MidnightWalletProvider.build(logger, env, SEED);
await walletProvider.start(true);          // 자금이 보일 때까지 대기
console.log('지갑 동기화 완료');
console.log('  coinPublicKey:', walletProvider.getCoinPublicKey().slice(0, 40) + '…');

const b32 = (n) => { const a = new Uint8Array(32); a[0] = n; return a; };

// pipe 는 한 번에 여러 combinator 를 받는다 (Effect 스타일)
const compiled = CompiledContract.make('track_record', Contract).pipe(
  CompiledContract.withWitnesses(makeWitnesses()),
  CompiledContract.withCompiledFileAssets('build/track_record'),
);

const providers = {
  privateStateProvider: levelPrivateStateProvider({
    privateStateStoreName: 'ptr-private-state',
    accountId: 'ptr-local',
    privateStoragePasswordProvider: async () => 'PtrLocalDevnet2026!',  // 16자+ / 대소문자·숫자·기호
  }),
  publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS, WebSocket),
  zkConfigProvider: new NodeZkConfigProvider('build/track_record'),
  proofProvider: httpClientProofProvider(env.proofServer),
  walletProvider,
  midnightProvider: walletProvider,
};

console.log('\n배포 트랜잭션 생성 중 (증명 포함, 수 분 소요)...');
const t0 = Date.now();
const deployed = await deployContract(providers, {
  compiledContract: compiled,
  privateStateId: 'ptr',
  initialPrivateState: makePrivateState(),
});
const pub = deployed.deployTxData.public;
console.log(`\n✅ 배포 완료 (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
console.log(`   컨트랙트 주소: ${pub.contractAddress}`);
console.log(`   트랜잭션     : ${pub.txId ?? pub.txHash ?? '(n/a)'}`);
console.log(`   블록         : ${pub.blockHeight ?? '(n/a)'}`);
writeFileSync(`deployed-${NET}.json`, JSON.stringify({
  network: NET, networkId: env.networkId, contractAddress: pub.contractAddress,
  txId: pub.txId ?? pub.txHash ?? null, blockHeight: pub.blockHeight ?? null,
  deployedAt: new Date().toISOString(),
}, null, 2));
console.log(`   기록         : deployed-${NET}.json`);
await walletProvider.stop();
process.exit(0);
