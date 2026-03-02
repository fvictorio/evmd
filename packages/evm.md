# Code, program counter and stack

The Ethereum Virtual Machine (EVM) is a stack-based virtual machine that specifies how bytecode is executed and how it can modify the world state.

The EVM is one of the most complex parts of Ethereum. In this part of the book, we'll explore how it works, starting with a very minimal version of it and adding new concepts as we go.

---

The most minimal version of the EVM we can start with has three components: the code being executed, a program counter that indicates which part of the code will be executed next, and a stack.

But before going into the details of this, let's first talk about what we mean by code, and how we'll represent it.

## Bytecode and instructions

An on-chain program is esentially an account with code. This code is just a sequence of bytes, which we call bytecode. Take this, for example:

```
60425F5260205FF3
```

This is a simple program that will return `0x42` to the caller. We can represent the same program in a more friendly way, with the list of instructions that are encoded by this bytecode:

```
PUSH1 0x42
PUSH0
MSTORE
PUSH1 0x20
PUSH0
RETURN
```

<a href="https://www.evm.codes/playground?fork=cancun&unit=Wei&codeType=Mnemonic&code='PUSH1%200x42%5CnPUSH0%5CnMSTORE%5CnPUSH1%200x20%5CnPUSH0%5CnRETURN'_" target="_blank" style="font-size: smaller;">➤ Check this example in evm.codes</a>

How do we go from the hexadecimal representation to this instructions representation? We first start at the first byte, `60`. This value represents the `PUSH1` instruction, which takes the next byte in the code and pushes it to the stack. Since the next byte is `42`, we can represent the whole instruction as `PUSH1 0x42`. To be more precise, we say that `60` is the *opcode* of the `PUSH1` instruction.

Now we continue with the next byte after that, `5F`. This is the opcode of the `PUSH0` instruction, that just pushes 0 to the stack. Since, unlike `PUSH1`, this instruction doesn't take any values from the code, we just continue with the next byte, `5F`. We continue in this fashion until we reach the end of the bytecode.

In the rest of the book, we'll mostly use the instructions representation of the programs we examine.

## Executing code

When a smart contract is executed, a new instance of the EVM is created, the code to execute is loaded, and the program counter (PC) is set to 0, pointing to the first byte of the code. The EVM will then execute this first instruction and update the PC to point to the next instruction. In many cases, this means incrementing the PC by 1 but, as we explained in the previous section, some instructions will use more bytes from the code. A `PUSH1` instruction will increment the PC by 2.

The execution will continue in that way until one of three things happens:

- We reach the end of the code.
- We execute an instruction that stops the execution.
- We run into an error.

### Example 1: PUSH and POP

Let's start with an extremely simple program:

```
PUSH1 0x2A
POP
```

<a href="https://www.evm.codes/playground?fork=cancun&unit=Wei&codeType=Mnemonic&code='PUSH1%200x2A%5CnPOP'_" target="_blank" style="font-size: smaller;">➤ Check this example in evm.codes</a>

When this program is executed an EVM instance will be created with that code and an empty stack:


![](./img/code-pc-and-stack/01.svg)

In this diagram, each instruction is preceded by its byte index in the code. The PC will have that value at the moment of executing it.

The execution will begin with the first instruction, which pushes `0x2A` to the stack. After executing it, the PC will be updated to point to the next instruction. Since `PUSH1` is two bytes long, the PC will be incremented by 2.

![](./img/code-pc-and-stack/02.svg)

The next instruction is `POP`, which removes the top element from the stack.

![](./img/code-pc-and-stack/03.svg)

POP is 1 byte long, so the PC becomes 3. We don't have any instructions at this point: we've reached the end of our program and the execution finishes.

### Example 2: ADD

Let's look at another example:

```
PUSH1 0x08
PUSH1 0x07
ADD
```

<a href="https://www.evm.codes/playground?fork=cancun&unit=Wei&codeType=Mnemonic&code='~8%5Cn~7%5CnADD'~PUSH1%200x0%01~_" target="_blank" style="font-size: smaller;">➤ Check this example in evm.codes</a>

![](./img/code-pc-and-stack/04.svg)

We start by pushing `8` and `7` to the stack. After that, we execute the `ADD` instruction, which takes the two top elements of the stack, adds them, and pushes the result back to the stack. This means that, unlike the previous example, this execution will end up with a non-empty stack (it will have `F` on it). But the contents of the stack don't have any effect after the execution finishes.

### Example 3: STOP

Let's now consider the following program:

```
PUSH1 0x08
PUSH1 0x07
STOP
PUSH1 0x06
```

<a href="https://www.evm.codes/playground?fork=cancun&unit=Wei&codeType=Mnemonic&code='PUSH1%200x08%5CnPUSH1%200x07%5CnSTOP%5CnPUSH1%200x06'_" target="_blank" style="font-size: smaller;">➤ Check this example in evm.codes</a>

This example starts like the previous one but, after pushing the first two values to the stack, we execute the `STOP` opcode which, as its name indicates, stops the execution. The opcode that pushes `6` to the stack will not be reached. At the end of the execution, the stack will have a `7` at the top, and an `8` after that.

These three examples illustrate a property of every instruction: they can take some elements of the stack (or not), and they can push some elements to the stack (or not). For example:

- The `PUSH1` instruction will push a value to the stack, but it will not take anything from it.
- The `POP` instruction will take an element from the stack, but it won't push anything to it.
- The `ADD` instruction will both take some elements from the stack (the operands of the sum), and push something to it (the result of the sum).
- The `STOP` instruction doesn't take any elements from the stack nor pushes anything to it.

## Word size

One aspect of the EVM that we haven't talked about yet is the word size. The EVM is a 256-bit machine, which means —among other things— that every element in the stack will be 256 bits long.

For example, in the previous scenario we pushed the values `8` and `7`. These values are 8-bit long, but they will be padded to 256 bits when pushed to the stack. This means that the value `8` will be represented as `0x0000000000000000000000000000000000000000000000000000000000000008`.

In general we won't include the padding in our examples, unless it's important for the explanation.

## Gas

When a program is executed, every instruction consumes some amount of gas. How much gas is consumed depends on many factors, like the instruction itself, the current hardfork, or the world state.

Let's take a look again at one of the previous examples:

```
PUSH1 0x08
PUSH1 0x07
ADD
```

The gas cost of executing this bytecode will be 9, because both `PUSH1` and `ADD` consume 3 units of gas.

When an execution starts, it will have a certain amount of gas available. If at any point there isn't enough gas to execute the next instruction, the execution will halt with an out-of-gas error.

## Exceptional halts

Earlier in this chapter, we said that an execution can finish in three ways: reaching the end of the code, executing an instruction that stops the execution, or running into an error. The `STOP` opcode is an example of the second case, although there are others. And running out of gas is an example of an error.

When an execution finishes because of an error, we say that it has *exceptionally halted*. When this happens, all the changes done during the execution will be reverted (we'll see exactly what this means in a later chapter) and all the remaining gas will be consumed.

Another example of an exceptional halt is trying to pop an element from an empty stack.

### Example 4: Stack underflow

```
PUSH0
POP
POP
```

<a href="https://www.evm.codes/playground?fork=cancun&unit=Wei&codeType=Mnemonic&code='PUSH0%5CnPOP%5CnPOP'_" target="_blank" style="font-size: smaller;">➤ Check this example in evm.codes</a>

This program will run into an stack underflow error when trying to execute the second `POP` instruction, because the stack will be empty at that point.

# Input data and jumps

The example programs we saw in the previous chapter always do the same thing when they are executed[^note-gas-limit]. In this chapter we'll introduce two new concepts that can make for more interesting programs: input data and jumps.

## Input data

The input data is a read-only buffer that contains the input of the execution. At the Solidity level, the input data is used to specify which contract function will be called and with which arguments. But at the EVM level, the input data is just a byte array that can be used for any purpose.

There are three instructions that can be used to access the input data: `CALLDATALOAD`, `CALLDATASIZE`, and `CALLDATACOPY`. In this chapter we'll only talk about the first two, because `CALLDATACOPY` involves the EVM memory, which we haven't introduced yet.

### `CALLDATASIZE`

The `CALLDATASIZE` instruction is simple: it just pushes the size of the input data onto the stack.

#### Example 1: `CALLDATASIZE`

This short program checks if the input data is empty:

```
PUSH0
CALLDATASIZE
GT
```

<a href="https://www.evm.codes/playground?fork=cancun&unit=Wei&callData=0x1234&codeType=Mnemonic&code='PUSH0%5CnCALLDATASIZE%5CnGT'_" target="_blank" style="font-size: smaller;">➤ Check this example in evm.codes</a>

Use the link above and try changing the input data to see how the program behaves

Here we are also introducing the `GT` instruction, which compares the top two stack items and pushes `1` if the first item is greater than the second, and `0` otherwise.

Let's see what happens when we execute this bytecode with an input data of `0x1234`:

![](./img/input-data-and-jumps/01.svg)

As you can see, the `GT` instruction pushes `1` onto the stack, which means that the input data is not empty.

### `CALLDATALOAD`

`CALLDATASIZE` lets us know the size of the input data, but we also want to read the data itself. The `CALLDATALOAD` instruction allows us to do that by loading a 32-byte word from the input data. It takes one argument, which is the offset from the beginning of the input data from where to load the word. If there are less than 32 bytes after that offset, the word will be right-padded with zeros. Let's see a couple of examples to clarify this.

#### Example 2: Load a word from the beginning of the input data

This program loads the first word of the input data and pushes it onto the stack:

```
PUSH0
CALLDATALOAD
```

<a href="https://www.evm.codes/playground?fork=cancun&unit=Wei&callData=0x1234&codeType=Mnemonic&code='PUSH0%5CnCALLDATALOAD'_" target="_blank" style="font-size: smaller;">➤ Check this example in evm.codes</a>

If we execute this bytecode with an input data of `0x1234`, the stack will end up with the value `0x1234000000000000000000000000000000000000000000000000000000000000`. Since the input data is two bytes long, 30 bytes worth of zeros are added to the end of the word.

#### Example 3: Load a word with a non-zero offset

Now let's see what happens when we load a word using a non-zero offset:

```
PUSH1 0x01
CALLDATALOAD
```

<a href="https://www.evm.codes/playground?fork=cancun&unit=Wei&callData=0x1234&codeType=Mnemonic&code='PUSH1%200x01%5CnCALLDATALOAD'_" target="_blank" style="font-size: smaller;">➤ Check this example in evm.codes</a>

If we use the same input data as before (`0x1234`), the stack will end up with the value `0x3400000000000000000000000000000000000000000000000000000000000000`. As before, the result is right-padded with zeros.

## Jumps

Using the input data we get executions that are more interesting: the involved values will change depending on the input data. But what if we want to _execute_ different things depending on the input data? This is where jumps come into play. They allow us to modify the program counter to make the execution jump to a different part of the program. There are three jump-related instructions: `JUMP`, `JUMPI`, and `JUMPDEST`.

### `JUMPI` and `JUMPDEST`

The `JUMPI` instruction can conditionally change the value of the program counter to a position of our choosing. It does this by taking two arguments from the stack: the jump destination and the condition. The jump will be made if the condition is not zero. We can't change the program counter to any value, though; the new location has to correspond to a `JUMPDEST` instruction, which is a marker that tells the EVM that it's a valid jump destination.

#### Example 4: Read input data if it's not empty

This program reads the first word of the input data only if the input data is not empty. 

<pre>
<code><span style="color: blue;">[00] PUSH0
[01] CALLDATASIZE
[02] GT</span>
[03] PUSH1 0x07
[05] JUMPI
<span style="color: red;">[06] STOP</span>
[07] JUMPDEST
<span style="color: green;">[08] PUSH0
[09] CALLDATALOAD</span>
</code>
</pre>

<a href="https://www.evm.codes/playground?fork=cancun&unit=Wei&codeType=Mnemonic&code='zSIZE~GT~w1%200x07yI~STOPyDEST~zLOAD'~%5Cnzw0~CALLDATAy~JUMPwPUSH%01wyz~_" target="_blank" style="font-size: smaller;">➤ Check this example in evm.codes</a>

This is the most complex bytecode we've seen so far, so let's analyze it part by part.

<span style="color: blue;">The first three instructions</span> are the same as in [Example 1](#example-1-calldatasize): they check if the input data is empty. If it is, a 0 will be pushed onto the stack. Otherwise, a 1 will be pushed. This will be the condition for the `JUMPI` instruction. After that we push `0x07` onto the stack, which is the position of the `JUMPSDEST` instruction. And then we execute `JUMPI`.

If the condition is true (that is, non-zero), the program counter will be set to `0x07`, effectively jumping to the `JUMPDEST` instruction and executing <span style="color: green;">the rest of the program</span>, which reads the first word of the input data.

If the condition is false (that is, zero), the program will continue executing <span style="color: red;">the next instruction</span>, which is `STOP`.

Try running this program step by step in evm.codes. Execute it first with an empty input data, and then with some data.

### `JUMP`

Besides `JUMPI`, there's another jump instruction: `JUMP`. This instruction unconditionally changes the program counter to the position specified on the stack. As with `JUMPI`, the new position has to correspond to a `JUMPDEST` instruction.

The `JUMP` instruction is useful to, for example, re-use code. A section of the bytecode could have some re-usable logic, and other sections could jump to it to execute it instead of duplicating the code.

### Invalid jumps

As we mentioned before, we can only make jumps to positions that have a `JUMPDEST` instruction. If we try to jump to a position that doesn't have a `JUMPDEST`, the execution will run into an exceptional halt. As with stack underflows, this will consume all the remaining gas and stop the execution. This also applies to jumps that are out of bounds, that is, jumps that try to go to a position that is beyond the end of the bytecode.

---

[^note-gas-limit]: Assuming they have enough gas to run to completion.