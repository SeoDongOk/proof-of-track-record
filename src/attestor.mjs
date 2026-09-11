/**
 * 공증인 어댑터 인터페이스.
 *
 * 이 프로젝트가 풀지 못하는 한 가지: 거래소 잔고가 진짜인지.
 * 블록체인 안에서 바깥 사실을 증명하려면 그걸 목격한 무언가가 필요하고,
 * 그건 설계로 없앨 수 없다. 그래서 숨기지 않고 슬롯으로 드러낸다.
 *
 * 구현체는 (거래소 계좌 -> NAV 커밋) 을 만들어 온체인에 올린다.
 * 커밋을 만드는 주체가 트레이더가 아니라는 것이 요점이다.
 *
 * @typedef {object} Attestation
 * @property {Uint8Array} accountId     hash(거래소 계좌 식별자). 32바이트.
 * @property {Uint8Array} navCommitment persistentCommit(nav, salt). 32바이트.
 * @property {bigint}     nav           NAV 원값. 트레이더에게만 전달, 체인에 안 감.
 * @property {Uint8Array} salt          개봉 난수. 트레이더에게만 전달.
 * @property {string}     source        'demo' | 'tlsnotary' | 'reclaim' | ...
 *
 * @typedef {object} Attestor
 * @property {() => Uint8Array} id
 * @property {(exchangeAccount: string) => Promise<Attestation>} attest
 */

import * as rt from '@midnight-ntwrk/compact-runtime';
import { createHash } from 'node:crypto';

const u48 = () => new rt.CompactTypeUnsignedInteger((1n << 48n) - 1n, 6);
const sha = (s) => new Uint8Array(createHash('sha256').update(s).digest());

/**
 * 데모용 공증인. **실제 거래소를 보지 않는다.**
 *
 * 주어진 NAV 를 그대로 증언하므로 신뢰 가치가 없다. 아키텍처 배선을
 * 보여주기 위한 것이며, 실전에서는 아래 zkTLS 구현체로 교체한다.
 */
export function demoAttestor(id = sha('demo-attestor')) {
  return {
    id: () => id,
    async attest(exchangeAccount, { nav, salt } = {}) {
      if (nav === undefined) throw new Error('demoAttestor: nav 를 직접 줘야 한다 (거래소를 보지 않으므로)');
      return {
        accountId: sha(exchangeAccount),
        navCommitment: rt.persistentCommit(u48(), nav, salt),
        nav, salt, source: 'demo',
      };
    },
  };
}

/**
 * zkTLS 공증인 자리. **미구현.**
 *
 * 구현하려면:
 *   1. TLSNotary 또는 Reclaim 으로 거래소 잔고 엔드포인트의 TLS 세션을 증명
 *   2. 세션에서 잔고를 파싱해 nav 로, 계좌 식별자를 accountId 로
 *   3. persistentCommit(nav, salt) 를 만들어 submitAttestation 으로 온체인에 제출
 *   4. (nav, salt) 는 트레이더에게만 안전한 경로로 전달
 *
 * 거래소 협조가 필요 없다는 것이 핵심이다. 바이낸스의 Ed25519 서명은
 * 클라이언트가 요청에 서명하는 방향이고 거래소가 응답에 서명하지 않으므로,
 * "브로커가 잔고에 서명" 방식은 애초에 성립하지 않는다.
 */
export function zkTlsAttestor() {
  throw new Error(
    'zkTlsAttestor: 미구현.\n' +
    '  TLSNotary(https://tlsnotary.org) 또는 Reclaim(https://reclaimprotocol.org) 연동이 남았다.\n' +
    '  현재는 demoAttestor() 를 쓴다 — 실제 거래소를 보지 않으므로 신뢰 가치는 없다.');
}
