/** build/ 디렉터리에서 증명키·검증키·ZKIR 을 읽어오는 ZKConfigProvider. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ZKConfigProvider, createProverKey, createVerifierKey, createZKIR }
  from '@midnight-ntwrk/midnight-js-types';

export class FileZkConfigProvider extends ZKConfigProvider {
  constructor(baseDir) { super(); this.baseDir = baseDir; }
  async getProverKey(id)   { return createProverKey(await readFile(join(this.baseDir, 'keys', `${id}.prover`))); }
  async getVerifierKey(id) { return createVerifierKey(await readFile(join(this.baseDir, 'keys', `${id}.verifier`))); }
  async getZKIR(id)        { return createZKIR(await readFile(join(this.baseDir, 'zkir', `${id}.bzkir`))); }
}
