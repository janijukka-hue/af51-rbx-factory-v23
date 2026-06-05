// k1/vault/VaultCrypto.js — ESM (v13)
// Node.js crypto-pohjainen toteutus
// PBKDF2: 600k iteraatiota (OWASP 2024)
// AES-256-GCM + AAD + HMAC-SHA256

import crypto from "crypto";

const PBKDF2_ITER    = 600_000;
const PBKDF2_HASH    = "sha256";
const KEY_BYTES      = 32;
const HMAC_KEY_BYTES = 32;

export class VaultCrypto {
  async deriveKeyFromPassphrase(passphrase, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(passphrase, salt, PBKDF2_ITER, KEY_BYTES + HMAC_KEY_BYTES, PBKDF2_HASH, (err, dk) => {
        if (err) return reject(err);
        resolve({ aesKey: dk.slice(0, KEY_BYTES), hmacKey: dk.slice(KEY_BYTES) });
      });
    });
  }

  encryptJson(keyHandle, iv, aad, plaintextJson) {
    const pt  = Buffer.from(JSON.stringify(plaintextJson), "utf8");
    const c   = crypto.createCipheriv("aes-256-gcm", keyHandle.aesKey, iv);
    c.setAAD(aad);
    const ct  = Buffer.concat([c.update(pt), c.final()]);
    const tag = c.getAuthTag();
    return { ciphertext: ct, tag };
  }

  decryptJson(keyHandle, iv, aad, sealed) {
    const d = crypto.createDecipheriv("aes-256-gcm", keyHandle.aesKey, iv);
    d.setAAD(aad);
    d.setAuthTag(sealed.tag);
    const pt = Buffer.concat([d.update(sealed.ciphertext), d.final()]);
    return JSON.parse(pt.toString("utf8"));
  }

  hmacSha256(keyHandle, bytes) {
    return crypto.createHmac("sha256", keyHandle.hmacKey || keyHandle).update(bytes).digest();
  }

  timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  randomBytes(n)  { return crypto.randomBytes(n); }
  bytesToB64(b)   { return Buffer.from(b).toString("base64"); }
  b64ToBytes(s)   { return Buffer.from(s, "base64"); }
  utf8ToBytes(s)  { return Buffer.from(s, "utf8"); }
  bytesToUtf8(b)  { return Buffer.from(b).toString("utf8"); }
}

export const PBKDF2_ITERATIONS = PBKDF2_ITER;