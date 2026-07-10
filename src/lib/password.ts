import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

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
