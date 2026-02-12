import type { OpcodeInfo } from "./types.js";

// Stub: only a few opcodes for now. Will be filled in completely later.
const opcodeTable: OpcodeInfo[] = [
  {
    code: 0x00,
    mnemonic: "STOP",
    inputNames: [],
    outputNames: [],
    immediateBytes: 0,
  },
  {
    code: 0x01,
    mnemonic: "ADD",
    inputNames: ["a", "b"],
    outputNames: ["sum"],
    immediateBytes: 0,
  },
  {
    code: 0x60,
    mnemonic: "PUSH1",
    inputNames: [],
    outputNames: ["value"],
    immediateBytes: 1,
  },
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
