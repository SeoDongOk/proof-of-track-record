/**
 * 같은 시드에서 unshielded(NIGHT) 주소를 파생한다.
 * 파우셋은 shielded(mn_shield-addr_) 가 아니라 unshielded(mn_addr_) 를 요구한다.
 */
import { readFileSync } from 'node:fs';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { UnshieldedAddress, MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';

const NET = process.env.MN_NETWORK ?? 'preview';
const seedHex = readFileSync(`wallet-${NET}.seed`, 'utf8').trim();

const res = HDWallet.fromSeed(Buffer.from(seedHex, 'hex'));
const hd = res.type === 'seedOk' ? res.hdWallet : res;
const acct = (hd.selectAccount(0).type ? hd.selectAccount(0).key : hd.selectAccount(0));
const role = (acct.selectRole(Roles.NightExternal).type ? acct.selectRole(Roles.NightExternal).key : acct.selectRole(Roles.NightExternal));
const k = role.deriveKeyAt(0);
const key = k?.key ?? k;
const pub = key.publicKey ?? key.verifyingKey ?? key;
const bytes = Buffer.from(pub instanceof Uint8Array ? pub : pub.data ?? pub);

const addr = new UnshieldedAddress(bytes.subarray(0, UnshieldedAddress.keyLength));

// shielded 주소가 mn_shield-addr_test1... 이므로 네트워크 세그먼트는 'test'
const NETWORK_SEGMENT = process.env.MN_ADDR_NETWORK ?? 'test';
const bech = MidnightBech32m.encode(NETWORK_SEGMENT, addr).toString();

console.log(`네트워크    : ${NET} (주소 세그먼트 '${NETWORK_SEGMENT}')`);
console.log(`hex        : ${addr.hexString}`);
console.log(`unshielded : ${bech}`);
console.log('\n^ 파우셋(https://midnight-tmnight-' + NET + '.nethermind.dev/)에 이 주소를 넣으세요.');
