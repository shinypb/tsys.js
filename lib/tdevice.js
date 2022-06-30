'use strict';

class TDevice {
    constructor(name, memoryLocation) {
        this.name = name;
        this.memoryLocation = memoryLocation;
    }

    enable() {
        console.log(`${this.name} (0x${this.memoryLocation.toString(16).padStart(2, "0")}) has been enabled!`);
    }

    disable() {
        console.log(`${this.name} (0x${this.memoryLocation.toString(16).padStart(2, "0")}) has been disabled!`);
    }
}

if (typeof module == 'object') {
    module.exports = TDevice;
} else if (typeof define == 'function') {
    define(function() {
        return TDevice;
    });
}
