'use strict';

class TDevice {
    constructor(name, memoryLocation) {
        this.name = name;
        this.memoryLocation = memoryLocation;
        this.hasInterrupt = false;
    }

    enable() {
        console.log(`${this.name} (0x${this.memoryLocation.toString(16).padStart(2, "0")}) has been enabled!`);
    }

    disable() {
        console.log(`${this.name} (0x${this.memoryLocation.toString(16).padStart(2, "0")}) has been disabled!`);
    }
    
    handleInterrupt() {
        console.log("Interrupt handled by device");
        this.hasInterrupt = false;
    }

    getStatusLocation() {
        return this.memoryLocation;
    }

    getInputLocation() {
        return this.memoryLocation + 1;
    }

    getOutputLocation() {
        return this.memoryLocation + 2;
    }
}

TDevice.CONNECTED_OFFSET = 0;
TDevice.READ_AVAILABLE_OFFSET = 1;
TDevice.WRITE_AVAILABLE_OFFSET = 2;

if (typeof module == 'object') {
    module.exports = TDevice;
} else if (typeof define == 'function') {
    define(function() {
        return TDevice;
    });
}
