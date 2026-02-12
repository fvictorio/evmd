import { useMemo, useEffect, useRef } from "react";
import type { DebugSession } from "@evmd/core";
import { getOpcodeByCode } from "@evmd/core";

interface DisassembledInstruction {
  pc: number;
  mnemonic: string;
  operand?: string;
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

export function BytecodeView({ session }: { session: DebugSession }) {
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
    currentLineRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [currentPc, isFrameEnd]);

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
            </div>
          );
        })}
        {isFrameEnd && (
          <div
            ref={currentLineRef}
            className="evmd-bytecode-line evmd-bytecode-current evmd-frame-end"
          >
            <span className="evmd-bytecode-arrow">→</span>
            <span className="evmd-bytecode-pc">END</span>
            <span className="evmd-bytecode-mnemonic evmd-frame-end-label">
              {session.currentFrame.result.exitReason.toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
