import type { DebugSession } from "@evmd/core";

export function BytecodeView({ session }: { session: DebugSession }) {
  const step = session.currentStep;

  // Stub: just show current opcode info
  return (
    <div className="evmd-panel evmd-bytecode-view">
      <h3>Bytecode</h3>
      <div>
        PC: {step.pc} | {step.mnemonic} (0x
        {step.opcode.toString(16).padStart(2, "0")})
      </div>
    </div>
  );
}
