/**
 * A small RLP encoder, enough for the shape GenLayer uses: a list holding
 * the encoded call and a flag.
 *
 * RLP has no boolean type. The Python SDK encodes `False` as an empty byte
 * string, which is 0x80, and the read path uses a single zero byte, 0x00.
 */

function encodeLength(length: number, offset: number): Uint8Array {
  if (length < 56) {
    return Uint8Array.from([offset + length]);
  }
  const lengthBytes = toMinimalBytes(BigInt(length));
  return Uint8Array.from([offset + 55 + lengthBytes.length, ...lengthBytes]);
}

function toMinimalBytes(value: bigint): number[] {
  if (value === 0n) return [0];
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0n) {
    bytes.unshift(Number(rest & 0xffn));
    rest >>= 8n;
  }
  return bytes;
}

function encodeBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 1 && bytes[0] < 0x80) {
    return bytes;
  }
  return Uint8Array.from([...encodeLength(bytes.length, 0x80), ...bytes]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Encode a list of byte strings. Each item is RLP encoded on its own. */
export function encodeRlpList(items: Uint8Array[]): Uint8Array {
  const payload = concat(items.map((item) => encodeBytes(item)));
  return concat([encodeLength(payload.length, 0xc0), payload]);
}

export function toHex(bytes: Uint8Array): `0x${string}` {
  let out = "0x";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out as `0x${string}`;
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
