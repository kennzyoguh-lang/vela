import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashToken(plain: string): Promise<string> {
  // Same algorithm as passwords for backup codes/refresh tokens (Handbook 8.3) —
  // never stored plaintext, never stored encrypted-but-reversible.
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyTokenHash(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
