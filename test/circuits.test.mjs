/**
 * 회로 동작을 단언으로 고정한다.
 *
 * 데모 스크립트는 출력만 찍고 사람이 눈으로 판단한다. 여기서는 통과와 거부를
 * 기계가 확인한다. 회로를 고쳤을 때 방어가 약해지면 여기서 깨진다.
 *
 * 증명서버도 체인도 쓰지 않는다 — 회로 실행과 원장 상태만 본다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rt, b32, hex, trackRecord, attestation } from './helpers.mjs';
import { tradeLeafHash } from '../src/witnesses.mjs';

const u48 = new rt.CompactTypeUnsignedInteger((1n << 48n) - 1n, 6);

// ── 회로 1: 전략 사전 커밋 ────────────────────────────────────────────────
test('회로 1 — 커밋한 전략만 열 수 있다', async () => {
  const c = await trackRecord({ strategyParams: b32(0xAB), strategyOpening: b32(0xCD) });
  c.call('commitStrategy');
  assert.ok(c.ledger.strategyLocked, '커밋 후 잠겨야 한다');

  assert.equal(c.call('revealMatchesCommitment'), true, '커밋한 값은 열린다');

  c.setPrivate({ strategyParams: b32(0x99) });
  assert.equal(c.call('revealMatchesCommitment'), false,
    '다른 전략으로는 열리면 안 된다 — 사후에 전략을 바꿀 수 없어야 한다');
});

test('회로 1 — 두 번 커밋할 수 없다', async () => {
  const c = await trackRecord();
  c.call('commitStrategy');
  const msg = c.expectReject('commitStrategy');
  assert.match(msg, /already|lock/i, `예상 밖 메시지: ${msg}`);
});

// ── 회로 6: 전략 레지스트리 (시빌/체리피킹) ───────────────────────────────
test('회로 6 — 시행 횟수가 원장에 공개된다', async () => {
  const c = await trackRecord();
  const trader = b32(0x42);
  for (let i = 0; i < 3; i++) {
    c.setPrivate({ strategyParams: b32(0x10 + i), strategyOpening: b32(0x20 + i) });
    c.call('registerStrategy', trader);
  }
  assert.equal(c.ledger.strategyCount.lookup(trader), 3n,
    '10개 중 1개를 1전 1승처럼 보이게 할 수 없어야 한다');
});

test('회로 6 — 등록하지 않은 전략은 증명할 수 없다', async () => {
  const c = await trackRecord();
  const trader = b32(0x42);
  c.setPrivate({ strategyParams: b32(0x10), strategyOpening: b32(0x20) });
  c.call('registerStrategy', trader);

  c.setPrivate({ strategyParams: b32(0xFF), strategyOpening: b32(0xEE) });
  const msg = c.expectReject('provenanceOf', trader, 1n);
  assert.match(msg, /does not match|registered/i, `예상 밖 메시지: ${msg}`);
});

// ── 회로 2·3: 거래 로그 + 수익률 하한 ─────────────────────────────────────
test('회로 3 — 참인 하한은 통과, 거짓 하한은 거부', async () => {
  const OFFSET = 100_000n;
  const pnls = [120n, -40n, 200n, -30n, 90n, 150n, -60n, 160n];   // 합 +590
  const trades = pnls.map((p, i) => ({
    timestamp: BigInt(1700000000 + i), pnlBps: OFFSET + p, salt: b32(0xA0 + i),
  }));
  const c = await trackRecord();
  c.call('commitStrategy');                    // recordTrade 는 잠긴 전략을 요구한다
  for (const t of trades) { c.setPrivate({ nextTrade: t }); c.call('recordTrade'); }

  const paths = trades.map((t) =>
    c.ledger.tradeLog.findPathForLeaf(tradeLeafHash(rt, t)));
  assert.ok(paths.every(Boolean), '8개 머클 경로가 모두 잡혀야 한다');

  const sum = trades.reduce((a, t) => a + BigInt(t.pnlBps), 0n);   // 8*OFFSET + 590
  c.setPrivate({ provenTrades: trades, provenPaths: paths });

  c.call('proveReturnAtLeast', sum - 90n);
  assert.equal(c.ledger.provenPnlFloor, sum - 90n, '참인 하한은 원장에 기록된다');

  const msg = c.expectReject('proveReturnAtLeast', sum + 1n);
  assert.match(msg, /floor|claimed/i, `예상 밖 메시지: ${msg}`);
});

test('회로 3 — 로그에 없는 거래를 끼워 넣을 수 없다', async () => {
  const OFFSET = 100_000n;
  const real = Array.from({ length: 8 }, (_, i) => ({
    timestamp: BigInt(1700000000 + i), pnlBps: OFFSET + 10n, salt: b32(0xA0 + i),
  }));
  const c = await trackRecord();
  c.call('commitStrategy');
  for (const t of real) { c.setPrivate({ nextTrade: t }); c.call('recordTrade'); }
  const paths = real.map((t) => c.ledger.tradeLog.findPathForLeaf(tradeLeafHash(rt, t)));

  // 마지막 거래만 훨씬 큰 값으로 바꿔치기. 경로는 진짜를 그대로 쓴다.
  const forged = [...real];
  forged[7] = { ...real[7], pnlBps: OFFSET + 9000n };
  c.setPrivate({ provenTrades: forged, provenPaths: paths });

  const msg = c.expectReject('proveReturnAtLeast', OFFSET * 8n + 70n);
  assert.match(msg, /merkle|path/i, `예상 밖 메시지: ${msg}`);
});

// ── 회로 4: 리스크 한도 ───────────────────────────────────────────────────
test('회로 4 — 실제보다 빡빡한 한도는 주장할 수 없다', async () => {
  // Vector<8, Uint<32>> — 8칸을 BigInt 로 채운다. 최대 10%.
  const weights = [1000n, 800n, 600n, 400n, 0n, 0n, 0n, 0n];
  const c = await trackRecord({ portfolioWeights: weights, portfolioOpening: b32(0xEF) });
  c.call('commitPortfolio');

  c.call('proveMaxWeight', 1000n);
  assert.equal(c.ledger.provenMaxWeightBps, 1000n);

  const msg = c.expectReject('proveMaxWeight', 700n);
  assert.match(msg, /exceed|limit/i, `예상 밖 메시지: ${msg}`);
});

// ── 회로 5: NAV 델타 (손실 은닉 차단) ─────────────────────────────────────
test('회로 5 — 손실을 빼고 계산할 수 없다', async () => {
  const OPEN = 100_000_000n, CLOSE = 96_000_000n;   // 실제 -400bp
  const c = await trackRecord({
    navOpenValue: OPEN, navOpenSalt: b32(10),
    navCloseValue: CLOSE, navCloseSalt: b32(11),
  });
  c.call('openNavPeriod');
  c.call('closeNavPeriod');

  // 이긴 거래만 골라 +950bp 주장 — 거래 로그 기준이면 통과했을 값
  const winners = c.expectReject('proveNavReturnAtLeast', 10000n + 950n);
  assert.match(winners, /claimed return|not met/i, `예상 밖 메시지: ${winners}`);

  // 실제 결과는 통과
  c.call('proveNavReturnAtLeast', 10000n - 400n);
  assert.equal(c.ledger.provenReturnBps, 9600n);

  // 1bp 만 부풀려도 거부
  const inflated = c.expectReject('proveNavReturnAtLeast', 10000n - 399n);
  assert.match(inflated, /claimed return|not met/i, `예상 밖 메시지: ${inflated}`);
});

test('회로 5 — 시작 잔고를 사후에 낮출 수 없다', async () => {
  const c = await trackRecord({
    navOpenValue: 100_000_000n, navOpenSalt: b32(10),
    navCloseValue: 96_000_000n, navCloseSalt: b32(11),
  });
  c.call('openNavPeriod');
  c.call('closeNavPeriod');

  c.setPrivate({ navOpenValue: 50_000_000n });    // 절반으로 조작
  const msg = c.expectReject('proveNavReturnAtLeast', 10000n + 9000n);
  assert.match(msg, /open nav|commitment/i, `예상 밖 메시지: ${msg}`);
});

// ── 회로 7: 제3자 공증 ────────────────────────────────────────────────────
test('회로 7 — 공증 없이는 NAV 를 주장할 수 없다', async () => {
  const c = await attestation({ navValue: 96_000_000n, navSalt: b32(0x77) });
  c.call('registerAttestor', b32(0xC0));
  const msg = c.expectReject('proveAttestedNav', b32(0xE1));
  assert.match(msg, /no attestation/i, `예상 밖 메시지: ${msg}`);
});

test('회로 7 — 공증된 NAV 만 열 수 있다', async () => {
  const NAV = 96_000_000n, SALT = b32(0x77), ACCOUNT = b32(0xE1);
  const c = await attestation({ navValue: NAV, navSalt: SALT });
  c.call('registerAttestor', b32(0xC0));
  c.call('submitAttestation', ACCOUNT, rt.persistentCommit(u48, NAV, SALT));

  c.call('proveAttestedNav', ACCOUNT);
  assert.equal(c.ledger.attestationCount, 1n);

  c.setPrivate({ navValue: NAV * 3n });
  const msg = c.expectReject('proveAttestedNav', ACCOUNT);
  assert.match(msg, /does not open|commitment/i, `예상 밖 메시지: ${msg}`);
});

test('회로 7 — 공증인은 한 번만 등록된다', async () => {
  const c = await attestation();
  c.call('registerAttestor', b32(0xC0));
  const msg = c.expectReject('registerAttestor', b32(0xC1));
  assert.match(msg, /already registered/i, `예상 밖 메시지: ${msg}`);
});

// ── 원장 비공개성 ─────────────────────────────────────────────────────────
test('원장에 비공개 값이 새지 않는다', async () => {
  const NAV = 123_456_789n;
  const c = await attestation({ navValue: NAV, navSalt: b32(0x77) });
  c.call('registerAttestor', b32(0xC0));
  c.call('submitAttestation', b32(0xE1), rt.persistentCommit(u48, NAV, b32(0x77)));
  c.call('proveAttestedNav', b32(0xE1));

  const dump = JSON.stringify(c.ledger, (_, v) =>
    typeof v === 'bigint' ? v.toString() : (v instanceof Uint8Array ? hex(v) : v));
  assert.ok(!dump.includes(String(NAV)), 'NAV 원값이 원장에 나타나면 안 된다');
});
