import { createEVM } from "@ethereumjs/evm";
import { hexToBytes, bytesToHex, createAddressFromString, Account } from "@ethereumjs/util";

async function test() {
  const evm = await createEVM({ allowUnlimitedContractSize: true });
  
  // PUSH1 0x42, PUSH1 0x01, SSTORE, STOP
  const bytecode = hexToBytes("0x6042600155" + "00");
  
  const toAddr = createAddressFromString("0x1000000000000000000000000000000000000001");
  
  // Create the account first
  await evm.stateManager.putAccount(toAddr, new Account());
  
  evm.events!.on("step", (step) => {
    console.log(`  ${step.opcode.name} @ PC ${step.pc}`);
  });
  
  console.log("Testing runCode with account created first:");
  try {
    const result = await evm.runCode({
      code: bytecode,
      data: bytecode,
      gasLimit: 1000000n,
      caller: createAddressFromString("0xd8da6bf26964af9d7eed9e03e53415d37aa96045"),
      to: toAddr,
    });
    console.log("Success! Gas used:", result.executionGasUsed.toString());
    
    // Check storage
    const slot = hexToBytes("0x0000000000000000000000000000000000000000000000000000000000000001");
    const value = await evm.stateManager.getStorage(toAddr, slot);
    console.log("Storage at slot 1:", bytesToHex(value));
  } catch (e) {
    console.log("Error:", e);
  }
}

test().catch(console.error);
