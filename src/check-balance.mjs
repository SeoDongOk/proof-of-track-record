/** 지갑 잔액 1회 확인. stdout: FUNDED <n> | UNFUNDED | ERROR <msg> */
import { readFileSync } from 'node:fs';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { NetworkId } from '@midnight-ntwrk/zswap';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
const NET = process.env.MN_NETWORK ?? 'preview';
const C = { preview: ['https://indexer.preview.midnight.network/api/v4/graphql',
                      'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
                      'https://rpc.preview.midnight.network'] }[NET];
try {
  setNetworkId(NET);
  const w = await WalletBuilder.build(C[0], C[1], process.env.PROOF_SERVER ?? 'http://localhost:6300',
    C[2], readFileSync(`wallet-${NET}.seed`, 'utf8').trim(), NetworkId.TestNet, 'error');
  w.start();
  const s = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('sync timeout')), 90000);
    const sub = w.state().subscribe({ next: (x) => { const p = x.syncProgress;
      if (!p || p.synced === true || (p.lag && p.lag.applyGap === 0n && p.lag.sourceGap === 0n)) { clearTimeout(t); sub.unsubscribe(); res(x); } },
      error: (e) => { clearTimeout(t); rej(e); } });
  });
  const total = Object.values(s.balances ?? {}).reduce((a, v) => a + v, 0n);
  console.log(total > 0n ? `FUNDED ${total}` : 'UNFUNDED');
  await w.close();
} catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
