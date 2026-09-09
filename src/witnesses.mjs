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
