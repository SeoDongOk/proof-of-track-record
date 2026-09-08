import { readFileSync } from 'node:fs';
import { WalletBuilder } from '@midnight-ntwrk/wallet';
import { NetworkId } from '@midnight-ntwrk/zswap';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
const NET = process.env.MN_NETWORK ?? 'preview';
setNetworkId(NET);
const w = await WalletBuilder.build(
  'https://indexer.preview.midnight.network/api/v4/graphql',
  'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  'http://localhost:6300', 'https://rpc.preview.midnight.network',
  readFileSync(`wallet-${NET}.seed`,'utf8').trim(), NetworkId.TestNet, 'error');
w.start();
const s = await new Promise((res, rej) => {
  const t=setTimeout(()=>rej(new Error('timeout')),90000);
  const sub=w.state().subscribe({next:(x)=>{clearTimeout(t);sub.unsubscribe();res(x);},error:(e)=>{clearTimeout(t);rej(e);}});
});
console.log('=== state 최상위 키 ===');
console.log(Object.keys(s).join(', '));
console.log('\n=== 주소 후보 (문자열 값) ===');
for (const [k,v] of Object.entries(s)) {
  if (typeof v === 'string' && v.length > 20) console.log(`  ${k}:\n    ${v}`);
}
await w.close();
