import { useMemo, useEffect, useRef } from "react";
import type { DebugSession } from "@evmd/core";
import { getOpcodeByCode } from "@evmd/core";

interface DisassembledInstruction {
  pc: number;
  mnemonic: string;
  operand?: string;
  /** Human-readable decoded form of the immediate (e.g. "DUP17", "SWAP17", "1↔2"). */
  annotation?: string;
}

/** Decode an EIP-8024 immediate byte into a human-readable annotation. */
function decodeAnnotation(mnemonic: string, immediateHex: string): string | null {
  const x = parseInt(immediateHex, 16);
  if (isNaN(x)) return null;

  if (mnemonic === "DUPN") {
    const n = (x + 145) % 256;
    return `DUP${n}`;
  }
  if (mnemonic === "SWAPN") {
    const n = (x + 145) % 256;
    return `SWAP${n}`;
  }
  if (mnemonic === "EXCHANGE") {
    const k = x ^ 143;
    const q = Math.floor(k / 16);
    const r = k % 16;
    // decode_pair: returns (n, m) where EXCHANGE swaps the 0-indexed stack
    // positions n and m (equivalent to the EIP's "(n+1)th and (m+1)th items")
    const [n, m] = q < r ? [q + 1, r + 1] : [r + 1, 29 - q];
    return `[${n}↔${m}]`;
  }
  return null;
}

function disassembleWithPc(bytecode: string): DisassembledInstruction[] {
  let hex = bytecode;
  if (hex.startsWith("0x") || hex.startsWith("0X")) {
    hex = hex.slice(2);
  }
  hex = hex.toLowerCase();

  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) {
    return [];
  }

  const instructions: DisassembledInstruction[] = [];
  let pc = 0;

  while (pc * 2 < hex.length) {
    const opByte = parseInt(hex.slice(pc * 2, pc * 2 + 2), 16);
    const info = getOpcodeByCode(opByte);
    const instrPc = pc;
    pc++;

    if (!info) {
      instructions.push({
        pc: instrPc,
        mnemonic: `INVALID(0x${opByte.toString(16).padStart(2, "0")})`,
      });
      continue;
    }

    if (info.immediateBytes > 0) {
      const dataHex = hex.slice(pc * 2, pc * 2 + info.immediateBytes * 2);
      pc += info.immediateBytes;
      instructions.push({
        pc: instrPc,
        mnemonic: info.mnemonic,
        operand: dataHex.length > 0 ? `0x${dataHex}` : undefined,
        annotation: decodeAnnotation(info.mnemonic, dataHex) ?? undefined,
      });
    } else {
      instructions.push({
        pc: instrPc,
        mnemonic: info.mnemonic,
      });
    }
  }

  return instructions;
}

export interface BytecodeViewProps {
  session: DebugSession;
  /** Whether to auto-scroll to keep current instruction visible. Defaults to true. */
  autoScroll?: boolean;
}

export function BytecodeView({ session, autoScroll = true }: BytecodeViewProps) {
  const step = session.currentStep;
  const currentPc = step?.pc ?? -1;
  const isFrameEnd = session.isAtFrameEnd;
  const frame = session.currentFrame;
  const bytecode = frame.code;
  const currentLineRef = useRef<HTMLDivElement>(null);

  const instructions = useMemo(
    () => disassembleWithPc(bytecode),
    [bytecode]
  );

  useEffect(() => {
    if (autoScroll) {
      currentLineRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentPc, isFrameEnd, autoScroll]);

  return (
    <div className="evmd-panel evmd-bytecode-view">
      <h3>Bytecode</h3>
      <div className="evmd-bytecode-listing">
        {instructions.map((instr) => {
          const isCurrent = instr.pc === currentPc;
          return (
            <div
              key={instr.pc}
              ref={isCurrent ? currentLineRef : undefined}
              className={`evmd-bytecode-line${isCurrent ? " evmd-bytecode-current" : ""}`}
            >
              <span className="evmd-bytecode-arrow">{isCurrent ? "→" : " "}</span>
              <span className="evmd-bytecode-pc">
                {instr.pc.toString().padStart(4, " ")}
              </span>
              <span className="evmd-bytecode-mnemonic">{instr.mnemonic}</span>
              {instr.operand && (
                <span className="evmd-bytecode-operand">{instr.operand}</span>
              )}
              {instr.annotation && (
                <span className="evmd-stack-input-name">{instr.annotation}</span>
              )}
            </div>
          );
        })}
        <div
          ref={isFrameEnd ? currentLineRef : undefined}
          className={`evmd-bytecode-line evmd-frame-end${isFrameEnd ? " evmd-bytecode-current" : ""}`}
        >
          <span className="evmd-bytecode-arrow">{isFrameEnd ? "→" : " "}</span>
          <span className="evmd-bytecode-pc">END</span>
          {isFrameEnd && (
            <span className="evmd-bytecode-mnemonic evmd-frame-end-label">
              {session.currentFrame.result.exitReason.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
