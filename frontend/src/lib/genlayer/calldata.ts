/**
 * GenLayer calldata codec.
 *
 * GenLayer does not use the EVM ABI for contract calls. It has its own
 * compact encoding, and the contract arguments are wrapped in RLP before they
 * travel to the node. This is a faithful port of the encoding used by the
 * Python SDK, verified byte for byte against it.
 *
 * Layout of a value:
 *   - the first byte holds a 3 bit type plus, for some types, the length
 *   - a string is  TYPE_STR  (4) followed by its length and its utf-8 bytes
 *   - a map is    TYPE_MAP  (6) followed by the number of pairs, then the
 *                 sorted keys and their values
 *   - an array is TYPE_ARR  (5) followed by the item count
 *   - a positive integer is TYPE_PINT (1) followed by the value
 *   - an address is SPECIAL_ADDR (24) followed by its 20 raw bytes
 */

const BITS_IN_TYPE = 3;

const TYPE_SPECIAL = 0;
const TYPE_PINT = 1;
const TYPE_NINT = 2;
const TYPE_BYTES = 3;
const TYPE_STR = 4;
const TYPE_ARR = 5;
const TYPE_MAP = 6;

const SPECIAL_NULL = 0;
const SPECIAL_FALSE = 8;
const SPECIAL_TRUE = 16;
const SPECIAL_ADDR = 24;

const ADDRESS_SIZE = 20;

/**
 * A 20 byte address. The codec needs to tell an address apart from a plain
 * string, because the contract validates the type of the argument.
 */
export type GenLayerAddress = {
  readonly __genlayerAddress: `0x${string}`;
};

export type CalldataValue =
  | null
  | undefined
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | GenLayerAddress
  | CalldataValue[]
  | { [key: string]: CalldataValue };

/** Mark a hex string as an address argument. */
export function address(value: `0x${string}`): GenLayerAddress {
  return { __genlayerAddress: value };
}

function isAddress(value: unknown): value is GenLayerAddress {
  return (
    typeof value === "object" &&
    value !== null &&
    "__genlayerAddress" in value &&
    typeof (value as GenLayerAddress).__genlayerAddress === "string"
  );
}

function addressToBytes(value: `0x${string}`): Uint8Array {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (hex.length !== ADDRESS_SIZE * 2) {
    throw new Error(`invalid address ${value}`);
  }
  const out = new Uint8Array(ADDRESS_SIZE);
  for (let i = 0; i < ADDRESS_SIZE; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

class ByteWriter {
  private chunks: number[] = [];

  push(...bytes: number[]) {
    this.chunks.push(...bytes);
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

function appendUleb128(writer: ByteWriter, value: number | bigint) {
  let rest = typeof value === "bigint" ? value : BigInt(value);
  if (rest < 0n) throw new Error("uleb128 cannot encode a negative number");
  if (rest === 0n) {
    writer.push(0);
    return;
  }
  while (rest > 0n) {
    let current = Number(rest & 0x7fn);
    rest >>= 7n;
    if (rest > 0n) current |= 0x80;
    writer.push(current);
  }
}

/** Encode a method call into the GenLayer calldata format. */
export function encodeCalldata(value: CalldataValue): Uint8Array {
  const writer = new ByteWriter();

  const encode = (input: CalldataValue) => {
    if (input === null || input === undefined) {
      writer.push(SPECIAL_NULL);
      return;
    }
    if (input === true) {
      writer.push(SPECIAL_TRUE);
      return;
    }
    if (input === false) {
      writer.push(SPECIAL_FALSE);
      return;
    }
    if (typeof input === "bigint") {
      encodeInteger(writer, input);
      return;
    }
    if (typeof input === "number") {
      if (!Number.isInteger(input)) {
        throw new Error(`calldata only encodes whole numbers, got ${input}`);
      }
      encodeInteger(writer, BigInt(input));
      return;
    }
    if (isAddress(input)) {
      writer.push(SPECIAL_ADDR);
      writer.push(...addressToBytes(input.__genlayerAddress));
      return;
    }
    if (typeof input === "string") {
      const bytes = utf8(input);
      // The type and the length live in the same uleb128 value.
      appendUleb128(writer, (BigInt(bytes.length) << BigInt(BITS_IN_TYPE)) | BigInt(TYPE_STR));
      writer.push(...bytes);
      return;
    }
    if (input instanceof Uint8Array) {
      appendUleb128(writer, (BigInt(input.length) << BigInt(BITS_IN_TYPE)) | BigInt(TYPE_BYTES));
      writer.push(...input);
      return;
    }
    if (Array.isArray(input)) {
      appendUleb128(writer, (BigInt(input.length) << BigInt(BITS_IN_TYPE)) | BigInt(TYPE_ARR));
      for (const item of input) encode(item);
      return;
    }
    const entries = Object.entries(input as Record<string, CalldataValue>);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    appendUleb128(writer, (BigInt(entries.length) << BigInt(BITS_IN_TYPE)) | BigInt(TYPE_MAP));
    for (const [key, item] of entries) {
      const keyBytes = utf8(key);
      appendUleb128(writer, keyBytes.length);
      writer.push(...keyBytes);
      encode(item);
    }
  };

  encode(value);
  return writer.toBytes();
}

function encodeInteger(writer: ByteWriter, value: bigint) {
  if (value >= 0n) {
    appendUleb128(writer, (value << BigInt(BITS_IN_TYPE)) | BigInt(TYPE_PINT));
    return;
  }
  const flipped = -value - 1n;
  appendUleb128(writer, (flipped << BigInt(BITS_IN_TYPE)) | BigInt(TYPE_NINT));
}

/** Build the calldata object for a contract method. */
export function makeCalldataObject(
  method: string | null,
  args: CalldataValue[] = [],
  kwargs: Record<string, CalldataValue> = {},
): Record<string, CalldataValue> {
  const result: Record<string, CalldataValue> = {};
  if (method !== null) result.method = method;
  if (args.length > 0) result.args = args;
  if (Object.keys(kwargs).length > 0) result.kwargs = kwargs;
  return result;
}

/** Decode a value that came back from a node. */
export function decodeCalldata(bytes: Uint8Array): CalldataValue {
  let offset = 0;

  const readUleb128 = (): number => {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = bytes[offset];
      offset += 1;
      result |= (byte & 0x7f) << shift;
      shift += 7;
      if ((byte & 0x80) === 0) break;
    }
    return result >>> 0;
  };

  const readValue = (): CalldataValue => {
    const code = readUleb128();
    const type = code & 0x7;

    if (type === TYPE_SPECIAL) {
      if (code === SPECIAL_NULL) return null;
      if (code === SPECIAL_FALSE) return false;
      if (code === SPECIAL_TRUE) return true;
      if (code === SPECIAL_ADDR) {
        const raw = bytes.slice(offset, offset + ADDRESS_SIZE);
        offset += ADDRESS_SIZE;
        return address(`0x${Buffer.from(raw).toString("hex")}` as `0x${string}`);
      }
      throw new Error(`unknown special code ${code}`);
    }

    const length = code >>> BITS_IN_TYPE;

    if (type === TYPE_PINT) return length;
    if (type === TYPE_NINT) return -length - 1;
    if (type === TYPE_BYTES) {
      const raw = bytes.slice(offset, offset + length);
      offset += length;
      return raw;
    }
    if (type === TYPE_STR) {
      const raw = bytes.slice(offset, offset + length);
      offset += length;
      return new TextDecoder().decode(raw);
    }
    if (type === TYPE_ARR) {
      const items: CalldataValue[] = [];
      for (let i = 0; i < length; i += 1) items.push(readValue());
      return items;
    }
    if (type === TYPE_MAP) {
      const entries: Record<string, CalldataValue> = {};
      for (let i = 0; i < length; i += 1) {
        const keyLength = readUleb128();
        const key = new TextDecoder().decode(bytes.slice(offset, offset + keyLength));
        offset += keyLength;
        entries[key] = readValue();
      }
      return entries;
    }

    throw new Error(`unknown calldata type ${type}`);
  };

  const value = readValue();
  if (offset !== bytes.length) {
    throw new Error("calldata decoder did not consume the whole buffer");
  }
  return value;
}
