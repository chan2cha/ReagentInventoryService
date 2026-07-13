import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";
// This is a valid hash for a value that is never accepted as a real password.
// It keeps an unknown login ID on the same PBKDF2 path as a wrong password.
const DUMMY_LOGIN_PASSWORD_HASH =
  "pbkdf2:sha256:210000:7f4c19a26612b8d9704371e08ec82dc5:bcfbf7612c7971a8a0c2438eff022a4d76bc12abb86aca5b59301260c2e4ddab";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");

  return `pbkdf2:${DIGEST}:${ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, digest, iterationsRaw, salt, hash] = storedHash.split(":");

  if (scheme !== "pbkdf2" || digest !== DIGEST || !iterationsRaw || !salt || !hash) {
    return false;
  }

  const iterations = Number.parseInt(iterationsRaw, 10);

  if (!Number.isInteger(iterations) || iterations < 1) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, digest).toString("hex");
  const actualBuffer = Buffer.from(actual, "hex");

  return expected.length === actualBuffer.length && timingSafeEqual(expected, actualBuffer);
}

export function verifyLoginPassword(password: string, storedHash: string | null | undefined) {
  return verifyPassword(password, storedHash ?? DUMMY_LOGIN_PASSWORD_HASH);
}
