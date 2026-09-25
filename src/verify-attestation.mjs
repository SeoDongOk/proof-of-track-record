/**
 * 저장된 zkTLS 증언을 검증한다. **자격증명도 네트워크도 필요 없다.**
 *
 *   node src/verify-attestation.mjs [파일]
 *
 * 왜 이게 따로 있나. 이 프로젝트의 중심 주장은 "NAV 를 공증인이 직접 읽었다"
 * 인데, 그걸 확인하려면 Primus 계정이 있어야 한다. 심사자나 처음 보는 사람에게는
 * 계정 발급이 장벽이다.
 *
 * 그런데 Primus 의 verifyAttestation 은 순수 ECDSA 복원이다:
 *
 *   const digest = encodeAttestation(attestation);
 *   recoverAddress(digest, attestation.signatures[0]) === PADO_ADDRESS
 *
 * 네트워크도 appId 도 쓰지 않는다. 그래서 실제 증언 하나를 저장소에 넣어 두면
 * 누구나 오프라인에서 서명을 확인할 수 있다.
 *
 * 여기 들어 있는 것은 **공개 시세** 증언이다. 계좌 증언은 요청 헤더에
 * API 키가 들어가므로 커밋하지 않는다.
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'samples/attestation-btcusdt.json';
const DIM = (s) => `\x1b[2m${s}\x1b[0m`, RED = (s) => `\x1b[31m${s}\x1b[0m`;

let att;
try {
  att = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`${RED('✗ 증언 파일을 읽을 수 없습니다')}: ${file}`);
  console.error(DIM(`  ${e.message}`));
  process.exit(1);
}

const { PrimusCoreTLS } = await import('@primuslabs/zktls-core-sdk');
const sdk = new PrimusCoreTLS();          // init() 를 부르지 않는다 — 자격증명 불필요

console.log(`증언 파일: ${file}`);
console.log(`  요청   : ${att.request?.method} ${att.request?.url}`);
console.log(`  증언값 : ${typeof att.data === 'string' ? att.data : JSON.stringify(att.data)}`);
console.log(`  공증인 : ${att.attestors?.[0]?.attestorAddr} ${DIM(`(${att.attestors?.[0]?.url ?? ''})`)}`);
console.log(`  시각   : ${new Date(Number(att.timestamp)).toISOString()}`);
const mode = att.additionParams?.algorithmType;
if (mode) console.log(`  모드   : ${mode}`);

const ok = sdk.verifyAttestation(att);
console.log(`\n[1] 서명 검증 ${ok ? '통과' : RED('실패')}`);
if (!ok) {
  console.error(RED('  이 증언은 신뢰할 수 없습니다.'));
  process.exit(1);
}

// 검증이 형식적이지 않다는 것을 같은 실행 안에서 보인다.
const tampered = JSON.parse(JSON.stringify(att));
if (typeof tampered.data === 'string') tampered.data = tampered.data.replace(/[0-9]/, '9');
else if (tampered.data && typeof tampered.data === 'object') {
  const k = Object.keys(tampered.data)[0];
  if (k) tampered.data[k] = '999999999';
}
let rejected;
try { rejected = sdk.verifyAttestation(tampered) === false; } catch { rejected = true; }
console.log(`[2] 값을 한 글자 바꾼 사본 ${rejected ? '거부됨' : RED('통과됨 — 문제')}`);

console.log(`\n${DIM('  네트워크도 Primus 계정도 쓰지 않았습니다.')}`);
console.log(`${DIM('  서명이 값에 묶여 있다는 것만 순수 ECDSA 복원으로 확인했습니다.')}`);
process.exit(rejected ? 0 : 1);
