/**
 * 공개 테스트넷 지갑 준비 — 동기화 + DUST 등록까지.
 *
 *   nvm use 22
 *   MN_NETWORK=preview node src/prepare-testnet.mjs
 *
 * 왜 따로 있나. testkit 의 walletProvider.start(true) 는 내부에서
 * syncWallet(wallet) 을 호출하는데 타임아웃이 90초로 박혀 있다. 로컬 devnet
 * (블록 수천 개)에는 충분하지만 Preview 는 블록이 82만 개가 넘어 shielded
 * 머클트리 스캔만으로 그걸 넘긴다. 결과는 'Wallet sync timeout after 90000ms'.
 *
 * syncWallet 은 export 되어 있고 타임아웃 인자를 받으므로, 여기서 먼저 넉넉한
 * 시간으로 동기화해 둔다. 한 번 동기화되면 이후 start(true) 는 빠르게 끝난다.
 *
 * 그리고 NIGHT 만 받아서는 수수료를 못 낸다. Midnight 은 DUST 로 수수료를 내고
 * DUST 는 NIGHT UTXO 를 등록해야 생성되기 시작한다. 파우셋에서 NIGHT 를 받은
 * 직후에는 DUST 가 0 이므로 등록 트랜잭션을 한 번 보내야 한다.
 */
import { requireNode } from './require-node.mjs';
requireNode(22);

const NET = process.env.MN_NETWORK ?? 'preview';
const SYNC_TIMEOUT = Number(process.env.PTR_SYNC_TIMEOUT ?? 900_000);   // 15분
const DIM = (s) => `\x1b[2m${s}\x1b[0m`, BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;

const { default: pino } = await import('pino');
const tk = await import('@midnight-ntwrk/testkit-js');
const { syncWallet, PreviewTestEnvironment, PreprodTestEnvironment, LocalTestConfiguration } = tk;
const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
const { buildWallet } = await import('./wallet.mjs');
const { seedFor } = await import('./address.mjs');

const env = NET === 'preview' ? new PreviewTestEnvironment().getEnvironmentConfiguration()
          : NET === 'preprod' ? new PreprodTestEnvironment().getEnvironmentConfiguration()
          : new LocalTestConfiguration({ indexer: '8088', node: '9944', proofServer: '6300' });
env.proofServer ??= process.env.PROOF_SERVER ?? 'http://127.0.0.1:6300';
setNetworkId(env.networkId);

const logger = pino({ level: 'silent' });
// DUST 등록은 부트스트랩 단계다. 이 시점의 DUST 잔고는 0 이므로 수수료
// 오버헤드를 강제하면 낼 수 없는 수수료를 요구하는 트랜잭션이 만들어진다.
// 등록 전용으로는 오버헤드 0 을 쓴다 (PTR_FEE_OVERHEAD 로 덮어쓸 수 있다).
const wp = await buildWallet(logger, env, seedFor(NET),
  BigInt(process.env.PTR_FEE_OVERHEAD ?? '0'));
const addr = wp.unshieldedKeystore.getBech32Address().asString();

console.log(`${BOLD(`[${NET}]`)} ${addr}`);
console.log(DIM(`  동기화 중… 최대 ${(SYNC_TIMEOUT / 60000).toFixed(0)}분. Preview 는 블록이 많아 오래 걸립니다.`));

await wp.start(false);                       // 자금 대기 없이 시작
const t0 = Date.now();
const Rx = await import('rxjs');

/**
 * 여기서 unshielded 만 기다리는 이유.
 *
 * testkit 의 syncWallet 은 shielded / unshielded / dust 가 모두 완료되기를
 * 기다린다. Preview 에서는 그게 15분 안에 끝나지 않는다 — 블록이 82만 개라
 * shielded 머클트리 스캔이 오래 걸리고, dust 는 더 근본적인 문제가 있다.
 *
 * DUST 는 NIGHT UTXO 를 등록해야 비로소 생성되기 시작한다. 파우셋에서 NIGHT 를
 * 갓 받은 지갑은 DUST 가 0 이고, 등록 전에는 dust 동기화가 완료로 넘어가지
 * 않는다. 즉 '동기화가 끝나야 등록한다'는 순서 자체가 성립하지 않는다.
 *
 * 등록에 필요한 것은 unshielded 쪽의 NIGHT UTXO 목록뿐이므로, unshielded 만
 * 기다린 뒤 등록하고, 그 다음에 DUST 가 쌓이는지 폴링한다.
 */
const waitUnshielded = (wallet, ms) => Rx.firstValueFrom(
  wallet.state().pipe(
    Rx.filter((st) => st.unshielded.progress?.isStrictlyComplete() === true),
    Rx.timeout({ each: ms,
      with: () => Rx.throwError(() => new Error(`unshielded 동기화 타임아웃 ${ms}ms`)) }),
  ));

let state = await waitUnshielded(wp.wallet, SYNC_TIMEOUT);
console.log(`  ✅ unshielded 동기화 완료 ${DIM(`(${((Date.now() - t0) / 1000).toFixed(0)}s)`)}`);

const night = Object.values(state.unshielded.balances ?? {}).reduce((a, b) => a + BigInt(b), 0n);
let dust = state.dust.balance(new Date());
console.log(`  NIGHT: ${night}  ${DIM(`UTXO ${state.unshielded.availableCoins?.length ?? 0}개`)}`);
console.log(`  DUST : ${dust}`);

if (night === 0n) {
  console.log(`\n${RED('✗ NIGHT 이 0 입니다.')} 파우셋에서 아직 도착하지 않았습니다.`);
  console.log(DIM('  https://faucet.preview.midnight.network/ 에 이 주소를 넣으세요:'));
  console.log(`  ${addr}`);
  await wp.stop(); process.exit(1);
}

if (dust === 0n) {
  const { unshieldedToken } = await import('@midnight-ntwrk/ledger-v8');
  const raw = unshieldedToken().raw;
  const unregistered = (state.unshielded.availableCoins ?? []).filter(
    (c) => c.utxo.type === raw && c.meta.registeredForDustGeneration === false);

  if (unregistered.length > 0) {
    console.log(`\n  NIGHT UTXO ${unregistered.length}개를 DUST 생성용으로 등록합니다…`);
    const recipe = await wp.wallet.registerNightUtxosForDustGeneration(
      unregistered, wp.unshieldedKeystore.getPublicKey(),
      (payload) => wp.unshieldedKeystore.signData(payload));
    const finalized = await wp.wallet.finalizeRecipe(recipe);

    // 공개 RPC 의 웹소켓이 주기적으로 끊긴다(1000 Normal Closure). 제출이 그
    // 타이밍에 걸리면 실패하므로 몇 번 다시 시도한다.
    let txId, lastErr;
    for (let i = 1; i <= 5; i++) {
      try {
        txId = await wp.wallet.submitTransaction(finalized);
        break;
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message ?? e).split('\n')[0].slice(0, 80);
        console.log(DIM(`  제출 실패 ${i}/5: ${msg}`));
        if (i < 5) await new Promise((r) => setTimeout(r, 5_000 * i));
      }
    }
    if (txId === undefined) throw lastErr;
    console.log(`  등록 tx: ${String(txId).slice(0, 40)}…`);
  } else {
    console.log(DIM('\n  미등록 NIGHT UTXO 가 없습니다 — 이미 등록된 상태입니다.'));
  }

  // DUST 는 등록 후 시간에 비례해 쌓인다. 생길 때까지 폴링한다.
  const DEADLINE = Date.now() + Number(process.env.PTR_DUST_WAIT ?? 600_000);
  console.log(DIM(`  DUST 생성 대기 중… (최대 ${((DEADLINE - Date.now()) / 60000).toFixed(0)}분)`));
  while (dust === 0n && Date.now() < DEADLINE) {
    await new Promise((r) => setTimeout(r, 15_000));
    state = await Rx.firstValueFrom(wp.wallet.state());
    dust = state.dust.balance(new Date());
    process.stdout.write(`\r  DUST: ${dust}        `);
  }
  console.log('');
}

console.log(dust > 0n
  ? `\n✅ 배포 준비 완료.  ${DIM(`MN_NETWORK=${NET} npm run deploy`)}`
  : `\n⏳ DUST 가 아직 0 입니다. 등록 트랜잭션이 확정되면 쌓이기 시작합니다. 잠시 후 다시 실행하세요.`);

await wp.stop();
process.exit(dust > 0n ? 0 : 3);
