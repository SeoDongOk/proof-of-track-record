/**
 * 테스트 공용 하네스.
 *
 * 회로를 로컬에서 실행해 원장 상태와 assert 거부를 확인한다.
 * 증명서버도 체인도 쓰지 않으므로 네트워크 없이 돈다.
 */
import * as rt from '@midnight-ntwrk/compact-runtime';
import { makeWitnesses, makePrivateState } from '../src/witnesses.mjs';

export { rt };

/** 32바이트 배열. 앞 두 바이트에 n 을 넣는다. */
export const b32 = (n) => {
  const a = new Uint8Array(32);
  a[0] = n & 0xff; a[1] = (n >> 8) & 0xff;
  return a;
};

export const hex = (u8) => Buffer.from(u8).toString('hex');

/** track_record 컨트랙트 컨텍스트를 새로 만든다. */
export async function trackRecord(privateOverrides = {}) {
  const { Contract, ledger } = await import('../build/track_record/contract/index.js');
  const contract = new Contract(makeWitnesses());
  const ctor = contract.initialState({
    initialPrivateState: makePrivateState(privateOverrides),
    initialZswapLocalState: rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32))),
  });
  return wrap(contract, ctor, ledger);
}

/** attestation 컨트랙트 컨텍스트를 새로 만든다. */
export async function attestation(privateOverrides = {}) {
  const { Contract, ledger } = await import('../build/attestation/contract/index.js');
  const contract = new Contract({
    navValue: ({ privateState }) => [privateState, privateState.navValue],
    navSalt: ({ privateState }) => [privateState, privateState.navSalt],
  });
  const ctor = contract.initialState({
    initialPrivateState: { navValue: 0n, navSalt: b32(0), ...privateOverrides },
    initialZswapLocalState: rt.emptyZswapLocalState(rt.encodeCoinPublicKey('00'.repeat(32))),
  });
  return wrap(contract, ctor, ledger);
}

function wrap(contract, ctor, ledger) {
  let ctx = {
    currentPrivateState: ctor.currentPrivateState,
    currentZswapLocalState: ctor.currentZswapLocalState,
    currentQueryContext: new rt.QueryContext(ctor.currentContractState.data, rt.sampleContractAddress()),
    costModel: rt.CostModel.initialCostModel(),
  };
  return {
    /** 회로를 호출하고 컨텍스트를 갱신한다. assert 실패는 그대로 던진다. */
    call(name, ...args) {
      const r = contract.impureCircuits[name](ctx, ...args);
      ctx = r.context;
      return r.result;
    },
    /** 회로가 거부되기를 기대한다. 거부 메시지를 돌려준다. */
    expectReject(name, ...args) {
      try {
        contract.impureCircuits[name](ctx, ...args);
      } catch (e) {
        return String(e.message).split('\n')[0];
      }
      throw new Error(`${name} 이 거부되어야 하는데 통과했다`);
    },
    /** private state 를 바꾼다 (witness 값 교체). */
    setPrivate(patch) { Object.assign(ctx.currentPrivateState, patch); },
    /** 현재 공개 원장 */
    get ledger() { return ledger(ctx.currentQueryContext.state); },
  };
}
