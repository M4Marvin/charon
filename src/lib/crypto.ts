import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

function getEncryptionKey(): string {
  return process.env.ENCRYPTION_KEY ?? "dev-encryption-key-change-in-production!";
}

export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  return symmetricEncrypt({ key: getEncryptionKey(), data: plaintext });
}

export async function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted) return "";
  try {
    return await symmetricDecrypt({ key: getEncryptionKey(), data: encrypted });
  } catch {
    return encrypted;
  }
}
