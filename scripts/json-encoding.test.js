const assert = require("node:assert/strict");
const test = require("node:test");
const { decodeJsonBuffer } = require("./json-encoding");

const sample = {
  name: "Café",
  author: "José",
  colors: { surface: "#fff" },
};
const json = JSON.stringify(sample);

function utf32(text, littleEndian, bom = false) {
  const prefix = bom
    ? Buffer.from(littleEndian ? [0xff, 0xfe, 0x00, 0x00] : [0x00, 0x00, 0xfe, 0xff])
    : Buffer.alloc(0);
  const body = Buffer.alloc([...text].length * 4);
  [...text].forEach((character, index) => {
    const codePoint = character.codePointAt(0);
    if (littleEndian) body.writeUInt32LE(codePoint, index * 4);
    else body.writeUInt32BE(codePoint, index * 4);
  });
  return Buffer.concat([prefix, body]);
}

const cases = [
  ["UTF-8", Buffer.from(json, "utf8")],
  ["UTF-8 with BOM", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json)])],
  ["UTF-16 LE", Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(json, "utf16le")])],
  ["UTF-16 LE", Buffer.from(json, "utf16le")],
  ["UTF-16 BE", Buffer.concat([
    Buffer.from([0xfe, 0xff]),
    Buffer.from(json, "utf16le").swap16(),
  ])],
  ["UTF-16 BE", Buffer.from(json, "utf16le").swap16()],
  ["UTF-32 LE", utf32(json, true, true)],
  ["UTF-32 LE", utf32(json, true)],
  ["UTF-32 BE", utf32(json, false, true)],
  ["UTF-32 BE", utf32(json, false)],
];

for (const [expectedEncoding, input] of cases) {
  test(`decodes ${expectedEncoding}`, () => {
    const { value, encoding } = decodeJsonBuffer(input);
    assert.deepEqual(value, sample);
    assert.equal(encoding, expectedEncoding);
  });
}

test("decodes Windows-1252", () => {
  const input = Buffer.from(JSON.stringify({
    name: "Caf\xe9",
    author: "Jos\xe9",
    colors: { surface: "#fff" },
  }), "latin1");
  const { value, encoding } = decodeJsonBuffer(input);
  assert.deepEqual(value, sample);
  assert.equal(encoding, "Windows-1252");
});
