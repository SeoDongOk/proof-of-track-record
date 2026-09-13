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

/**
 * 바이낸스 USDⓈ-M 선물 계좌.
 *
 * GET /fapi/v3/account 의 totalMarginBalance 를 NAV 로 쓴다.
 * 지갑잔고 + 미실현손익이라 계좌의 실제 순자산이다. 포지션을 들고 있는 동안에도
 * 값이 맞으므로 트랙 레코드용 NAV 로 적합하다.
 *   totalWalletBalance   — 미실현손익 제외. 포지션 보유 중이면 실제와 어긋난다
 *   availableBalance     — 증거금으로 묶인 금액이 빠져 있다
 *
 * HMAC 서명은 우리가 만든다. 그건 '조회할 권한'일 뿐 '응답이 진짜'라는 보장이
 * 아니다. 바이낸스는 요청에 서명할 뿐 응답에 서명하지 않는다. 응답의 진위는
 * zkTLS 가 보증한다.
 *
 * ⚠️ apiKey 는 X-MBX-APIKEY 헤더로 공증인 네트워크를 지나간다.
 *    apiSecret 은 로컬에서 서명에만 쓰이고 나가지 않는다.
 *    가능하면 읽기 전용 키를 쓰는 편이 안전하다.
 */
export function binanceFutures({ apiKey, apiSecret, recvWindow = 60_000,
                                 base = 'https://fapi.binance.com', field = 'totalMarginBalance' }) {
  if (!apiKey || !apiSecret) throw new Error('binanceFutures: apiKey / apiSecret 이 필요하다');
  const qs = `recvWindow=${recvWindow}&timestamp=${Date.now()}`;
  const sig = createHmac('sha256', apiSecret).update(qs).digest('hex');
  return {
    name: 'binance-futures',
    url: `${base}/fapi/v3/account?${qs}&signature=${sig}`,
    method: 'GET',
    header: { 'X-MBX-APIKEY': apiKey },
    body: '',
    keyName: field,
    parsePath: `$.${field}`,
    toNav: (v) => toScaledInt(v),
    accountId: () => sha256(`binance-futures:${apiKey}`),
  };
}

/**
 * 바이낸스 선물 + 계정 식별자를 **한 세션에서** 공증한다. (시빌 대응)
 *
 * 왜 필요한가. binanceFutures 는 accountId 로 sha256(apiKey) 를 쓴다. API 키는
 * 계정당 몇 개든 즉시 발급되므로, 키를 새로 만들면 새 신원이 되고 전략
 * 레지스트리의 시행 횟수 카운터가 0 으로 초기화된다. 회로 6 이 무력해진다.
 *
 * 거래소는 이미 KYC 를 한다. 문제는 우리가 그 KYC 된 신원이 아니라 **키**에
 * 묶었다는 것이다. 그래서 계정 식별자(uid)에 묶는다.
 *
 *   /fapi/v3/account  — 필드 13개 전부 금액·포지션. 계정 식별자가 없다
 *   /api/v3/account   — uid 를 준다. 바이낸스는 스팟과 선물이 같은 마스터 계정이다
 *
 * 두 요청을 **한 증언 안에** 넣는 것이 핵심이다. 따로 두 번 공증하면 A 계정의
 * uid 와 B 계정의 잔고를 짝지어 제출할 수 있다.
 *
 * 이렇게 해도 시빌이 사라지지는 않는다. 거래소를 바꿔 가며 계정을 만들 수 있다.
 * 다만 신원 하나가 공짜에서 **KYC 1회**가 된다. 우리가 시빌 저항을 만드는 게
 * 아니라 거래소의 것을 상속하는 것이다 — 그게 정확한 표현이다.
 */
export function binanceFuturesBound({ apiKey, apiSecret, recvWindow = 60_000,
                                      futuresBase = 'https://fapi.binance.com',
                                      spotBase = 'https://api.binance.com',
                                      field = 'totalMarginBalance' }) {
  if (!apiKey || !apiSecret) throw new Error('binanceFuturesBound: apiKey / apiSecret 이 필요하다');
  const sign = (qs) => createHmac('sha256', apiSecret).update(qs).digest('hex');
  const hdr = { 'X-MBX-APIKEY': apiKey };

  // 타임스탬프는 요청마다 새로 만든다. 한쪽이 창을 벗어나면 그 요청만 실패한다.
  const fq = `recvWindow=${recvWindow}&timestamp=${Date.now()}`;
  const sq = `recvWindow=${recvWindow}&timestamp=${Date.now()}`;

  return {
    name: 'binance-futures-bound',
    identityPrefix: 'binance-uid',
    requests: [
      {
        url: `${spotBase}/api/v3/account?${sq}&signature=${sign(sq)}`,
        method: 'GET', header: hdr, body: '',
        keyName: 'uid', parsePath: '$.uid',
        identity: true,                       // 이 값이 accountId 가 된다
      },
      {
        url: `${futuresBase}/fapi/v3/account?${fq}&signature=${sign(fq)}`,
        method: 'GET', header: hdr, body: '',
        keyName: field, parsePath: `$.${field}`,
        toNav: (v) => toScaledInt(v),         // 이 값이 NAV 가 된다
      },
    ],
    // 배치에서는 쓰이지 않지만, 어댑터 형태를 맞추기 위해 남겨 둔다.
    accountId: () => sha256(`binance-futures:${apiKey}`),
  };
}

export const ADAPTERS = {
  'binance-futures-bound': binanceFuturesBound,
  'binance-futures': binanceFutures,
  'binance-spot': binanceSpot,
  'public-ticker': publicTicker,
};
