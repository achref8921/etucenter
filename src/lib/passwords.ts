import { randomInt } from "node:crypto";

export function generateTemporaryPassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[randomInt(chars.length)];
  }
  return password;
}
