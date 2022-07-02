# TCPU specification

## Per-thread general purpose registers

Each of these are 8 bits and per-thread.

### 0. A
### 1. B
### 2. C
### 3. D
### 4. E
### 5. F
### 6. G
### 7. H

## Special registers

### 128. `TC`
4 bits. Global. Indicates which threads are runnable. Global.

### 129. `PC`
16 bits. Per thread. Program counter, indicating where in memory to fetch the next instruction.

### 130. `CL`
1 bit. Per thread. Whether last value comparison was less than the value it was compared against.

### 131. `CE`
1 bit. Per thread. Whether last value comparison was equal to the value it was compared against.

### 132. `CG`
1 bit. Per thread. Whether last value comparison was greater than the value it was compared against.

### 133. `T`
4 bits. Global. indicates which thread is currently executing.

### 134. `OF`
1 bit. Per thread. Whether the previous instruction had an overflow.

**Important:** If an operation produces an overflow, it will not save the overflowing value anywhere — the destination register will keep its previous value.

## Threads
CPU supports four hardware threads. Each thread has its own program counter and registers. All memory is shared with all threads. Register T indicates which thread is currently executing.

The threads are numbered 0 through 4.

## Instruction set
All instructions are encoded as 4 bytes:

- The first byte is the operator, and the remaining 3 bytes are arguments to that operator (`0x00` if unused).
- Register addresses are one byte, memory addresses are two bytes (big endian).
    
### 0. `YIELD`
Yields control to the next enabled thread. Increments register `T`; if run on thread #3, yields control to thread #0.
    
### 1. `JUMP [address]`
Sets the PC to address.

### 2. `JUMP_REG [register]`
Sets the PC to the address stored in the given register.
    
### 3. `JUMP_IF_ZERO [register, address]`
If register is zero, sets the PC to address.
    
### 4. `M2R [address, register]`
Copies the value of address to the given register.
    
### 5. `R2M [register, address]`
Copies the value of the given register to memory at address.
    
### 6. `R2R [register1, register2]`
Sets the value of register2 to the value of register1.
    
### 7. `ADD [register1, register2]`
Sets the value of register2 to (value of register1 + value of register2)
    
### 8. `SUB [register1, register2]`
Sets the value of register2 to (value of register2 - value of register1)
    
### 9: `ZERO [register]`
Sets the value of the given register to zero.
    
### 10: `INCR [register]`
Increments the value of the given register.
    
### 11: `DECR [register]`
Decrements the value of the given register.
    
### 12: `SPAWN [address]`
HALTs if no threads are inactive.
Selects the first thread number which is currently inactive, sets its program counter to address, and marks it as active.
    
### 13. `STOP`
HALTs if this is the only active thread.
Marks the current thread as inactive and yields to the next thread.
    
### 14. `HALT` <a name="OP_HALT"></a>
Stops all execution across all threads.
    
### 15. `LSHIFT [register]`
Left shifts the value of register.
    
### 16. `RSHIFT [register]`
Right shifts the value of register.

### 17. `JUMP_UNLESS_ZERO [register, address]`
Unless register is zero, sets the PC to address.

### 18. `AND [register1, register2]`
Sets the value of register2 to (value of register2 AND'd with value of register1)

### 19. `OR [byte, register]`
Performs an OR operation with the given value and the value of the given register and writes it to the register.
    
### 20. `SET [byte, register]`
Sets the contents of the given register to a 16-bit value.

### 21. `COMPARE [register1, register2]`
Compares register 1 to register 2. If register 1 is greater than register 2, CG will be set. If register 2 is less than register 2, CL will be set. If they are equal, neither will be set.

### 22. `IM2R [register1, register2]`
Fetches the contents of memory at the address stored in register1 and copies it to register2.

### 23. `XOR [register1, register2]`
Sets the value of register2 to the result of XOR'ing register1 and register2.

### 24. `NOT [register]`
Sets the value of register2 to the result of NOT'ing register1 and register2.

### 25. `MBTS [register, offset]`
Memory bit test/set. Sets the compare flag to the result of comparing that bit's current value against 1, and then sets the offset'th bit in the given register to 1.
