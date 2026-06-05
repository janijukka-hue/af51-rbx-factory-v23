// t3/Factory/adapters/compression-adapter.js
// Compression Adapter - Simple RLE compression

export class CompressionAdapter {
  constructor(options = {}) {
    this._level = options.level || "normal";
  }

  compress(data) {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    const compressed = this._rleEncode(str);
    
    return {
      ok: true,
      original: str.length,
      compressed: compressed.length,
      ratio: compressed.length / str.length,
      data: compressed
    };
  }

  decompress(compressed) {
    const decompressed = this._rleDecode(compressed);
    return {
      ok: true,
      data: decompressed
    };
  }

  _rleEncode(str) {
    if (!str) return "";
    let result = "";
    let count = 1;
    
    for (let i = 1; i <= str.length; i++) {
      if (i < str.length && str[i] === str[i - 1] && count < 9) {
        count++;
      } else {
        if (count > 2) {
          result += `\x00${count}${str[i - 1]}`;
        } else {
          result += str[i - 1].repeat(count);
        }
        count = 1;
      }
    }
    
    return result;
  }

  _rleDecode(str) {
    if (!str) return "";
    let result = "";
    let i = 0;
    
    while (i < str.length) {
      if (str[i] === "\x00" && i + 2 < str.length) {
        const count = parseInt(str[i + 1], 10);
        const char = str[i + 2];
        result += char.repeat(count);
        i += 3;
      } else {
        result += str[i];
        i++;
      }
    }
    
    return result;
  }
}

export function createCompressionAdapter(options) {
  return new CompressionAdapter(options);
}

export default CompressionAdapter;