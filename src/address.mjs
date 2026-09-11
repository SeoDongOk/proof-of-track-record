/**
 * 배포 지갑 주소 출력 — 파우셋에서 자금을 받기 위한 것.
 *
 *   nvm use 22
 *   MN_NETWORK=preview node src/address.mjs
 *
 * 시드 관리가 이 스크립트의 진짜 역할이다.
 *
 * 로컬 devnet 은 제네시스에서 이미 자금이 들어간 계정을 쓰므로 시드가
 * 0000..0002 로 소스에 박혀 있다. 로컬 전용이라 공개돼도 상관없다.
 *
 * 공개 테스트넷은 다르다. 같은 시드를 쓰면 이 저장소를 읽은 누구나 같은 지갑을
 * 열 수 있고, 파우셋에서 받은 자금을 가져갈 수 있다. 그래서 preview/preprod 는
 * 무작위 시드를 만들어 wallet-<network>.seed 에 넣고 gitignore 한다.
 */
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { requireNode } from './require-node.mjs';

requireNode(22);

const NET = process.env.MN_NETWORK ?? 'local';
const DIM = (s) => `\x1b[2m${s}\x1b[0m`, BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

/** 로컬 devnet 전용. 제네시스에서 자금이 들어가 있고 소스에 공개돼 있다. */
const LOCAL_SEED = '0000000000000000000000000000000000000000000000000000000000000002';

export function seedFor(net) {
  if (process.env.PTR_SEED) return process.env.PTR_SEED;
  if (net === 'local') return LOCAL_SEED;

  const file = `wallet-${net}.seed`;
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();

  const seed = randomBytes(32).toString('hex');
  writeFileSync(file, seed + '\n');
  chmodSync(file, 0o600);
  console.log(`${BOLD('새 시드를 만들었습니다')}: ${file}`);
  console.log(DIM('  gitignore 되어 있습니다. 잃어버리면 이 지갑의 자금도 잃습니다.'));
  console.log(DIM('  백업해 두세요.\n'));
  return seed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: pino } = await import('pino');
  const { LocalTestConfiguration, PreviewTestEnvironment, PreprodTestEnvironment } =
    await import('@midnight-ntwrk/testkit-js');
  const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
  const { buildWallet } = await import('./wallet.mjs');

  const env = NET === 'preview' ? new PreviewTestEnvironment().getEnvironmentConfiguration()
            : NET === 'preprod' ? new PreprodTestEnvironment().getEnvironmentConfiguration()
            : new LocalTestConfiguration({ indexer: '8088', node: '9944', proofServer: '6300' });
  // 공개 테스트넷 설정에는 proofServer 가 없다. 증명서버는 각자 로컬에서 돌린다.
  env.proofServer ??= process.env.PROOF_SERVER ?? 'http://127.0.0.1:6300';
  setNetworkId(env.networkId);

  const seed = seedFor(NET);
  const wp = await buildWallet(pino({ level: 'silent' }), env, seed);
  // 자금을 기다리지 않는다. 아직 없는 게 정상이다.
  await wp.start(false);

  const unshielded = await wp.unshieldedKeystore.getBech32Address();
  console.log(`${BOLD(`[${NET}]`)} network=${env.networkId}`);
  console.log(`  indexer ${env.indexer}`);
  console.log(`  node    ${env.node}\n`);
  console.log(BOLD('  파우셋에 넣을 주소 (unshielded, NIGHT 수령용)'));
  console.log(`  ${unshielded}\n`);
  console.log(DIM(`  shielded coinPublicKey: ${wp.getCoinPublicKey().slice(0, 48)}…`));
  if (NET !== 'local') {
    console.log(DIM(`\n  시드 파일: wallet-${NET}.seed  (gitignore 됨)`));
    console.log(DIM('  자금을 받은 뒤 배포:'));
    console.log(DIM(`    MN_NETWORK=${NET} npm run deploy`));
  }
  await wp.stop();
  process.exit(0);
}
