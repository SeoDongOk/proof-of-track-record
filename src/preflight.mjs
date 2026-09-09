/**
 * 실행 전 환경 점검.
 *
 * 증명 서버가 없거나 Node 버전이 낮으면 SDK 내부에서 ECONNREFUSED 나
 * webidl.util.markAsUncloneable 같은 원인 불명 스택트레이스로 죽는다.
 * 그 전에 무엇을 해야 하는지 알려준다.
 */
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

// requireNode 는 의존성 없는 require-node.mjs 로 분리했다.
// 이 파일은 fetch 를 쓰므로 undici 가 로드되고, Node 20 에서는 그 자체가 죽는다.

export async function requireProofServer(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (r.ok) return;
  } catch { /* 아래에서 안내 */ }
  console.error(RED(`\n✗ 증명 서버에 연결할 수 없습니다: ${url}`));
  console.error(DIM('  실제 ZK 증명 생성에는 증명 서버가 필요합니다.\n'));
  console.error('  npm run proof-server');
  console.error(DIM('    (docker run -d --name ptr-proof-server -p 6300:6300 \\'));
  console.error(DIM('       midnightntwrk/proof-server:8.1.0 midnight-proof-server -v)\n'));
  console.error(DIM('  증명 서버 없이 회로 동작만 보려면: npm run demo / npm run nav\n'));
  process.exit(1);
}

export async function requireLocalDevnet(indexerUrl) {
  try {
    const r = await fetch(indexerUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) return;
  } catch { /* 아래에서 안내 */ }
  console.error(RED(`\n✗ 로컬 devnet 인덱서에 연결할 수 없습니다: ${indexerUrl}`));
  console.error(DIM('  온체인 배포에는 로컬 devnet 이 필요합니다.\n'));
  console.error('  git clone https://github.com/midnightntwrk/midnight-local-dev.git');
  console.error('  cd midnight-local-dev && npm install');
  console.error('  docker compose -f standalone.yml up -d');
  console.error(DIM('  그다음 배포 계정에 NIGHT + DUST 를 지급하세요 (README 참고).\n'));
  process.exit(1);
}
