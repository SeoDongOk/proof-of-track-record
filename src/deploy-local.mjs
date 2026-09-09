/**
 * 로컬 devnet 온체인 배포.
 *
 *   Node >= 22 필요 (testkit-js 요구사항)
 *   nvm use 22 && node src/deploy-local.mjs
 *
 * 선행: midnight-local-dev 스택 기동 + 배포 계정 펀딩(NIGHT + DUST 등록).
 *
 * deploy.mjs 와 나눠 둔 이유: 현재 Midnight 은 수수료를 DUST 로 내는데
 * @midnight-ntwrk/wallet 5.0.0 은 Zswap(shielded) 전용이라 DUST 를 다루지
 * 못한다. testkit-js 의 MidnightWalletProvider 는 shielded+unshielded+dust
 * 3-키 모델을 구현하고 WalletProvider/MidnightProvider 를 함께 만족한다.
 */
import { writeFileSync } from 'node:fs';
import pino from 'pino';
import { WebSocket } from 'ws';
import { LocalTestConfiguration, MidnightWalletProvider } from '@midnight-ntwrk/testkit-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { Contract } from '../build/track_record/contract/index.js';

// midnight-local-dev 의 fund-ptr 로 NIGHT + DUST 를 받은 계정
const SEED = process.env.PTR_SEED
  ?? '0000000000000000000000000000000000000000000000000000000000000002';

const env = new LocalTestConfiguration({
  indexer: '8088',
  node: '9944',
  proofServer: '6300',
});
setNetworkId(env.networkId);
console.log(`network=${env.networkId}  indexer=${env.indexer}  node=${env.node}`);

const logger = pino({ level: 'warn' });
const walletProvider = await MidnightWalletProvider.build(logger, env, SEED);
await walletProvider.start(true);          // 자금이 보일 때까지 대기
console.log('지갑 동기화 완료');
console.log('  coinPublicKey:', walletProvider.getCoinPublicKey().slice(0, 40) + '…');

const b32 = (n) => { const a = new Uint8Array(32); a[0] = n; return a; };
const w = (k) => ({ privateState }) => [privateState, privateState[k]];
const KEYS = ['strategyParams','strategyOpening','nextTrade','provenTrades','provenPaths',
              'portfolioWeights','portfolioOpening','navOpenValue','navOpenSalt',
              'navCloseValue','navCloseSalt'];

// pipe 는 한 번에 여러 combinator 를 받는다 (Effect 스타일)
const compiled = CompiledContract.make('track_record', Contract).pipe(
  CompiledContract.withWitnesses(Object.fromEntries(KEYS.map((k) => [k, w(k)]))),
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
  initialPrivateState: {
    strategyParams: b32(0xAB), strategyOpening: b32(0xCD), nextTrade: null,
    provenTrades: [], provenPaths: [], portfolioWeights: [], portfolioOpening: b32(0xEF),
    navOpenValue: 0n, navOpenSalt: b32(10), navCloseValue: 0n, navCloseSalt: b32(11),
  },
});
const pub = deployed.deployTxData.public;
console.log(`\n✅ 배포 완료 (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
console.log(`   컨트랙트 주소: ${pub.contractAddress}`);
console.log(`   트랜잭션     : ${pub.txId ?? pub.txHash ?? '(n/a)'}`);
console.log(`   블록         : ${pub.blockHeight ?? '(n/a)'}`);
writeFileSync('deployed-local.json', JSON.stringify({
  network: env.networkId, contractAddress: pub.contractAddress,
  txId: pub.txId ?? pub.txHash ?? null, blockHeight: pub.blockHeight ?? null,
  deployedAt: new Date().toISOString(),
}, null, 2));
console.log('   기록         : deployed-local.json');
await walletProvider.stop();
process.exit(0);
