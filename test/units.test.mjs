/** 순수 함수 단위 테스트. 회로도 네트워크도 쓰지 않는다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toScaledInt, NAV_SCALE, publicTicker, binanceFutures, binanceFuturesBound }
  from '../src/exchanges.mjs';
import { WITNESS_KEYS, makePrivateState, makeWitnesses } from '../src/witnesses.mjs';

test('toScaledInt — 소수 문자열을 Uint<48> 정수로', () => {
  assert.equal(toScaledInt('1'), 1_000_000n);
  assert.equal(toScaledInt('0.5'), 500_000n);
  assert.equal(toScaledInt('123.456789'), 123_456_789n);
  assert.equal(toScaledInt('0.000001'), 1n, '최소 단위');
  assert.equal(toScaledInt('96000.00'), 96_000_000_000n);
  assert.equal(NAV_SCALE, 1_000_000n);
});

test('toScaledInt — 내림이지 반올림이 아니다', () => {
  // 부동소수점을 거치면 여기서 틀어진다
  assert.equal(toScaledInt('123.4567891'), 123_456_789n);
  assert.equal(toScaledInt('0.9999999'), 999_999n);
});

test('toScaledInt — 범위를 넘으면 거부', () => {
  assert.throws(() => toScaledInt('999999999'), /Uint<48>/);
});

test('toScaledInt — 숫자가 아니면 거부', () => {
  for (const bad of ['', 'abc', '1.2.3', '-5', null, undefined, '1e9']) {
    assert.throws(() => toScaledInt(bad), /해석할 수 없는/, `${JSON.stringify(bad)} 는 거부되어야 한다`);
  }
});

test('binanceFutures — API 키가 URL 에 노출되지 않는다', () => {
  const KEY = 'SECRET_LOOKING_API_KEY_0123456789';
  const a = binanceFutures({ apiKey: KEY, apiSecret: 'S' });
  assert.ok(!a.url.includes(KEY), 'URL 에 API 키가 있으면 안 된다');
  assert.equal(a.header['X-MBX-APIKEY'], KEY, '키는 헤더로만 간다');
  assert.match(a.url, /signature=[0-9a-f]{64}/, 'HMAC 서명이 붙어야 한다');
});

test('binanceFuturesBound — uid 와 NAV 를 한 배치로 요청한다', () => {
  const a = binanceFuturesBound({ apiKey: 'K', apiSecret: 'S' });
  assert.equal(a.requests.length, 2, '두 엔드포인트를 한 세션에서 읽어야 한다');
  const id = a.requests.find((r) => r.identity === true);
  const nav = a.requests.find((r) => typeof r.toNav === 'function');
  assert.ok(id, '계정 식별자 요청이 있어야 한다');
  assert.ok(nav, 'NAV 요청이 있어야 한다');
  assert.equal(id.parsePath, '$.uid');
  assert.match(nav.parsePath, /totalMarginBalance/);
  assert.ok(id.url.includes('/api/v3/account'), 'uid 는 스팟 엔드포인트에서 온다');
  assert.ok(nav.url.includes('/fapi/v3/account'), 'NAV 는 선물 엔드포인트에서 온다');
});

test('신원 바인딩 — 키가 달라도 계정이 같으면 같은 accountId', () => {
  // 키 기반은 키마다 달라진다
  const k1 = binanceFutures({ apiKey: 'KEY_A', apiSecret: 'S' }).accountId();
  const k2 = binanceFutures({ apiKey: 'KEY_B', apiSecret: 'S' }).accountId();
  assert.notDeepEqual(k1, k2, '키 기반은 키마다 신원이 달라진다 (시빌에 약함)');

  // uid 기반은 attestor 가 sha256(prefix:uid) 로 만든다
  const a = binanceFuturesBound({ apiKey: 'KEY_A', apiSecret: 'S' });
  const b = binanceFuturesBound({ apiKey: 'KEY_B', apiSecret: 'S' });
  assert.equal(a.identityPrefix, b.identityPrefix, 'prefix 가 같아야 한다');
  assert.equal(a.identityPrefix, 'binance-uid');
});

test('publicTicker — 자격증명 없이 쓸 수 있다', () => {
  const a = publicTicker();
  assert.equal(Object.keys(a.header).length, 0, '헤더가 비어야 커밋해도 안전하다');
  assert.ok(!a.url.includes('signature'), '서명이 없어야 한다');
  assert.equal(a.parsePath, '$.price');
});

test('witness 목록과 초기 private state 가 어긋나지 않는다', () => {
  const ps = makePrivateState();
  for (const k of WITNESS_KEYS) {
    assert.ok(k in ps, `initial private state 에 ${k} 가 없다`);
  }
  const w = makeWitnesses();
  assert.deepEqual(Object.keys(w).sort(), [...WITNESS_KEYS].sort());
});
