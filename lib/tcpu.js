'use strict';

let TDevice = require('../lib/tdevice.js');

const INSTRUCTION_SIZE = 4;
const THREAD_COUNT = 4;
const THREAD_REGISTER_COUNT = 8; // registers A-H

// the first _N_ registers are just plain bytes accessible to the current
// thread; special registers (e.g. `T`) begin at this address.
const THREAD_SPECIAL_REGISTER_OFFSET = 0x80;

/**
 *  Maps from register name to internal address.
 */
const REGISTER = {
    // byte registers
    A: 0x00,
    B: 0x01,
    C: 0x02,
    D: 0x03,
    E: 0x04,
    F: 0x05,
    G: 0x06,
    H: 0x07,

    // special (and read-only) registers
    T: 0x80,
    TC: 0x81,
    PC: 0x82, // note: PC is 2 bytes wide, hence jump from 0x82 to 0x84
    CE: 0x84,
    CG: 0x85,
    CL: 0x86,
    OF: 0x87,
}

/**
 *  Maps from name to op code.
 */
const OP = {};

 /**
  * Maps from op code to { code, name, name } definition
  */
const OP_INFO = {};

/**
 * Ingest our instruction set definition into the data structures we need.
 */
(function(instruction_set) {
    instruction_set.forEach(function(info) {
        let instructionArgSize = info.args.reduce((acc, val) => (acc + val), 0);
        if (instructionArgSize > (INSTRUCTION_SIZE - 1)) {
            throw new Error(`Invalid instruction definition for ${info.name}; args must total no more than ${INSTRUCTION_SIZE - 1} bytes (definition: ${JSON.stringify(info.args)})`);
        }

        OP[info.name] = info.code;
        OP_INFO[info.code] = info;
    });
})(typeof instruction_set == 'undefined' ? require('./instructionset.json') : instruction_set);

class TCPU {
    static get REGISTERS() {
        return REGISTER;
    }

    constructor(memory, startOffset, devices) {
        this.memory = memory;
        this.startOffset = startOffset;
        this.devices = devices;

        this.threadPCs = new Uint16Array(THREAD_COUNT);

        this.threadRegisters = [];
        this.threadCompareFlags = [];

        for (let i = 0; i < THREAD_COUNT; i++) {
            this.threadPCs[i] = 0;
            this.threadRegisters[i] = new Uint8Array(THREAD_REGISTER_COUNT);
            this.threadCompareFlags[i] = { eq: false, lt: false, gt: false, overflow: false, zero: false };
        }

        this.activeThread = 0;
        this.threadPCs[this.activeThread] = startOffset;
        this.isHalted = false;
    }

    tick() {
        if (this.isHalted) return false;

        console.log('\n\nTICK thread', this.activeThread, '@ PC', this.threadPCs[this.activeThread]);
        let instructionOffset = this.threadPCs[this.activeThread];
        this.threadPCs[this.activeThread] += INSTRUCTION_SIZE;
        let [op, args] = decodeInstruction(this.memory, instructionOffset);

        function getOpName(op) {
            return Object.keys(OP).find(function(name) {
                return OP[name] == op;
            });
        }

        console.log('EXECUTE', getOpName(op), '<op ' + op + '>', args);

        this.execute(op, args);
        this.handleInterrupts();
    }

    execute(op, args) {
        // `let` scope in `switch` blocks is silly -- there's only one underlying
        //  scope, so we can't use `let` statements inside of each case.
        let addr, reg, reg1, reg2, val, val1, val2, offset;

        switch (op) {
            case OP.YIELD:
                let startThread = this.activeThread;
                do {
                    this.activeThread = (this.activeThread + 1) % THREAD_COUNT;
                } while (this.threadPCs[this.activeThread] === 0 && this.activeThread !== startThread);

                break;
            case OP.JUMP:
                addr = args[0];
                this.jump(addr);

                break;
            case OP.JUMP_REG:
                reg = args[0];
                addr = this.getRegister(reg);
                this.jump(addr);

                break;
            case OP.JUMP_IF_ZERO:
                reg = args[0];
                addr = args[1];

                if (this.getRegister(reg) === 0) {
                    this.jump(addr);
                }

                break;
            case OP.M2R:
                addr = args[0];
                reg = args[1];

                this.setRegister(reg, this.memory.getByte(addr));

                break;
            case OP.R2M:
                reg = args[0];
                addr = args[1];

                this.memory.setByte(addr, this.getRegister(reg));
                break;
            case OP.R2R:
                reg1 = args[0];
                reg2 = args[1];

                this.setRegister(reg2, this.getRegister(reg1));
                break;
            case OP.ADD:
                reg1 = args[0];
                reg2 = args[1];

                val = this.getRegister(reg1) + this.getRegister(reg2);
                if (val > 255) {
                    this.setOverflow(true);
                } else {
                    this.setOverflow(false);
                    this.setRegister(reg2, val);
                }

                break;
            case OP.SUB:
                reg1 = args[0];
                reg2 = args[1];

                val = this.getRegister(reg2) - this.getRegister(reg1);
                if (val < 0) {
                    this.setOverflow(true);
                } else {
                    this.setOverflow(false);
                    this.setRegister(reg2, val);
                }

                break;
            case OP.ZERO:
                reg = args[0];
                this.setRegister(reg, 0);

                break;
            case OP.INCR:
                reg = args[0];
                if (this.getRegister(reg) == 255) {
                    this.setOverflow(true);
                } else {
                    this.setOverflow(false);
                    this.setRegister(reg, this.getRegister(reg) + 1);
                }

                break;
            case OP.DECR:
                reg = args[0];
                if (this.getRegister(reg) == 0) {
                    this.setOverflow(true);
                } else {
                    this.setOverflow(false);
                    this.setRegister(this.getRegister(reg) - 1);
                }

                break;
            case OP.SPAWN:
                /**
                 *  TODO: right now, this halts if there are no inactive threads.
                 *  That's a crummy API; figure out something better.
                 */
                addr = args[0];

                // Find inactive thread
                console.log('want to spawn to ' + addr);
                console.log(this.threadPCs);
                let nextAvailableThread = this.threadPCs.findIndex((pc) => pc === 0);
                console.log('next available thread', nextAvailableThread);
                if (nextAvailableThread === undefined) {
                    this.halt('SPAWN when no inactive threads available');
                    return;
                }

                this.threadPCs[nextAvailableThread] = addr;
                this.activeThread = nextAvailableThread;

                break;
            case OP.STOP:
                let activeThreadCount = this.threadPCs.filter((pc) => pc > 0).length;
                if (activeThreadCount === 1) {
                    this.halt('STOP when only one thread active');
                    return;
                }

                this.threadPCs[this.activeThread] = 0x00;
                this.activeThread = (this.activeThread + 1) % THREAD_COUNT;

                break;
            case OP.LSHIFT:
                reg = args[0];
                val = this.getRegister(reg) << 1;
                if (val > 255) {
                    this.setOverflow(true);
                } else {
                    this.setOverflow(false);
                    this.setRegister(reg, val);
                }

                break;
            case OP.RSHIFT:
                reg = args[0];
                val = this.getRegister(reg) >> 1;

                if (val < 0) {
                    this.setOverflow(true);
                } else {
                    this.setOverflow(false);
                    this.setRegister(reg, val);
                }

                break;
            case OP.JUMP_UNLESS_ZERO:
                reg = args[0];
                addr = args[1];

                if (this.getRegister(reg) !== 0) {
                    this.jump(addr);
                }

                break;
            case OP.AND:
                reg1 = args[0];
                reg2 = args[1];

                this.setRegister(reg2, this.getRegister(reg1) & this.getRegister(reg2));

                break;
            case OP.OR:
                reg1 = args[0];
                reg2 = args[1];

                this.setRegister(reg2, this.getRegister(reg1) | this.getRegister(reg2));

                break;

            case OP.SET:
                val = args[0];
                reg = args[1];

                this.setRegister(reg, val);

                break;
            case OP.COMPARE:
                reg1 = args[0];
                reg2 = args[1];

                val1 = this.getRegister(reg1);
                val2 = this.getRegister(reg2);
                
                this.setCompareFlags(val1, val2);    
            break;
            case OP.IM2R:
                reg1 = args[0];
                reg2 = args[1];

                addr = this.getRegister(reg1);

                this.setRegister(reg2, this.memory.getByte(addr));

                break;
            case OP.XOR:
                reg1 = args[0];
                reg2 = args[1];

                this.setRegister(reg2, this.getRegister(reg1) ^ this.getRegister(reg2));

                break;
             case OP.NOT:
                reg1 = args[0];
                
                let mask = 0b11111111
                this.setRegister(reg1, ~this.getRegister(reg1) & mask); // mask ensures this only returns one byte
             case OP.MBTS:
                reg1 = args[0];
                offset = args[1];
                if (offset >= 8) {
                    this.halt('Illegal offset provided to MBTS');
                }

                val1 = this.memory.getBit(reg1, offset);
                this.setCompareFlags(val1, 0x1);
                this.memory.setBit(reg1, offset, 0x1);
                break;
        }
    }

    handleInterrupts() {
        let memory = this.memory;

        this.devices.forEach(function(device) {
            if(device.hasInterrupt) {
                console.log(`${device.name} has an available interrupt.`);

                // TODO: The device should actually contain a direct reference to the memory object that it can read and write from
                // TODO: This doesn't quite properly implement the spec, the status bits need to be set somwhere, and if the device is "doing it"
                // it should probably be done in the handleInterrupt method in the device instead of just passing the memory reference locations back here.

                let statusByteLocation = device.getStatusLocation();
                let output = memory.getByte(device.getOutputLocation());
                let input = device.handleInterrupt(output);

                memory.setByte(device.getInputLocation(), input);
            }
        });
    }

    setCompareFlags(val1, val2) {
        let flags = this.threadCompareFlags[this.activeThread];
        flags.eq = (val1 == val2);
        flags.lt = (val1 < val2);
        flags.gt = (val1 > val2);
        flags.overflow = false;
        flags.zero = false;
    }

    getOverflow() {
        return this.threadCompareFlags[this.activeThread].overflow;
    }

    setOverflow(val) {
        this.threadCompareFlags[this.activeThread].overflow = val;
    }

    getRegister(reg) {
        return this.getRegisterForThread(reg, this.activeThread);
    }

    getRegisterForThread(reg, thread) {
        switch (reg) {
            case REGISTER.T:
                // 2 bits; indicates which thread is running
                return this.activeThread;
                break;
            case REGISTER.TC:
                // 4 bits; indicates which threads are runnable
                return (this.threadPCs[0] > 0x00 ? 1 : 0)
                     + (this.threadPCs[1] > 0x00 ? 2 : 0)
                     + (this.threadPCs[2] > 0x00 ? 4 : 0)
                     + (this.threadPCs[3] > 0x00 ? 8 : 0);
                break;
            case REGISTER.PC:
                // 16 bits; indicates program counter of active thread
                return this.threadPCs[thread];
                break;
            case REGISTER.CE:
                // 1 bit; indicates whether last comparison was equal
                return this.threadCompareFlags[thread].eq ? 1 : 0;
                break;
            case REGISTER.CG:
                // 1 bit; indicates whether last comparison was greater than
                return this.threadCompareFlags[thread].gt ? 1 : 0;
                break;
            case REGISTER.CL:
                // 1 bit; indicates whether last comparison was less than
                return this.threadCompareFlags[thread].lt ? 1 : 0;
                break;
            case REGISTER.OF:
                // 1 bit; indicates whether last add/subtract overflowed
                return this.threadCompareFlags[thread].overflow ? 1 : 0;
                break;
            default:
                if (reg >= 0x00 && reg < THREAD_REGISTER_COUNT) {
                    return this.threadRegisters[thread][reg]
                } else {
                    this.halt('Illegal read to invalid register #' + reg);
                }
        }
    }

    setRegister(reg, value) {
        if (reg < 0x00 || reg >= THREAD_REGISTER_COUNT) {
            this.halt('Illegal write to register #' + reg);
        }

        if (value === undefined) throw new Error('wtf');
        if (value < 0 || value > 255) {
            throw new Error('setRegister called with invalid value');
        }
        console.log('setRegister ' + this.activeThread + '[' + reg + '] to ' + value);
        this.threadRegisters[this.activeThread][reg] = value;
    }

    halt(reason) {
        this.haltReason = reason;
        this.isHalted = true;
    }

    jump(addr) {
        if (addr < this.startOffset) {
            this.halt('Illegal jump address (' + addr + ' < ' + this.startOffset + ')');
        }
        this.threadPCs[this.activeThread] = addr;
    }
}

/**
 *  @return {Array} [0] -> op, [1] -> array of arguments to op
 */
function decodeInstruction(memory, offset) {
    let op = memory.getByte(offset);
    let args = [];

    let argOffset = offset + 1; // first byte is the instruction

    OP_INFO[op].args.forEach(function(size, i) {
        switch (size) {
            case 1:
                args[i] = memory.getByte(argOffset);
                argOffset += 1;
                break;
            case 2:
                if (op == OP.JUMP) {
                    console.log('Jump wants 2 bytes', offset, argOffset);
                    console.log('byte1', memory.getByte(argOffset));
                    console.log('byte2', memory.getByte(argOffset + 1));

                }
                args[i] = (256 * (memory.getByte(argOffset))) + memory.getByte(argOffset + 1);
                argOffset += 2;
                break;
        }
    });

    return [op, args];
}

if (typeof module == 'object') {
    module.exports = TCPU;
} else if (typeof define == 'function') {
    define(function() {
        return TCPU;
    });
}
