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
 * Primus zkTLS 공증인. **실제 구현.**
 *
 * demoAttestor 와 결정적으로 다른 점: NAV 를 인자로 받지 않는다.
 * 거래소 엔드포인트를 zkTLS 세션으로 직접 읽고, 그 응답에서 값을 꺼낸다.
 * 요청을 실행하는 주체가 Primus 공증인 네트워크이므로 우리가 응답을 위조할 수 없다.
 *
 * 신뢰 이동:
 *   전 — "트레이더가 정직하다"
 *   후 — "Primus 공증인 네트워크가 정직하다" + "TLS 가 깨지지 않았다"
 *
 * 남는 가정은 solo 공증인이 아니라 분산 공증인 그룹(AlphaNet)이라는 점에서
 * 낫지만, 여전히 가정이다. 신뢰 모델 문서에 그대로 적어 둔다.
 *
 * @param {object} opts
 * @param {string} opts.appId      Primus Developer Hub 의 App ID
 * @param {string} opts.appSecret  같은 곳의 App Secret
 * @param {'proxytls'|'mpctls'} [opts.algorithmType]
 *   proxytls — 공증인이 TLS 트래픽을 중계하며 암호문을 기록. 빠르다.
 *   mpctls   — 공증인과 클라이언트가 MPC 로 세션 키를 나눠 갖는다. 클라이언트가
 *              응답을 고칠 수 없어 더 강하지만 느리다. NAV 증언에는 이쪽이 맞다.
 */
export function primusAttestor({ appId, appSecret, algorithmType = 'mpctls', timeoutMs = 120_000 } = {}) {
  if (!appId || !appSecret) {
    throw new Error(
      'primusAttestor: PRIMUS_APP_ID / PRIMUS_APP_SECRET 이 필요하다.\n' +
      '  https://dev.primuslabs.xyz/myDevelopment/myProjects 에서 프로젝트를 만들면 발급된다.\n' +
      '  .env 에 넣어 두면 스크립트가 읽는다 (.env 는 gitignore 되어 있다).');
  }

  let sdk = null;
  const id = sha(`primus-attestor:${appId}`);

  return {
    id: () => id,
    source: 'primus-zktls',

    /**
     * 어댑터를 공증한다. 단일 요청과 배치 요청을 모두 받는다.
     *
     * 배치를 쓰는 이유: 계정 식별자와 NAV 를 **한 세션에서** 읽어야 한다.
     * 따로 두 번 공증하면 서로 다른 계정의 uid 와 잔고를 짝지어 제출할 수 있다.
     * 같은 증언 안에 있어야 "이 uid 의 잔고가 이것"이 성립한다.
     *
     * @param {object} adapter src/exchanges.mjs 의 어댑터
     * @returns {Promise<Attestation & {raw: object, attestation: object}>}
     */
    async attest(adapter, { salt } = {}) {
      const batch = Array.isArray(adapter?.requests);
      if (!batch && !adapter?.url) {
        throw new Error('primusAttestor: 거래소 어댑터를 넘겨야 한다 (src/exchanges.mjs)');
      }
      if (!salt) throw new Error('primusAttestor: 개봉 난수 salt 가 필요하다');

      const { PrimusCoreTLS } = await import('@primuslabs/zktls-core-sdk');
      if (!sdk) {
        sdk = new PrimusCoreTLS();
        await sdk.init(appId, appSecret);
      }

      // 배치면 요청 배열과 그에 맞춘 resolve 배열의 배열을 넘긴다.
      const specs = batch ? adapter.requests : [adapter];
      const reqs = specs.map((r) => ({ url: r.url, method: r.method, header: r.header, body: r.body }));
      const resolves = specs.map((r) => [{ keyName: r.keyName, parseType: 'json', parsePath: r.parsePath }]);

      const attRequest = batch
        ? sdk.generateRequestParams(reqs, resolves)
        : sdk.generateRequestParams(reqs[0], resolves[0]);
      attRequest.setAttMode({ algorithmType });

      const attestation = await sdk.startAttestation(attRequest, timeoutMs);

      // 공증인 서명 검증. 이게 false 면 그 뒤는 전부 무의미하다.
      if (sdk.verifyAttestation(attestation) !== true) {
        throw new Error('primusAttestor: 공증 서명 검증 실패 — 증언을 신뢰할 수 없다');
      }

      const read = (keyName, parsePath) => {
        const v = extractValue(attestation, keyName);
        if (v === undefined) {
          throw new Error(
            `primusAttestor: 증언에서 '${keyName}' 를 찾지 못했다.\n` +
            `  parsePath 가 응답 구조와 맞는지 확인: ${parsePath}`);
        }
        return v;
      };

      // NAV 를 내는 요청과, 계정 식별자를 내는 요청을 구분한다.
      const navSpec = specs.find((r) => typeof r.toNav === 'function') ?? specs[0];
      const idSpec  = specs.find((r) => r.identity === true);

      const rawNav = read(navSpec.keyName, navSpec.parsePath);
      const nav = navSpec.toNav(rawNav);

      // 계정 식별자가 증언에 들어 있으면 그걸로 accountId 를 만든다.
      // 없으면 어댑터가 주는 값(보통 API 키 해시)으로 떨어진다 — 시빌에 약하다.
      let accountId, identity = null;
      if (idSpec) {
        const rawId = String(read(idSpec.keyName, idSpec.parsePath));
        identity = { keyName: idSpec.keyName, value: rawId, attested: true };
        accountId = sha(`${adapter.identityPrefix ?? adapter.name}:${rawId}`);
      } else {
        accountId = adapter.accountId();
      }

      return {
        accountId,
        navCommitment: rt.persistentCommit(u48(), nav, salt),
        nav, salt,
        identity,                  // null 이면 계정에 묶이지 않은 것이다
        source: `primus:${algorithmType}:${adapter.name}`,
        raw: { value: rawNav, keyName: navSpec.keyName },
        attestation,               // 검증자가 독립적으로 재검증할 수 있도록 그대로 넘긴다
      };
    },

    /** 증언을 독립적으로 재검증한다. 변조된 증언은 false. */
    verify(attestation) {
      if (!sdk) throw new Error('primusAttestor: attest() 를 먼저 호출해야 한다');
      return sdk.verifyAttestation(attestation);
    },

    async close() { if (sdk?.close) await sdk.close(); },
  };
}

/** 증언 객체에서 값 하나를 꺼낸다. SDK 버전에 따라 data 가 문자열이거나 객체다. */
function extractValue(attestation, keyName) {
  const d = attestation?.data;
  const obj = typeof d === 'string' ? safeJson(d) : d;
  if (obj && typeof obj === 'object' && keyName in obj) return obj[keyName];
  // 단일 값만 돌려주는 형태에 대한 대비
  if (obj && typeof obj === 'object') {
    const vals = Object.values(obj);
    if (vals.length === 1) return vals[0];
  }
  return undefined;
}
const safeJson = (s) => { try { return JSON.parse(s); } catch { return undefined; } };

/**
 * 이전 이름 유지 — 이제 Primus 구현으로 연결된다.
 * @deprecated primusAttestor() 를 직접 쓸 것.
 */
export function zkTlsAttestor(opts) { return primusAttestor(opts); }
