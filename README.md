# TSYS.js

## What is TSYS?
TSYS is an imaginary personal computer platform based around the fictitious 8-bit TCPU processor.

- [TCPU technical specifications](./TCPU.md) covers the details of the processor itself
- [TSYS technical specifications](./TSYS.md) covers the details of the emulated environment (memory layout, I/O, etc.)
- This document shows how to use the assembler and run the emulator

## Usage

### Assemble a program into a memory image

This will assemble `fibo.tcpu.txt` and write it to `fibo.bin`:

```bin/asm demos/fibo.tcpu.txt```

### Run a memory image

This will run `fibo.bin`:

```bin/run demos/fibo.bin```

## Binary format of executables
Each instruction is four bytes:

- Byte 0: an op code (see instructionset.json, below)
- Bytes 1, 2, 3: optional arguments to the instruction, or 0 if unused.

## instructionset.json
[This file](./lib/instructionset.json) defines the instruction set for TCPU. It contains an array of objects, each of which contains the following fields:

- `name`: the name of the instruction; used by the assembler and for debugging output.
- `code`: the op code of the instruction
- `args`: the arguments for the instructions, given as an array of numbers.

### Argument decoding
The `args` value indicates how to decode the latter 3 bytes of each instruction. Given the four bytes `[ 0x4, 0xA, 0xB, 0xC ]`, the instruction would be decoded as follows:

1. Look up which instruction has op code 0x4, in this case `M2R`. Its arguments are `[ 2, 1 ]`.
2. This tells us that `M2R` takes two arguments, the first of which is 2 bytes long and the second of which is 1 byte long.
3. The first two bytes of the instruction arguments (`0xA`, `0xB`) are combined using big endian notation to get a value of `0xB0A`. This is the first argument.
4. The final byte stands alone, so its value is still `0xC`.
5. This instruction is therefore decoded to `{ code: 0x4, name: "M2R", args: [ 0xB0A, 0xC ] }`

## Assembler

[The assembler](assembler/tassem.rb) supports a few features:

### Named labels

Any alpha-numeric string prefixed with a : is a label and can be used anywhere a memory location or number is expected.

Lines which begin with a : define a new label for the current assembly memory address, relative to the base address (see `BASE_ADDRESS` directive, below).

### Directives
Lines starting with an equals sign are assembler directives.

#### Supported directives

`=BASE_ADDRESS 0x80` sets the base address for all named labels included in the file to the given value. For this emulated system, the base address should always be set to `0x80`. See **Memory**.

### Integers
Integers can be given in hexadecimal (`0x00`) or decimal (`1234`).

### Data
Binary data can be included via the `DATA` keyword, followed by any number of hexadecimal bytes, e.g.

```DATA DE CA FB AD```

Strings can be included via the `STRING` keyboard, followed by an un-quoted string, e.g.

```STRING Decaf bad```

Strings are null-terminated.
