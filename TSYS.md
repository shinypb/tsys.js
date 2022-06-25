## TSYS emulated environment

### Memory

- The first 128 bytes of memory are reserved (see [I/O](#io), below).
- The memory value at address `0x00` is always `0x00`.
- Running code is loaded into memory at `0x80` offset
- Any attempts to jump to an address lower than `0x80` will [`HALT`](./TCPU.md#OP_HALT) the machine.

### Execution

- At startup, all registers are set to `0x00`.
- Thread #0's PC is set to `0x80`, the others remain at `0x00`.
- Thread #0 is marked as active, the other threads are not.
- Thread #0 continues executing until it performs a `SPAWN`, `YIELD`, or `STOP` operation.
- The active thread works by reading the instruction in memory stored at the address stored in their PC, advancing its PC by 4 bytes each time.

### I/O <a name="io"></a>
**WARNING**: I/O is not actually implemented yet; this is a hand-wavy spec to build against.

All I/O is done through memory mapping. Up to 16 I/O devices are supported. Device memory mapping begins at memory offset `0x00`, and each device takes 4 bytes:

- Byte 0, the status byte:
	- Bit 0: indicates whether or not an I/O device is connected at this address.
	- Bit 1: indicates that there is data waiting for the CPU to read it; if set to 1, the CPU should read the contents of byte 1 and set this bit to 0.
	- Bit 2: indicates that there is data waiting for the output device to read it; if set to 1, the device should read the contents of byte 2 and set this bit to 0.
	- Bit 3: indicates whether the I/O device is reserved by a TCPU thread. This is only set by convention, but threads should not use an I/O device without requesting ownership of it first.
	Bits 4-7: indicate which TCPU thread is actively using this I/O device.
- Byte 1, the output byte (written by CPU, read by device)
- Byte 2, the input byte (read by CPU, written by device)
- Byte 3, reserved

By convention, the I/O devices are connected at the following locations:

- `0x00`: output terminal
- `0x04`: keyboard
- `0x08`: random number generator

### Supported I/O devices
In the following sections,

- **W**: indicates data written by TCPU
- **R**: indicates data written by device

### Terminal

#### Clear terminal

**W**: `0x00`

#### Query terminal width:
**W**: `0x01`
**R**: width, in characters

#### Query terminal height:
**W**: `0x02`
**R**: height, in characters

#### Write ASCII character to terminal:
**W**: `0x10–0xFF`

### Keyboard

**R**: most recently typed character. The keyboard may buffer input.

### Random Number Generator

**R**: a random byte.
