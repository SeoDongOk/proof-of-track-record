/**
 * 거래소 어댑터 — zkTLS 공증인이 증명할 HTTPS 요청을 기술한다.
 *
 * 각 어댑터는 (자격증명) -> { url, method, header, body, parsePath, toNav } 를 만든다.
 * 공증인은 이 요청을 zkTLS 로 실행하고, parsePath 가 가리키는 값만 증언한다.
 * toNav 는 그 값을 회로가 쓰는 Uint<48> 정수로 바꾼다.
 *
 * 중요: 여기서 만드는 것은 '요청 명세'일 뿐이다. 요청을 실제로 보내는 주체는
 * Primus 공증인 네트워크이고, 그래서 응답을 우리가 위조할 수 없다.
 */
import { createHmac, createHash } from 'node:crypto';

/** NAV 스케일. 회로의 Uint<48> 에 맞춰 소수점 6자리를 정수로 올린다. */
export const NAV_SCALE = 1_000_000n;
const MAX_U48 = (1n << 48n) - 1n;

/** 소수 문자열 -> Uint<48> 정수. 부동소수점을 거치지 않는다. */
export function toScaledInt(decimalString, scale = NAV_SCALE) {
  const s = String(decimalString).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`숫자로 해석할 수 없는 값: ${JSON.stringify(decimalString)}`);
  const [int, frac = ''] = s.split('.');
  const digits = String(scale).length - 1;
  const padded = (frac + '0'.repeat(digits)).slice(0, digits);
  const v = BigInt(int) * scale + BigInt(padded || '0');
  if (v > MAX_U48) throw new Error(`NAV 가 Uint<48> 범위를 넘는다: ${v} > ${MAX_U48}`);
  return v;
}

const sha256 = (s) => new Uint8Array(createHash('sha256').update(s).digest());

/**
 * 바이낸스 현물 계좌.
 *
 * GET /api/v3/account 는 HMAC-SHA256 서명이 필요하다. 서명은 우리가 만들지만,
 * 그건 '요청할 권한'일 뿐이고 '응답이 진짜'라는 보장이 아니다. 응답의 진위는
 * zkTLS 가 보증한다. 바이낸스는 응답에 서명하지 않으므로 이 구분이 중요하다.
 *
 * recvWindow 를 넉넉히 잡는 이유: 서명 시점과 공증인이 실제로 요청을 보내는
 * 시점 사이에 지연이 있다. 기본 5초로는 자주 -1021 로 거부된다.
 */
export function binanceSpot({ apiKey, apiSecret, recvWindow = 60_000, base = 'https://api.binance.com' }) {
  if (!apiKey || !apiSecret) throw new Error('binanceSpot: apiKey / apiSecret 이 필요하다');
  const qs = `omitZeroBalances=true&recvWindow=${recvWindow}&timestamp=${Date.now()}`;
  const sig = createHmac('sha256', apiSecret).update(qs).digest('hex');
  return {
    name: 'binance-spot',
    url: `${base}/api/v3/account?${qs}&signature=${sig}`,
    method: 'GET',
    header: { 'X-MBX-APIKEY': apiKey },
    body: '',
    // 계좌 전체 평가액이 아니라 USDT 잔고. 전체 평가액은 종목별 시세가 더 필요해
    // 여러 엔드포인트를 묶어야 하므로, 단일 세션으로 증명 가능한 값부터 쓴다.
    keyName: 'usdtFree',
    parsePath: '$.balances[?(@.asset=="USDT")].free',
    toNav: (v) => toScaledInt(v),
    // 계좌 식별자는 API 키의 해시. 키 자체는 체인에 올리지 않는다.
    accountId: () => sha256(`binance-spot:${apiKey}`),
  };
}

/**
 * 자격증명이 없어도 도는 스모크 테스트용 어댑터.
 *
 * 거래소 계좌가 아니라 공개 시세를 증언한다. NAV 증명으로서는 의미가 없고,
 * zkTLS 파이프라인이 실제로 도는지 확인하는 용도다. 심사자가 거래소 계정
 * 없이도 전 구간을 돌려볼 수 있어야 해서 넣었다.
 */
export function publicTicker({ symbol = 'BTCUSDT' } = {}) {
  return {
    name: `public-ticker:${symbol}`,
    url: `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    method: 'GET',
    header: {},
    body: '',
    keyName: 'price',
    parsePath: '$.price',
    toNav: (v) => toScaledInt(v),
    accountId: () => sha256(`public-ticker:${symbol}`),
    public: true,
  };
}

export const ADAPTERS = { 'binance-spot': binanceSpot, 'public-ticker': publicTicker };
