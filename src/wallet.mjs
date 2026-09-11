/**
 * 지갑 생성 — 수수료 오버헤드를 붙여 만든다.
 *
 * 왜 필요한가. 회로 호출 트랜잭션은 비용이 작아 수수료가 0 으로 계산될 수 있다.
 * 그럴 때 지갑은 수수료 Intent 를 만들되 DUST 지출을 하나도 넣지 않는다:
 *
 *     1: Intent { actions: [], dust_actions: Some(DustActions { spends: [], ... }) }
 *
 * 노드는 이걸 비정규 형식으로 보고 거부한다:
 *
 *     non-canonical dust actions: empty
 *     Transaction malformed: transaction is not in normal form
 *     Rejected ... Malformed(NotNormalized)
 *
 * 에러는 RpcError 1010 Custom error 117 로만 올라와서 원인이 드러나지 않는다.
 * 배포 트랜잭션은 쓰는 바이트가 많아 수수료가 1 이상 나오므로 이 문제를 비껴간다.
 * 그래서 배포는 되는데 호출만 실패하는 형태로 보인다.
 *
 * additionalFeeOverhead 를 0 보다 크게 주면 수수료가 항상 양수가 되어
 * 실제 DustSpend 가 만들어진다. 확인:
 *   overhead 0        -> spends: []              -> 노드 거부
 *   overhead 1000000  -> DustSpend{v_fee:1000001} -> SucceedEntirely
 *
 * MidnightWalletProvider.build() 는 dust 옵션을 노출하지 않으므로
 * FluentWalletBuilder 로 직접 만들고 withWallet() 으로 감싼다.
 */

/** 기본 오버헤드. 로컬 devnet 기준으로 수수료를 확실히 양수로 만드는 값. */
export const DEFAULT_FEE_OVERHEAD = 1_000_000n;

/**
 * @param {object} logger  pino 인스턴스
 * @param {object} env     테스트 환경 설정
 * @param {string} seed    32바이트 hex
 * @param {bigint} [feeOverhead]
 */
export async function buildWallet(logger, env, seed, feeOverhead = DEFAULT_FEE_OVERHEAD) {
  const { MidnightWalletProvider, FluentWalletBuilder, DEFAULT_DUST_OPTIONS } =
    await import('@midnight-ntwrk/testkit-js');
  const { ZswapSecretKeys, DustSecretKey } = await import('@midnight-ntwrk/ledger-v8');

  const { wallet, seeds, keystore } = await FluentWalletBuilder
    .forEnvironment(env)
    .withSeed(seed)
    .withDustOptions({ ...DEFAULT_DUST_OPTIONS, additionalFeeOverhead: feeOverhead })
    .buildWithoutStarting();

  return MidnightWalletProvider.withWallet(
    logger, env, wallet,
    ZswapSecretKeys.fromSeed(seeds.shielded),
    DustSecretKey.fromSeed(seeds.dust),
    keystore,
  );
}
