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
}

if (typeof module == 'object') {
    module.exports = TMemory;
} else if (typeof define == 'function') {
    define(function() {
        return TMemory;
    });
}