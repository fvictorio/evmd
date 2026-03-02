import { InlineDebugger } from "./components/InlineDebugger";

export function App() {
  return (
    <article className="tutorial">
      <h1>Code, program counter and stack</h1>

      <p>
        The Ethereum Virtual Machine (EVM) is a stack-based virtual machine that
        specifies how bytecode is executed and how it can modify the world
        state.
      </p>

      <p>
        The EVM is one of the most complex parts of Ethereum. In this tutorial,
        we'll explore how it works, starting with a very minimal version of it
        and adding new concepts as we go.
      </p>

      <hr />

      <p>
        The most minimal version of the EVM we can start with has three
        components: the code being executed, a program counter that indicates
        which part of the code will be executed next, and a stack.
      </p>

      <p>
        But before going into the details of this, let's first talk about what
        we mean by code, and how we'll represent it.
      </p>

      <h2>Bytecode and instructions</h2>

      <p>
        An on-chain program is essentially an account with code. This code is
        just a sequence of bytes, which we call bytecode. Take this, for
        example:
      </p>

      <pre className="code-block">60425f526001601ff3</pre>

      <p>
        This is a simple program that will return <code>0x42</code> to the
        caller. We can represent the same program in a more friendly way, with
        the list of instructions that are encoded by this bytecode:
      </p>

      <pre className="code-block">{`PUSH1 0x42
PUSH0
MSTORE
PUSH1 0x01
PUSH1 0x1f
RETURN`}</pre>

      <p>
        How do we go from the hexadecimal representation to this instructions
        representation? We first start at the first byte, <code>60</code>. This
        value represents the <code>PUSH1</code> instruction, which takes the
        next byte in the code and pushes it to the stack. Since the next byte is{" "}
        <code>42</code>, we can represent the whole instruction as{" "}
        <code>PUSH1 0x42</code>. To be more precise, we say that{" "}
        <code>60</code> is the <em>opcode</em> of the <code>PUSH1</code>{" "}
        instruction.
      </p>

      <p>
        Now we continue with the next byte after that, <code>5F</code>. This is
        the opcode of the <code>PUSH0</code> instruction, that just pushes 0 to
        the stack. Since, unlike <code>PUSH1</code>, this instruction doesn't
        take any values from the code, we just continue with the next byte,{" "}
        <code>52</code>. We continue in this fashion until we reach the end of
        the bytecode.
      </p>

      <p>
        In the rest of this tutorial, we'll mostly use the instructions
        representation of the programs we examine.
      </p>

      <h2>Executing code</h2>

      <p>
        When a smart contract is executed, a new instance of the EVM is created,
        the code to execute is loaded, and the program counter (PC) is set to 0,
        pointing to the first byte of the code. The EVM will then execute this
        first instruction and update the PC to point to the next instruction. In
        many cases, this means incrementing the PC by 1 but, as we explained in
        the previous section, some instructions will use more bytes from the
        code. A <code>PUSH1</code> instruction will increment the PC by 2.
      </p>

      <p>The execution will continue in that way until one of three things happens:</p>

      <ul>
        <li>We reach the end of the code.</li>
        <li>We execute an instruction that stops the execution.</li>
        <li>We run into an error.</li>
      </ul>

      <h3>Example 1: PUSH and POP</h3>

      <p>Let's start with an extremely simple program:</p>

      <InlineDebugger
        source={`PUSH1 0x2A
POP`}
      />

      <p>
        When this program is executed an EVM instance will be created with that
        code and an empty stack. Use the controls above to step through the
        execution.
      </p>

      <p>
        In the bytecode view, each instruction is preceded by its byte index in
        the code. The PC will have that value at the moment of executing it.
      </p>

      <p>
        The execution begins with the first instruction, which pushes{" "}
        <code>0x2A</code> to the stack. After executing it, the PC will be
        updated to point to the next instruction. Since <code>PUSH1</code> is
        two bytes long, the PC will be incremented by 2.
      </p>

      <p>
        The next instruction is <code>POP</code>, which removes the top element
        from the stack.
      </p>

      <p>
        <code>POP</code> is 1 byte long, so the PC becomes 3. We don't have any
        instructions at this point: we've reached the end of our program and the
        execution finishes.
      </p>

      <h3>Example 2: ADD</h3>

      <p>Let's look at another example:</p>

      <InlineDebugger
        source={`PUSH1 0x08
PUSH1 0x07
ADD`}
      />

      <p>
        We start by pushing <code>8</code> and <code>7</code> to the stack.
        After that, we execute the <code>ADD</code> instruction, which takes the
        two top elements of the stack, adds them, and pushes the result back to
        the stack. This means that, unlike the previous example, this execution
        will end up with a non-empty stack (it will have <code>0xf</code> on
        it). But the contents of the stack don't have any effect after the
        execution finishes.
      </p>

      <h3>Example 3: STOP</h3>

      <p>Let's now consider the following program:</p>

      <InlineDebugger
        source={`PUSH1 0x08
PUSH1 0x07
STOP
PUSH1 0x06`}
      />

      <p>
        This example starts like the previous one but, after pushing the first
        two values to the stack, we execute the <code>STOP</code> opcode which,
        as its name indicates, stops the execution. The opcode that pushes{" "}
        <code>6</code> to the stack will not be reached. At the end of the
        execution, the stack will have a <code>7</code> at the top, and an{" "}
        <code>8</code> after that.
      </p>

      <p>
        These three examples illustrate a property of every instruction: they
        can take some elements of the stack (or not), and they can push some
        elements to the stack (or not). For example:
      </p>

      <ul>
        <li>
          The <code>PUSH1</code> instruction will push a value to the stack, but
          it will not take anything from it.
        </li>
        <li>
          The <code>POP</code> instruction will take an element from the stack,
          but it won't push anything to it.
        </li>
        <li>
          The <code>ADD</code> instruction will both take some elements from the
          stack (the operands of the sum), and push something to it (the result
          of the sum).
        </li>
        <li>
          The <code>STOP</code> instruction doesn't take any elements from the
          stack nor pushes anything to it.
        </li>
      </ul>

      <h2>Word size</h2>

      <p>
        One aspect of the EVM that we haven't talked about yet is the word size.
        The EVM is a 256-bit machine, which means —among other things— that
        every element in the stack will be 256 bits long.
      </p>

      <p>
        For example, in the previous scenario we pushed the values{" "}
        <code>8</code> and <code>7</code>. These values are 8-bit long, but they
        will be padded to 256 bits when pushed to the stack. This means that the
        value <code>8</code> will be represented as{" "}
        <code>0x0000000000000000000000000000000000000000000000000000000000000008</code>.
      </p>

      <p>
        In general we won't include the padding in our examples, unless it's
        important for the explanation.
      </p>

      <h2>Gas</h2>

      <p>
        When a program is executed, every instruction consumes some amount of
        gas. How much gas is consumed depends on many factors, like the
        instruction itself, the current hardfork, or the world state.
      </p>

      <p>
        Let's take a look again at one of the previous examples:
      </p>

      <pre className="code-block">{`PUSH1 0x08
PUSH1 0x07
ADD`}</pre>

      <p>
        The gas cost of executing this bytecode will be 9, because both{" "}
        <code>PUSH1</code> and <code>ADD</code> consume 3 units of gas.
      </p>

      <p>
        When an execution starts, it will have a certain amount of gas
        available. If at any point there isn't enough gas to execute the next
        instruction, the execution will halt with an out-of-gas error.
      </p>

      <h2>Exceptional halts</h2>

      <p>
        Earlier in this tutorial, we said that an execution can finish in three
        ways: reaching the end of the code, executing an instruction that stops
        the execution, or running into an error. The <code>STOP</code> opcode is
        an example of the second case, although there are others. And running
        out of gas is an example of an error.
      </p>

      <p>
        When an execution finishes because of an error, we say that it has{" "}
        <em>exceptionally halted</em>. When this happens, all the changes done
        during the execution will be reverted and all the remaining gas will be
        consumed.
      </p>

      <p>
        Another example of an exceptional halt is trying to pop an element from
        an empty stack.
      </p>

      <h3>Example 4: Stack underflow</h3>

      <InlineDebugger
        source={`PUSH0
POP
POP`}
      />

      <p>
        This program will run into a stack underflow error when trying to
        execute the second <code>POP</code> instruction, because the stack will
        be empty at that point.
      </p>

      <h1>Input data and jumps</h1>

      <p>
        The example programs we saw so far always do the same thing when they
        are executed. In this section we'll introduce two new concepts that can
        make for more interesting programs: input data and jumps.
      </p>

      <h2>Input data</h2>

      <p>
        The input data is a read-only buffer that contains the input of the
        execution. At the Solidity level, the input data is used to specify
        which contract function will be called and with which arguments. But at
        the EVM level, the input data is just a byte array that can be used for
        any purpose.
      </p>

      <p>
        There are three instructions that can be used to access the input data:{" "}
        <code>CALLDATALOAD</code>, <code>CALLDATASIZE</code>, and{" "}
        <code>CALLDATACOPY</code>. In this section we'll talk about the first
        two, because <code>CALLDATACOPY</code> involves the EVM memory, which we
        haven't introduced yet.
      </p>

      <h3>CALLDATASIZE</h3>

      <p>
        The <code>CALLDATASIZE</code> instruction is simple: it just pushes the
        size of the input data onto the stack.
      </p>

      <h4>Example 5: CALLDATASIZE</h4>

      <p>This short program checks if the input data is empty:</p>

      <InlineDebugger
        source={`PUSH0
CALLDATASIZE
GT`}
        mode="call"
        calldata="0x1234"
      />

      <p>
        Try changing the input data to see how the program behaves. Here we are
        also introducing the <code>GT</code> instruction, which compares the top
        two stack items and pushes <code>1</code> if the first item is greater
        than the second, and <code>0</code> otherwise.
      </p>

      <h3>CALLDATALOAD</h3>

      <p>
        <code>CALLDATASIZE</code> lets us know the size of the input data, but
        we also want to read the data itself. The <code>CALLDATALOAD</code>{" "}
        instruction allows us to do that by loading a 32-byte word from the
        input data. It takes one argument, which is the offset from the
        beginning of the input data from where to load the word. If there are
        less than 32 bytes after that offset, the word will be right-padded with
        zeros.
      </p>

      <h4>Example 6: Load a word from the beginning of the input data</h4>

      <p>
        This program loads the first word of the input data and pushes it onto
        the stack:
      </p>

      <InlineDebugger
        source={`PUSH0
CALLDATALOAD`}
        mode="call"
        calldata="0x1234"
      />

      <p>
        If we execute this bytecode with an input data of <code>0x1234</code>,
        the stack will end up with the value{" "}
        <code>
          0x1234000000000000000000000000000000000000000000000000000000000000
        </code>
        . Since the input data is two bytes long, 30 bytes worth of zeros are
        added to the end of the word.
      </p>

      <h4>Example 7: Load a word with a non-zero offset</h4>

      <p>Now let's see what happens when we load a word using a non-zero offset:</p>

      <InlineDebugger
        source={`PUSH1 0x01
CALLDATALOAD`}
        mode="call"
        calldata="0x1234"
      />

      <p>
        If we use the same input data as before (<code>0x1234</code>), the stack
        will end up with the value{" "}
        <code>
          0x3400000000000000000000000000000000000000000000000000000000000000
        </code>
        . As before, the result is right-padded with zeros.
      </p>

      <h2>Jumps</h2>

      <p>
        Using the input data we get executions that are more interesting: the
        involved values will change depending on the input data. But what if we
        want to <em>execute</em> different things depending on the input data?
        This is where jumps come into play. They allow us to modify the program
        counter to make the execution jump to a different part of the program.
        There are three jump-related instructions: <code>JUMP</code>,{" "}
        <code>JUMPI</code>, and <code>JUMPDEST</code>.
      </p>

      <h3>JUMPI and JUMPDEST</h3>

      <p>
        The <code>JUMPI</code> instruction can conditionally change the value of
        the program counter to a position of our choosing. It does this by
        taking two arguments from the stack: the jump destination and the
        condition. The jump will be made if the condition is not zero. We can't
        change the program counter to any value, though; the new location has to
        correspond to a <code>JUMPDEST</code> instruction, which is a marker
        that tells the EVM that it's a valid jump destination.
      </p>

      <h4>Example 8: Read input data if it's not empty</h4>

      <p>
        This program reads the first word of the input data only if the input
        data is not empty:
      </p>

      <InlineDebugger
        source={`PUSH0
CALLDATASIZE
GT
PUSH1 0x07
JUMPI
STOP
JUMPDEST
PUSH0
CALLDATALOAD`}
        mode="call"
        calldata="0x1234"
      />

      <p>
        This is the most complex bytecode we've seen so far. The first three
        instructions check if the input data is empty. If it is, a <code>0</code>{" "}
        will be pushed onto the stack. Otherwise, a <code>1</code> will be
        pushed. This will be the condition for the <code>JUMPI</code>{" "}
        instruction. After that we push <code>0x07</code> onto the stack, which
        is the position of the <code>JUMPDEST</code> instruction. And then we
        execute <code>JUMPI</code>.
      </p>

      <p>
        If the condition is true (that is, non-zero), the program counter will
        be set to <code>0x07</code>, effectively jumping to the{" "}
        <code>JUMPDEST</code> instruction and executing the rest of the program,
        which reads the first word of the input data.
      </p>

      <p>
        If the condition is false (that is, zero), the program will continue
        executing the next instruction, which is <code>STOP</code>.
      </p>

      <p>
        Try running this program with an empty input data, and then with some
        data.
      </p>

      <h3>JUMP</h3>

      <p>
        Besides <code>JUMPI</code>, there's another jump instruction:{" "}
        <code>JUMP</code>. This instruction unconditionally changes the program
        counter to the position specified on the stack. As with{" "}
        <code>JUMPI</code>, the new position has to correspond to a{" "}
        <code>JUMPDEST</code> instruction.
      </p>

      <h4>Example 9: Unconditional jump</h4>

      <InlineDebugger
        source={`PUSH1 0x05
JUMP
PUSH1 0x01
JUMPDEST
PUSH1 0x02`}
      />

      <p>
        We push <code>5</code> (the byte offset of the <code>JUMPDEST</code>)
        and execute <code>JUMP</code>. The <code>PUSH1 0x01</code> instruction
        is skipped, and execution continues at the <code>JUMPDEST</code>.
      </p>

      <h3>Invalid jumps</h3>

      <p>
        As we mentioned before, we can only make jumps to positions that have a{" "}
        <code>JUMPDEST</code> instruction. If we try to jump to a position that
        doesn't have a <code>JUMPDEST</code>, the execution will run into an
        exceptional halt. As with stack underflows, this will consume all the
        remaining gas and stop the execution. This also applies to jumps that
        are out of bounds, that is, jumps that try to go to a position that is
        beyond the end of the bytecode.
      </p>

      <InlineDebugger
        source={`PUSH1 0x06
JUMP
PUSH1 0x01
JUMPDEST
PUSH1 0x02`}
      />
    </article>
  );
}
