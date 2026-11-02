import { Cipher, CipherEnvelope } from './cipher.interface';

const IV_SIZE_BYTES = 12;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class AesGcmCipher implements Cipher {
  readonly algorithm = 'AES-256-GCM';
  readonly version = 1;

  async encrypt(plaintext: string, key: CryptoKey): Promise<CipherEnvelope> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE_BYTES));
    const data = new TextEncoder().encode(plaintext);
    const ciphertextWithTag = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

    return {
      alg: this.algorithm,
      v: this.version,
      iv: toBase64(iv),
      ct: toBase64(new Uint8Array(ciphertextWithTag)),
    };
  }

  async decrypt(envelope: CipherEnvelope, key: CryptoKey): Promise<string> {
    const iv = fromBase64(envelope.iv);
    const ciphertextWithTag = fromBase64(envelope.ct);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextWithTag);
    return new TextDecoder().decode(plaintext);
  }
}
