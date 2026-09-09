/**
 * witness 정의를 한 곳에서 관리한다.
 *
 * 회로를 추가하면 witness 도 늘어난다. 각 스크립트가 목록을 따로 들고 있으면
 * 하나만 갱신하고 나머지를 빠뜨려 "does not contain a function-valued field"
 * 로 깨진다(실제로 회로 5 추가 때 그렇게 깨졌다).
 */

/** 컨트랙트가 요구하는 witness 이름 전체 */
export const WITNESS_KEYS = [
  'strategyParams', 'strategyOpening',        // 회로 1
  'nextTrade', 'provenTrades', 'provenPaths', // 회로 2, 3
  'portfolioWeights', 'portfolioOpening',     // 회로 4
  'navOpenValue', 'navOpenSalt',              // 회로 5
  'navCloseValue', 'navCloseSalt',
];

/** privateState 의 같은 이름 필드를 그대로 돌려주는 표준 witness 구현 */
export const makeWitnesses = () => Object.fromEntries(
  WITNESS_KEYS.map((k) => [k, ({ privateState }) => [privateState, privateState[k]]]));

/** 모든 witness 키가 채워진 초기 privateState */
export const makePrivateState = (overrides = {}) => {
  const b32 = (n) => { const a = new Uint8Array(32); a[0] = n & 0xff; return a; };
  return {
    strategyParams: b32(0xAB), strategyOpening: b32(0xCD),
    nextTrade: null, provenTrades: [], provenPaths: [],
    portfolioWeights: [], portfolioOpening: b32(0xEF),
    navOpenValue: 0n, navOpenSalt: b32(10),
    navCloseValue: 0n, navCloseSalt: b32(11),
    ...overrides,
  };
};


/**
 * Trade 를 머클 리프 해시로 변환한다.
 *
 * 생성 코드의 `contract._persistentHash_N` 은 회로가 늘면 N 이 바뀐다.
 * 실제로 회로 6 을 추가했을 때 _persistentHash_0 이 다른 타입을 가리키게 되어
 * demo 가 깨졌다. 타입 서술자를 직접 만들어 그 의존을 없앤다.
 *
 * struct Trade { timestamp: Uint<64>; pnlBps: Uint<32>; salt: Bytes<32>; }
 */
export function tradeLeafHash(rt, trade) {
  const u64 = new rt.CompactTypeUnsignedInteger((1n << 64n) - 1n, 8);
  const u32 = new rt.CompactTypeUnsignedInteger((1n << 32n) - 1n, 4);
  const b32 = new rt.CompactTypeBytes(32);
  const TradeType = {
    alignment: () => u64.alignment().concat(u32.alignment().concat(b32.alignment())),
    toValue: (v) => u64.toValue(v.timestamp).concat(u32.toValue(v.pnlBps).concat(b32.toValue(v.salt))),
    fromValue: (v) => ({ timestamp: u64.fromValue(v), pnlBps: u32.fromValue(v), salt: b32.fromValue(v) }),
  };
  return rt.persistentHash(TradeType, trade);
}
