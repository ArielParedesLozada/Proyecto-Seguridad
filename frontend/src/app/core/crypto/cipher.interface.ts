export interface CipherEnvelope {
  alg: string;
  v: number;
  iv: string;
  ct: string;
}

export interface Cipher {
  readonly algorithm: string;
  readonly version: number;
  encrypt(plaintext: string, key: CryptoKey): Promise<CipherEnvelope>;
  decrypt(envelope: CipherEnvelope, key: CryptoKey): Promise<string>;
}
