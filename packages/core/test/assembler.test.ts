import { describe, it, expect } from "vitest";
import { assemble, disassemble, getAllOpcodes } from "../src/index.js";

describe("assemble", () => {
  it("assembles a single STOP", () => {
    expect(assemble("STOP")).toBe("0x00");
  });

  it("assembles PUSH1 with hex value", () => {
    expect(assemble("PUSH1 0x42")).toBe("0x6042");
  });

  it("assembles PUSH1 with decimal value", () => {
    expect(assemble("PUSH1 66")).toBe("0x6042");
  });

  it("pads small values to the correct width", () => {
    expect(assemble("PUSH2 0x01")).toBe("0x610001");
  });

  it("assembles a multi-line program", () => {
    const source = `
      PUSH1 0x42
      PUSH1 0x00
      MSTORE
      STOP
    `;
    expect(assemble(source)).toBe("0x6042600052" + "00");
  });

  it("assembles PUSH0", () => {
    expect(assemble("PUSH0")).toBe("0x5f");
  });

  it("assembles PUSH32 with a full 32-byte value", () => {
    const val = "0x" + "ff".repeat(32);
    expect(assemble(`PUSH32 ${val}`)).toBe("0x7f" + "ff".repeat(32));
  });

  it("is case-insensitive", () => {
    expect(assemble("push1 0x42")).toBe("0x6042");
    expect(assemble("Stop")).toBe("0x00");
  });

  it("ignores empty lines", () => {
    expect(assemble("\n\nSTOP\n\n")).toBe("0x00");
  });

  it("returns 0x for empty input", () => {
    expect(assemble("")).toBe("0x");
    expect(assemble("  \n  \n  ")).toBe("0x");
  });

  describe("comments", () => {
    it("strips // line comments", () => {
      const source = `
        // This is a comment
        PUSH1 0x42 // push 0x42
        STOP
      `;
      expect(assemble(source)).toBe("0x604200");
    });

    it("strips /* */ block comments", () => {
      const source = `
        /* Store 0x42 at offset 0 */
        PUSH1 0x42
        PUSH1 0x00
        MSTORE
        STOP
      `;
      expect(assemble(source)).toBe("0x604260005200");
    });

    it("strips inline block comments", () => {
      const source = "PUSH1 /* the answer */ 0x42";
      expect(assemble(source)).toBe("0x6042");
    });

    it("strips multi-line block comments", () => {
      const source = `
        PUSH1 0x01
        /*
         * This whole block
         * is a comment
         */
        PUSH1 0x02
      `;
      expect(assemble(source)).toBe("0x60016002");
    });
  });

  describe("error cases", () => {
    it("throws on unknown mnemonic", () => {
      expect(() => assemble("FOOBAR")).toThrow(/Unknown mnemonic "FOOBAR"/);
    });

    it("throws on missing immediate value", () => {
      expect(() => assemble("PUSH1")).toThrow(/requires a 1-byte immediate/);
    });

    it("throws on value too large for PUSH1", () => {
      expect(() => assemble("PUSH1 0x100")).toThrow(/does not fit in 1 byte/);
    });

    it("throws on invalid hex", () => {
      expect(() => assemble("PUSH1 0xGG")).toThrow();
    });

    it("includes line number in error", () => {
      expect(() => assemble("STOP\nBADOP")).toThrow(/line 2/);
    });
  });
});

describe("disassemble", () => {
  it("disassembles STOP", () => {
    expect(disassemble("0x00")).toBe("STOP");
  });

  it("disassembles PUSH1 with data", () => {
    expect(disassemble("0x6042")).toBe("PUSH1 0x42");
  });

  it("disassembles a multi-instruction bytecode", () => {
    expect(disassemble("0x60426000520000")).toBe(
      "PUSH1 0x42\nPUSH1 0x00\nMSTORE\nSTOP\nSTOP"
    );
  });

  it("disassembles PUSH0", () => {
    expect(disassemble("0x5f")).toBe("PUSH0");
  });

  it("handles unknown opcodes", () => {
    expect(disassemble("0x0c")).toBe("INVALID(0x0c)");
  });

  it("handles truncated PUSH data", () => {
    const result = disassemble("0x61ff");
    expect(result).toContain("PUSH2");
    expect(result).toContain("truncated");
  });

  it("handles empty bytecode", () => {
    expect(disassemble("0x")).toBe("");
    expect(disassemble("")).toBe("");
  });

  it("handles bytecode without 0x prefix", () => {
    expect(disassemble("6042")).toBe("PUSH1 0x42");
  });

  it("throws on odd-length hex", () => {
    expect(() => disassemble("0x604")).toThrow(/odd number/);
  });

  it("throws on non-hex characters", () => {
    expect(() => disassemble("0xZZ")).toThrow(/non-hex/);
  });
});

describe("round-trip", () => {
  it("disassemble(assemble(source)) preserves instructions", () => {
    const source = `PUSH1 0x42\nPUSH1 0x00\nMSTORE\nSTOP`;
    expect(disassemble(assemble(source))).toBe(source);
  });

  it("round-trips PUSH0", () => {
    expect(disassemble(assemble("PUSH0"))).toBe("PUSH0");
  });

  it("round-trips arithmetic opcodes", () => {
    const source = "PUSH1 0x02\nPUSH1 0x03\nADD";
    expect(disassemble(assemble(source))).toBe(source);
  });

  it("round-trips DUP and SWAP", () => {
    const source = "PUSH1 0x01\nDUP1\nSWAP1";
    expect(disassemble(assemble(source))).toBe(source);
  });

  it("round-trips a realistic program", () => {
    const source = [
      "PUSH1 0x80",
      "PUSH1 0x40",
      "MSTORE",
      "CALLVALUE",
      "ISZERO",
      "PUSH1 0x0e",
      "JUMPI",
      "PUSH1 0x00",
      "DUP1",
      "REVERT",
      "JUMPDEST",
      "STOP",
    ].join("\n");
    expect(disassemble(assemble(source))).toBe(source);
  });
});

describe("opcode table", () => {
  const opcodes = getAllOpcodes();

  it("has no duplicate codes", () => {
    const codes = opcodes.map((o) => o.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has no duplicate mnemonics", () => {
    const mnemonics = opcodes.map((o) => o.mnemonic);
    expect(new Set(mnemonics).size).toBe(mnemonics.length);
  });

  it("has all PUSH variants (PUSH0 through PUSH32)", () => {
    for (let i = 0; i <= 32; i++) {
      const name = i === 0 ? "PUSH0" : `PUSH${i}`;
      const info = opcodes.find((o) => o.mnemonic === name);
      expect(info, `Missing ${name}`).toBeDefined();
      expect(info!.immediateBytes).toBe(i === 0 ? 0 : i);
    }
  });

  it("has all DUP variants (DUP1 through DUP16)", () => {
    for (let i = 1; i <= 16; i++) {
      expect(
        opcodes.find((o) => o.mnemonic === `DUP${i}`),
        `Missing DUP${i}`
      ).toBeDefined();
    }
  });

  it("has all SWAP variants (SWAP1 through SWAP16)", () => {
    for (let i = 1; i <= 16; i++) {
      expect(
        opcodes.find((o) => o.mnemonic === `SWAP${i}`),
        `Missing SWAP${i}`
      ).toBeDefined();
    }
  });

  it("has all LOG variants (LOG0 through LOG4)", () => {
    for (let i = 0; i <= 4; i++) {
      expect(
        opcodes.find((o) => o.mnemonic === `LOG${i}`),
        `Missing LOG${i}`
      ).toBeDefined();
    }
  });
});
