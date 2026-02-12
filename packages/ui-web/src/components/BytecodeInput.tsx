import type { DebuggerController } from "@evmd/ui-common";

export function BytecodeInput({
  controller,
}: {
  controller: DebuggerController;
}) {
  return (
    <div className="evmd-bytecode-input">
      <div className="evmd-input-header">
        <label>
          <select
            value={controller.inputMode}
            onChange={(e) =>
              controller.setInputMode(e.target.value as "hex" | "mnemonic")
            }
          >
            <option value="mnemonic">Mnemonic</option>
            <option value="hex">Hex</option>
          </select>
        </label>
        <button onClick={() => controller.execute()}>Run</button>
      </div>
      <textarea
        value={controller.source}
        onChange={(e) => controller.setSource(e.target.value)}
        placeholder={
          controller.inputMode === "mnemonic"
            ? "PUSH1 0x42\nPUSH1 0x00\nMSTORE\nSTOP"
            : "0x604260005260206000f3"
        }
        rows={10}
        spellCheck={false}
      />
    </div>
  );
}
