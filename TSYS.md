# TSYS emulated environment

## Memory

- The first 128 bytes of memory are reserved (see [I/O](#io), below, and [TSYS memory layout spreadsheet](https://docs.google.com/spreadsheets/d/1oFGabs6mZx3lDkgHiOlU2QCMfdUE8BfVF-cyoyJMW1Q/edit#gid=0)).
- The memory value at address `0x00` is always `0x00`.
- Running code is loaded into memory at offset `0x80`.
- Any attempts to jump to an address lower than `0x80` will [`HALT`](./TCPU.md#OP_HALT) the machine.
- Code at `0x80` is the entrypoint for thread #0 (other threads do not have bootstrap code). It should consist of a `JMP` instruction pointing to the bootstrap code.
- Code at `0x83` is the entrypoint for the interrupt handler. It should consist of a JMP instruction pointing to the interrupt handler.

## Execution

- At startup, all registers are set to `0x00`.
- Thread #0's PC is set to `0x80`, the others remain at `0x00`.
- Thread #0 is marked as active, the other threads are not.
- Thread #0 continues executing until it performs a `SPAWN`, `YIELD`, or `STOP` operation.
- The active thread works by reading the instruction in memory stored at the address stored in their PC, advancing its PC by <abbr title="All instructions are encoded as 4 bytes; see TCPU.md for details.">4 bytes</abbr> each time.

## I/O <a name="io"></a>
**WARNING**: I/O is not actually implemented yet; this is a hand-wavy spec to build against.

All I/O is done through memory mapping. Up to 16 I/O devices are supported.

The byte at `0x03` is called the I/O Control & Status byte:
- Low nibble (bits 0-3): indicates whether I/O interrupts are enabled for the given Thread.
- High nibble (bits 4-7): indicates which I/O device triggered the most recent interrupt.

The initial value for the I/O Control & Status byte is `0x01` (interrupts enabled only for Thread #0).

Device memory mapping begins at memory offset `0x04`, and each device takes 4 bytes:

- Byte 0, the status byte:
	- Bit 0: indicates whether or not an I/O device is connected at this address.
	- Bit 1: indicates that there is data waiting for the CPU to read it; if set to 1, the CPU should read the contents of byte 1 and set this bit to 0.
	- Bit 2: indicates that there is data waiting for the output device to read it; if set to 1, the device should read the contents of byte 2 and set this bit to 0.
	- Bit 3: indicates whether the I/O device is owned by a TCPU thread. This is only used for the purposes of interrupt control, but threads should not read or write to an I/O device without obtaining ownership of it first.
		> ❓ How would well-behaved code go about obtaining ownership without accidentally clobbering another thread? Imagine Thread #2 wants to set this value and gets interrupted partway through the acquisiton process, having checked that it's free but before it marks itself as an owner. An interrupt happens and now Thread #1 takes ownership. Next time Thread #2 runs, it will finish its acquisiton process and clobber Thread #1. How to solve this? The only thing I can think of is a way to turn off interrupts temporarily, but that doesn't seem ideal.
	- Bits 4-7: indicate which TCPU thread is actively using this I/O device.
		> ❓ Perhaps I/O device ownership should be more than a convention, and the system should `HALT` if a thread attempts to read the I/O range of a device that they are not the owner of?

- Byte 1, the input byte (read by CPU, written by device)
- Byte 2, the output byte (written by CPU, read by device)
- Byte 3, reserved

By convention, the I/O devices are connected at the following locations:

- Device 0 (`0x04`): clock signal (interrupts once per second)
- Device 1 (`0x08`): output terminal
- Device 2 (`0x08`): keyboard
- Device 3 (`0x12`): random number generator

## Interrupts
I/O is interrupt-driven; any device can trigger an interrupt to indicate that it has data waiting to be dealt with. When a device raises an interrupt, the following things happen:

0. Execution is stopped after the current instruction finishes.
0. The system looks at the status byte for the given I/O device to see which thread owns the device. If no thread owns the device, none of the remaining steps should happen and execution should resume normally.
0. Bit 1 of the I/O device's status byte will be set to 1 (to indicate that there is data to read).
0. The current value of the recipient thread's program counter is copied to memory offset `0x01`.
0. The recipient thread's program counter is changed to `0x83` (the interrupt handler).
0. Execution resumes.

It is the responsibility of the interrupt handler to restore the previous value of the current thread's program counter from memory location `0x01—0x02` once it has finished servicing the interrupt.

> ❗️ There's currently nothing preventing a second interrupt from happening while the first one is still being processed, so,we probably should have a way to disable interrupts—otherwise two back-to-back interrupts would cause the original program counter to be lost. It would be preferable to just "lose" the first interrupt rather than the entire program flow.

## Supported I/O devices
In the following sections,

- **W**: indicates data written by TCPU.
- **R**: indicates data written by device.

### Clock signal

The clock signal generates an interrupt once a second. It is disabled by default.

- **W**: `0x00` - disables the clock signal.
- **W**: `0x01` - enables the clock signal.

### Terminal

With the exception of the null byte `0x00`, writing bytes to the terminal will cause them to be written to the screen as expected.

Writing a null byte enters an escape mode, where the next byte has special meaning:

- **W**: `0x00 0x00` - writes a literal null byte to the terminal.
- **W**: `0x00 0x01` - clears the terminal.
- **W**: `0x00 0x02` - queries the terminal width. The next byte written by the terminal will be the width of the terminal, in characters.
- **W**: `0x00 0x03` - queries the terminal height. The next byte written by the terminal will be the height of the terminal, in characters.
- Any other bytes are invalid and will be ignored.

### Keyboard

**R**: most recently typed character. The keyboard may buffer input; the CPU should set the bit 3 of the status byte to 0 after it reads the character, which should cause the keyboard to write the next byte as soon as possible.

### Random Number Generator

**R**: a random byte. The CPU should set bit 3 of the status byte to 0 after it reads the byte in order to cause a new random byte to be written.
