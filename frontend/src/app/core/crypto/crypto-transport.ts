import { Injectable, inject } from '@angular/core';
import { CipherEnvelope } from './cipher.interface';
import { cipherRegistry } from './cipher-registry';
import { SessionKeyService } from './session-key.service';

@Injectable({ providedIn: 'root' })
export class CryptoTransport {
  private readonly sessionKey = inject(SessionKeyService);

  async wrap(body: unknown): Promise<string> {
    const key = this.requireKey();
    const envelope = await cipherRegistry.current.encrypt(JSON.stringify(body), key);
    return JSON.stringify(envelope);
  }

  async unwrap<T>(raw: string): Promise<T> {
    const key = this.requireKey();
    const envelope = JSON.parse(raw) as CipherEnvelope;
    const cipher = cipherRegistry.resolve(envelope.alg, envelope.v);
    const plaintext = await cipher.decrypt(envelope, key);
    return JSON.parse(plaintext) as T;
  }

  private requireKey(): CryptoKey {
    const key = this.sessionKey.key();
    if (!key) throw new Error('No hay una clave de sesión cargada.');
    return key;
  }
}
