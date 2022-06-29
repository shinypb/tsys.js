'use strict';

class TMemory {
    constructor(memSize) {
        this.bytes = new Uint8Array(memSize);
    }

    getByte(addr) {
        return this.bytes[addr];
    }

    setByte(addr, value) {
        this.bytes[addr] = value;
    }

    getBit(addr, offset) {
        return this.getByte(addr) >>> 7 - offset & 0b00000001;
    }

    setBit(addr, offset, value) {
        console.log("Got byte: " + this.getByte(addr).toString(2).padStart(8, 0));
        console.log("Setting offset: " + offset + " to " + value);
        if (value) {
          this.setByte(addr, this.getByte(addr) | 1 << 7 - offset);
         console.log("New byte: " + this.getByte(addr).toString(2).padStart(8, 0));
        } else {
          this.setByte(addr, this.getByte(addr) & ~(1 << 7 - offset));
        }
    }
}

if (typeof module == 'object') {
    module.exports = TMemory;
} else if (typeof define == 'function') {
    define(function() {
        return TMemory;
    });
}
