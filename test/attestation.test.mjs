/**
 * 저장된 zkTLS 증언 검증. 네트워크도 자격증명도 쓰지 않는다.
 *
 * 심사자가 계정 없이 확인할 수 있어야 한다는 게 이 경로의 요점이므로,
 * 테스트도 같은 조건에서 돈다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SAMPLE = 'samples/attestation-btcusdt.json';
const load = () => JSON.parse(readFileSync(SAMPLE, 'utf8'));
const sdk = async () => {
  const { PrimusCoreTLS } = await import('@primuslabs/zktls-core-sdk');
  return new PrimusCoreTLS();            // init() 를 부르지 않는다
};

test('샘플 증언에 비밀값이 없다', () => {
  const raw = readFileSync(SAMPLE, 'utf8');
  assert.ok(!/APIKEY/i.test(raw), '요청 헤더에 API 키가 있으면 커밋하면 안 된다');
  assert.ok(!/signature=[0-9a-f]{32}/.test(raw), 'HMAC 서명이 들어 있으면 안 된다');
  const a = load();
  assert.ok(!a.request?.header || a.request.header === '', '헤더는 비어 있어야 한다');
});

test('샘플 증언이 공증인 서명을 가진다', () => {
  const a = load();
  assert.ok(Array.isArray(a.attestors) && a.attestors.length > 0, '공증인이 있어야 한다');
  assert.match(a.attestors[0].attestorAddr, /^0x[0-9a-fA-F]{40}$/, '이더리움 주소 형식');
  assert.ok(Array.isArray(a.signatures) && a.signatures.length > 0, '서명이 있어야 한다');
  assert.match(a.signatures[0], /^0x[0-9a-fA-F]{130}$/, '65바이트 ECDSA 서명');
});

test('서명 검증이 통과한다 — 계정 없이', async () => {
  const s = await sdk();
  assert.equal(s.verifyAttestation(load()), true);
});

test('값을 바꾼 사본은 거부된다', async () => {
  const s = await sdk();
  const t = load();
  t.data = String(t.data).replace(/[0-9]/, '9');
  assert.equal(s.verifyAttestation(t), false, '검증이 형식적이면 여기서 true 가 나온다');
});

test('서명을 바꾼 사본은 거부된다', async () => {
  const s = await sdk();
  const t = load();
  const sig = t.signatures[0];
  t.signatures[0] = sig.slice(0, -2) + (sig.slice(-2) === 'ff' ? 'ee' : 'ff');
  let ok;
  try { ok = s.verifyAttestation(t); } catch { ok = false; }
  assert.equal(ok, false);
});

test('요청 URL 을 바꾼 사본은 거부된다', async () => {
  const s = await sdk();
  const t = load();
  t.request = { ...t.request, url: t.request.url.replace('BTCUSDT', 'ETHUSDT') };
  assert.equal(s.verifyAttestation(t), false, '어느 엔드포인트를 읽었는지도 서명에 묶여야 한다');
});
