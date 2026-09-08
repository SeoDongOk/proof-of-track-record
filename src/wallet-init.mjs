/**
 * 테스트넷 지갑 생성 / 주소 조회.
 * 시드는 .gitignore 된 wallet-testnet.seed 에만 저장한다. 테스트넷 전용.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NetworkId } from '@midnight-ntwrk/zswap';

const NET = process.env.MN_NETWORK ?? 'preview';
const CFG = {
  preview: {
    indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWs: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preview.midnight.network',
  },
  preprod: {
    indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
  },
}[NET];
const PROOF = process.env.PROOF_SERVER ?? 'http://localhost:6300';
const SEED_FILE = `wallet-${NET}.seed`;

if (!existsSync(SEED_FILE)) {
  writeFileSync(SEED_FILE, randomBytes(32).toString('hex'), { mode: 0o600 });
  console.log(`새 시드 생성 → ${SEED_FILE} (테스트넷 전용, 커밋되지 않음)`);
}
const seed = readFileSync(SEED_FILE, 'utf8').trim();

setNetworkId(NET);   // midnight-js 쪽은 문자열 ('preview'/'preprod')
console.log(`네트워크: ${NET}`);
console.log(`  indexer ${CFG.indexer}`);
console.log(`  node    ${CFG.node}`);
console.log(`  proof   ${PROOF}`);

const wallet = await WalletBuilder.build(
  CFG.indexer, CFG.indexerWs, PROOF, CFG.node, seed, NetworkId.TestNet, 'warn');
wallet.start();

const state = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('상태 수신 타임아웃 60s')), 60000);
  const sub = wallet.state().subscribe({
    next: (s) => { clearTimeout(t); sub.unsubscribe(); res(s); },
    error: (e) => { clearTimeout(t); rej(e); },
  });
});

console.log('\n주소:', state.address);
console.log('잔액:', JSON.stringify(state.balances));
console.log(`\n테스트 토큰 요청: https://midnight-tmnight-${NET}.nethermind.dev/`);
await wallet.close();
