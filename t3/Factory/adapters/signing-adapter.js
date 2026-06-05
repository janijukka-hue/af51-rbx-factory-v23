// t3/Factory/adapters/signing-adapter.js
// Signing Adapter - Simple HMAC-like signing

import { fnv1a32, simpleHash256 } from "./hashing-adapter.js";

export class SigningAdapter {
  constructor(options = {}) {
    this._secret = options.secret || "default-factory-secret";
  }

  sign(data) {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    const message = `${str}|${this._secret}`;
    const signature = simpleHash256(message);
    
    return {
      ok: true,
      signature,
      signedAt: Date.now()
    };
  }

  verify(data, signature) {
    const result = this.sign(data);
    const valid = result.signature === signature;
    
    return {
      ok: true,
      valid
    };
  }

  signArtifact(artifact) {
    const payload = {
      id: artifact.id,
      checksum: artifact.checksum,
      bytes: artifact.bytes,
      createdAt: artifact.createdAt
    };
    
    const { signature } = this.sign(payload);
    
    return {
      ...artifact,
      signature,
      signedAt: Date.now()
    };
  }
}

export function createSigningAdapter(options) {
  return new SigningAdapter(options);
}

export default SigningAdapter;