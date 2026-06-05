// t3/Factory/adapters/hashing-adapter.js
// Hashing Adapter - Pure JavaScript (React Native compatible)

export function fnv1a32(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash = hash >>> 0;
  }
  return hash >>> 0;
}

export function fnv1a64(str) {
  const high = fnv1a32(str + "_high");
  const low = fnv1a32(str + "_low");
  return `${high.toString(16).padStart(8, "0")}${low.toString(16).padStart(8, "0")}`;
}

export function simpleHash256(str) {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    parts.push(fnv1a32(str + "_p" + i).toString(16).padStart(8, "0"));
  }
  return parts.join("");
}

export class HashingAdapter {
  constructor(options = {}) {
    this._algorithm = options.algorithm || "fnv1a";
  }

  hash(data) {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    return fnv1a32(str).toString(16).padStart(8, "0");
  }

  hash64(data) {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    return fnv1a64(str);
  }

  hash256(data) {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    return simpleHash256(str);
  }

  hashFiles(files) {
    const combined = files
      .map(f => `${f.path}:${f.content || ""}`)
      .sort()
      .join("|");
    return this.hash256(combined);
  }

  verify(data, expectedHash) {
    const actual = this.hash(data);
    return actual === expectedHash;
  }
}

export function createHashingAdapter(options) {
  return new HashingAdapter(options);
}

export default HashingAdapter;