/**
 * Node 버전 검사 전용. 의존성이 없어야 한다.
 *
 * preflight.mjs 는 fetch 를 쓰는데 그것만으로 undici 가 로드되고,
 * Node 20 에서는 undici 자체가 markAsUncloneable 오류로 죽는다.
 * 버전 확인은 그보다 먼저 일어나야 하므로 파일을 분리한다.
 */
export function requireNode(major) {
  const cur = Number(process.versions.node.split('.')[0]);
  if (cur >= major) return;
  const RED = (s) => `\x1b[31m${s}\x1b[0m`;
  const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
  console.error(RED(`\n✗ Node ${major} 이상이 필요합니다 (현재 ${process.versions.node}).`));
  console.error(DIM('  testkit-js 가 Node 22+ 를 요구합니다. 회로 컴파일과 증명 생성은'));
  console.error(DIM('  Node 20 에서도 동작하며, 배포 스크립트만 Node 22 가 필요합니다.\n'));
  console.error('  nvm use 22   (또는 nvm install 22)\n');
  process.exit(1);
}
