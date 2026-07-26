const { TextDecoder } = require("util");

function decodeUtf32(buffer, littleEndian, offset) {
  const chunks = [];
  let codePoints = [];

  if ((buffer.length - offset) % 4 !== 0) {
    throw new Error("invalid UTF-32 byte length");
  }

  for (let i = offset; i < buffer.length; i += 4) {
    const codePoint = littleEndian
      ? buffer.readUInt32LE(i)
      : buffer.readUInt32BE(i);

    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      throw new Error("invalid UTF-32 code point");
    }
    codePoints.push(codePoint);
    if (codePoints.length === 4096) {
      chunks.push(String.fromCodePoint(...codePoints));
      codePoints = [];
    }
  }

  chunks.push(String.fromCodePoint(...codePoints));
  return chunks.join("");
}

function looksLikeUtf32(buffer, littleEndian) {
  const groups = Math.min(Math.floor(buffer.length / 4), 16);
  if (!groups) return false;

  let matches = 0;
  for (let i = 0; i < groups * 4; i += 4) {
    const bytes = littleEndian
      ? [buffer[i + 1], buffer[i + 2], buffer[i + 3]]
      : [buffer[i], buffer[i + 1], buffer[i + 2]];
    if (bytes.every(byte => byte === 0)) matches++;
  }
  return matches / groups >= 0.75;
}

function looksLikeUtf16(buffer, littleEndian) {
  const pairs = Math.min(Math.floor(buffer.length / 2), 32);
  if (!pairs) return false;

  let matches = 0;
  for (let i = 0; i < pairs * 2; i += 2) {
    if (buffer[i + (littleEndian ? 1 : 0)] === 0) matches++;
  }
  return matches / pairs >= 0.75;
}

function decodeJsonBuffer(buffer) {
  let text;
  let encoding;

  if (buffer.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0xfe, 0xff]))) {
    text = decodeUtf32(buffer, false, 4);
    encoding = "UTF-32 BE";
  } else if (buffer.subarray(0, 4).equals(Buffer.from([0xff, 0xfe, 0x00, 0x00]))) {
    text = decodeUtf32(buffer, true, 4);
    encoding = "UTF-32 LE";
  } else if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(3));
    encoding = "UTF-8 with BOM";
  } else if (buffer.subarray(0, 2).equals(Buffer.from([0xfe, 0xff]))) {
    text = new TextDecoder("utf-16be", { fatal: true }).decode(buffer.subarray(2));
    encoding = "UTF-16 BE";
  } else if (buffer.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))) {
    text = new TextDecoder("utf-16le", { fatal: true }).decode(buffer.subarray(2));
    encoding = "UTF-16 LE";
  } else if (looksLikeUtf32(buffer, false)) {
    text = decodeUtf32(buffer, false, 0);
    encoding = "UTF-32 BE";
  } else if (looksLikeUtf32(buffer, true)) {
    text = decodeUtf32(buffer, true, 0);
    encoding = "UTF-32 LE";
  } else if (looksLikeUtf16(buffer, false)) {
    text = new TextDecoder("utf-16be", { fatal: true }).decode(buffer);
    encoding = "UTF-16 BE";
  } else if (looksLikeUtf16(buffer, true)) {
    text = new TextDecoder("utf-16le", { fatal: true }).decode(buffer);
    encoding = "UTF-16 LE";
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      encoding = "UTF-8";
    } catch {
      text = new TextDecoder("windows-1252", { fatal: true }).decode(buffer);
      encoding = "Windows-1252";
    }
  }

  return {
    value: JSON.parse(text.replace(/^\uFEFF/, "")),
    encoding,
  };
}

module.exports = { decodeJsonBuffer };
