import { compare, hash } from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Password is required');
  }
  return hash(plaintext, BCRYPT_ROUNDS);
}

export async function verifyPassword(plaintext, passwordHash) {
  if (typeof plaintext !== 'string' || typeof passwordHash !== 'string') {
    return false;
  }
  return compare(plaintext, passwordHash);
}
