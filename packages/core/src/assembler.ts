import { getOpcodeByMnemonic, getOpcodeByCode } from "./opcodes.js";

/** Strip // line comments and /* * / block comments from source. */
function stripComments(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "/" && source[i + 1] === "/") {
      // Line comment: skip to end of line
      while (i < source.length && source[i] !== "\n") i++;
    } else if (source[i] === "/" && source[i + 1] === "*") {
      // Block comment: skip to */
      i += 2;
      while (
        i < source.length - 1 &&
        !(source[i] === "*" && source[i + 1] === "/")
      )
        i++;
      i += 2; // skip */
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
}

/** Parse a numeric value from hex (0x...) or decimal string. Returns a bigint. */
function parseValue(s: string): bigint {
  s = s.trim();
  if (s.startsWith("0x") || s.startsWith("0X")) {
    if (s.length <= 2) throw new Error(`Invalid hex value: ${s}`);
    return BigInt(s);
  }
  return BigInt(s);
}

/** Convert a bigint to a hex string of exactly `byteCount` bytes (no 0x prefix). */
function toHex(value: bigint, byteCount: number): string {
  if (value < 0n) throw new Error(`Negative value not allowed: ${value}`);
  const maxValue = (1n << BigInt(byteCount * 8)) - 1n;
  if (value > maxValue) {
    throw new Error(
      `Value ${value} does not fit in ${byteCount} byte(s) (max ${maxValue})`
    );
  }
  return value.toString(16).padStart(byteCount * 2, "0");
}

/**
 * Assemble mnemonic source into bytecode (hex string).
 *
 * Input format (one instruction per line):
 *   PUSH1 0x60
 *   PUSH1 0x80
 *   MSTORE
 *   STOP
 *
 * Immediate values for PUSH opcodes can be given as:
 *   - Hex: 0x60, 0xFF
 *   - Decimal: 96, 255
 *
 * Empty lines and comments (// and block) are ignored.
 */
export function assemble(source: string): string {
  const stripped = stripComments(source);
  const lines = stripped.split("\n");
  let output = "";

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum].trim();
    if (line === "") continue;

    const parts = line.split(/\s+/);
    const mnemonic = parts[0].toUpperCase();
    const info = getOpcodeByMnemonic(mnemonic);

    if (!info) {
      throw new Error(`Unknown mnemonic "${parts[0]}" on line ${lineNum + 1}`);
    }

    output += info.code.toString(16).padStart(2, "0");

    if (info.immediateBytes > 0) {
      if (parts.length < 2) {
        throw new Error(
          `${mnemonic} requires a ${info.immediateBytes}-byte immediate value on line ${lineNum + 1}`
        );
      }
      try {
        const value = parseValue(parts[1]);
        output += toHex(value, info.immediateBytes);
      } catch (e) {
        throw new Error(
          `Invalid immediate value for ${mnemonic} on line ${lineNum + 1}: ${(e as Error).message}`
        );
      }
    }
  }

  return "0x" + output;
}

/** Disassemble bytecode (hex string) into mnemonic source. */
export function disassemble(bytecode: string): string {
  let hex = bytecode;
  if (hex.startsWith("0x") || hex.startsWith("0X")) {
    hex = hex.slice(2);
  }
  hex = hex.toLowerCase();

  if (hex.length % 2 !== 0) {
    throw new Error("Bytecode has odd number of hex characters");
  }
  if (!/^[0-9a-f]*$/.test(hex)) {
    throw new Error("Bytecode contains non-hex characters");
  }

  const lines: string[] = [];
  let i = 0;

  while (i < hex.length) {
    const opByte = parseInt(hex.slice(i, i + 2), 16);
    i += 2;

    const info = getOpcodeByCode(opByte);
    if (!info) {
      lines.push(`INVALID(0x${opByte.toString(16).padStart(2, "0")})`);
      continue;
    }

    if (info.immediateBytes > 0) {
      const dataHex = hex.slice(i, i + info.immediateBytes * 2);
      i += info.immediateBytes * 2;

      if (dataHex.length < info.immediateBytes * 2) {
        lines.push(`${info.mnemonic} 0x${dataHex} // truncated`);
      } else {
        lines.push(`${info.mnemonic} 0x${dataHex}`);
      }
    } else {
      lines.push(info.mnemonic);
    }
  }

  return lines.join("\n");
}
