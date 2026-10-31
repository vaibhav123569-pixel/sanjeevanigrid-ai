import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist');
const publicDirectory = resolve('public');

await rm(publicDirectory, { recursive: true, force: true });
await cp(output, publicDirectory, { recursive: true });
