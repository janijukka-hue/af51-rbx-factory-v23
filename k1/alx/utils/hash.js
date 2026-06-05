// k1/alx/utils/hash.js
// K1 Hash Utilities - Ei riippuvuuksia muihin kerroksiin

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
  var high = fnv1a32(str + "_high");
  var low = fnv1a32(str + "_low");
  return high.toString(16).padStart(8, "0") + low.toString(16).padStart(8, "0");
}

export function simpleHash256(str) {
  var parts = [];
  for (var i = 0; i < 8; i++) {
    parts.push(fnv1a32(str + "_p" + i).toString(16).padStart(8, "0"));
  }
  return parts.join("");
}

export default {
  fnv1a32,
  fnv1a64,
  simpleHash256
};