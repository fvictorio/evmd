import type { OpcodeInfo } from "./types.js";

// Helper to reduce boilerplate for simple opcodes
function op(
  code: number,
  mnemonic: string,
  inputNames: string[],
  outputNames: string[],
  immediateBytes = 0
): OpcodeInfo {
  return { code, mnemonic, inputNames, outputNames, immediateBytes };
}

const opcodeTable: OpcodeInfo[] = [
  // 0x00s: Stop and Arithmetic
  op(0x00, "STOP", [], []),
  op(0x01, "ADD", ["a", "b"], ["sum"]),
  op(0x02, "MUL", ["a", "b"], ["product"]),
  op(0x03, "SUB", ["a", "b"], ["difference"]),
  op(0x04, "DIV", ["a", "b"], ["quotient"]),
  op(0x05, "SDIV", ["a", "b"], ["quotient"]),
  op(0x06, "MOD", ["a", "b"], ["remainder"]),
  op(0x07, "SMOD", ["a", "b"], ["remainder"]),
  op(0x08, "ADDMOD", ["a", "b", "N"], ["result"]),
  op(0x09, "MULMOD", ["a", "b", "N"], ["result"]),
  op(0x0a, "EXP", ["a", "exponent"], ["result"]),
  op(0x0b, "SIGNEXTEND", ["b", "x"], ["result"]),

  // 0x10s: Comparison & Bitwise Logic
  op(0x10, "LT", ["a", "b"], ["result"]),
  op(0x11, "GT", ["a", "b"], ["result"]),
  op(0x12, "SLT", ["a", "b"], ["result"]),
  op(0x13, "SGT", ["a", "b"], ["result"]),
  op(0x14, "EQ", ["a", "b"], ["result"]),
  op(0x15, "ISZERO", ["a"], ["result"]),
  op(0x16, "AND", ["a", "b"], ["result"]),
  op(0x17, "OR", ["a", "b"], ["result"]),
  op(0x18, "XOR", ["a", "b"], ["result"]),
  op(0x19, "NOT", ["a"], ["result"]),
  op(0x1a, "BYTE", ["i", "x"], ["result"]),
  op(0x1b, "SHL", ["shift", "value"], ["result"]),
  op(0x1c, "SHR", ["shift", "value"], ["result"]),
  op(0x1d, "SAR", ["shift", "value"], ["result"]),

  // 0x20: Keccak256
  op(0x20, "KECCAK256", ["offset", "size"], ["hash"]),

  // 0x30s: Environmental Information
  op(0x30, "ADDRESS", [], ["address"]),
  op(0x31, "BALANCE", ["address"], ["balance"]),
  op(0x32, "ORIGIN", [], ["address"]),
  op(0x33, "CALLER", [], ["address"]),
  op(0x34, "CALLVALUE", [], ["value"]),
  op(0x35, "CALLDATALOAD", ["i"], ["data"]),
  op(0x36, "CALLDATASIZE", [], ["size"]),
  op(0x37, "CALLDATACOPY", ["destOffset", "offset", "size"], []),
  op(0x38, "CODESIZE", [], ["size"]),
  op(0x39, "CODECOPY", ["destOffset", "offset", "size"], []),
  op(0x3a, "GASPRICE", [], ["price"]),
  op(0x3b, "EXTCODESIZE", ["address"], ["size"]),
  op(0x3c, "EXTCODECOPY", ["address", "destOffset", "offset", "size"], []),
  op(0x3d, "RETURNDATASIZE", [], ["size"]),
  op(0x3e, "RETURNDATACOPY", ["destOffset", "offset", "size"], []),
  op(0x3f, "EXTCODEHASH", ["address"], ["hash"]),

  // 0x40s: Block Information
  op(0x40, "BLOCKHASH", ["blockNumber"], ["hash"]),
  op(0x41, "COINBASE", [], ["address"]),
  op(0x42, "TIMESTAMP", [], ["timestamp"]),
  op(0x43, "NUMBER", [], ["blockNumber"]),
  op(0x44, "PREVRANDAO", [], ["prevRandao"]),
  op(0x45, "GASLIMIT", [], ["gasLimit"]),
  op(0x46, "CHAINID", [], ["chainId"]),
  op(0x47, "SELFBALANCE", [], ["balance"]),
  op(0x48, "BASEFEE", [], ["baseFee"]),

  // 0x50s: Stack, Memory, Storage and Flow
  op(0x50, "POP", ["value"], []),
  op(0x51, "MLOAD", ["offset"], ["value"]),
  op(0x52, "MSTORE", ["offset", "value"], []),
  op(0x53, "MSTORE8", ["offset", "value"], []),
  op(0x54, "SLOAD", ["key"], ["value"]),
  op(0x55, "SSTORE", ["key", "value"], []),
  op(0x56, "JUMP", ["dest"], []),
  op(0x57, "JUMPI", ["dest", "cond"], []),
  op(0x58, "PC", [], ["counter"]),
  op(0x59, "MSIZE", [], ["size"]),
  op(0x5a, "GAS", [], ["gas"]),
  op(0x5b, "JUMPDEST", [], []),
  op(0x5c, "TLOAD", ["key"], ["value"]),
  op(0x5d, "TSTORE", ["key", "value"], []),
  op(0x5e, "MCOPY", ["destOffset", "offset", "size"], []),

  // 0x5f: PUSH0
  op(0x5f, "PUSH0", [], ["value"]),

  // 0x60-0x7f: PUSH1 through PUSH32
  ...Array.from({ length: 32 }, (_, i) =>
    op(0x60 + i, `PUSH${i + 1}`, [], ["value"], i + 1)
  ),

  // 0x80-0x8f: DUP1 through DUP16
  ...Array.from({ length: 16 }, (_, i) =>
    op(0x80 + i, `DUP${i + 1}`, [`value${i + 1}`], [`value${i + 1}`, "copy"])
  ),

  // 0x90-0x9f: SWAP1 through SWAP16
  ...Array.from({ length: 16 }, (_, i) =>
    op(0x90 + i, `SWAP${i + 1}`, ["a", `b`], ["b", "a"])
  ),

  // 0xa0-0xa4: LOG0 through LOG4
  op(0xa0, "LOG0", ["offset", "size"], []),
  op(0xa1, "LOG1", ["offset", "size", "topic1"], []),
  op(0xa2, "LOG2", ["offset", "size", "topic1", "topic2"], []),
  op(0xa3, "LOG3", ["offset", "size", "topic1", "topic2", "topic3"], []),
  op(
    0xa4,
    "LOG4",
    ["offset", "size", "topic1", "topic2", "topic3", "topic4"],
    []
  ),

  // 0xf0s: System
  op(0xf0, "CREATE", ["value", "offset", "size"], ["address"]),
  op(
    0xf1,
    "CALL",
    ["gas", "address", "value", "argsOffset", "argsLength", "retOffset", "retLength"],
    ["success"]
  ),
  op(
    0xf2,
    "CALLCODE",
    ["gas", "address", "value", "argsOffset", "argsLength", "retOffset", "retLength"],
    ["success"]
  ),
  op(0xf3, "RETURN", ["offset", "size"], []),
  op(
    0xf4,
    "DELEGATECALL",
    ["gas", "address", "argsOffset", "argsLength", "retOffset", "retLength"],
    ["success"]
  ),
  op(0xf5, "CREATE2", ["value", "offset", "size", "salt"], ["address"]),
  op(
    0xfa,
    "STATICCALL",
    ["gas", "address", "argsOffset", "argsLength", "retOffset", "retLength"],
    ["success"]
  ),
  op(0xfd, "REVERT", ["offset", "size"], []),
  op(0xfe, "INVALID", [], []),
  op(0xff, "SELFDESTRUCT", ["address"], []),
];

const byCode = new Map<number, OpcodeInfo>();
const byMnemonic = new Map<string, OpcodeInfo>();

for (const info of opcodeTable) {
  byCode.set(info.code, info);
  byMnemonic.set(info.mnemonic, info);
}

export function getOpcodeByCode(code: number): OpcodeInfo | undefined {
  return byCode.get(code);
}

export function getOpcodeByMnemonic(
  mnemonic: string
): OpcodeInfo | undefined {
  return byMnemonic.get(mnemonic);
}

export function getAllOpcodes(): OpcodeInfo[] {
  return [...opcodeTable];
}
