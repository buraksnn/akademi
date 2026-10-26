import argon2 from 'argon2';
const options = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
export const hashPassword = (password: string) => argon2.hash(password, options);
let dummy: Promise<string> | undefined;
export async function verifyPassword(hash: string | undefined, password: string) {
  const fallback = await (dummy ??= hashPassword('dummy-unmatchable-password-v1'));
  return argon2.verify(hash ?? fallback, password);
}
