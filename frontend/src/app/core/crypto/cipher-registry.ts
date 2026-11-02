import { Cipher } from './cipher.interface';
import { AesGcmCipher } from './aes-gcm.cipher';

const ciphers: Cipher[] = [new AesGcmCipher()];

export const cipherRegistry = {
  get current(): Cipher {
    return ciphers[0];
  },
  resolve(algorithm: string, version: number): Cipher {
    const cipher = ciphers.find((c) => c.algorithm === algorithm && c.version === version);
    if (!cipher) throw new Error(`Algoritmo de cifrado no soportado: ${algorithm} v${version}.`);
    return cipher;
  },
};
