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
        return this.memoryLocation + TDevice.INPUT_BYTE_OFFSET;
    }

    getOutputLocation() {
        return this.memoryLocation + TDevice.OUTPUT_BYTE_OFFSET;
    }
}

TDevice.CONNECTED_OFFSET = 0;
TDevice.READ_AVAILABLE_OFFSET = 1;
TDevice.WRITE_AVAILABLE_OFFSET = 2;

TDevice.INPUT_BYTE_OFFSET = 1;
TDevice.OUTPUT_BYTE_OFFSET = 2;

if (typeof module == 'object') {
    module.exports = TDevice;
} else if (typeof define == 'function') {
    define(function() {
        return TDevice;
    });
}
