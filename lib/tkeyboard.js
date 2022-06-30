'use strict';

let TDevice = require('../lib/TDevice.js');
let KEY_BUFFER_SIZE = 25;
let NAME = "Keyboard";
let MEMORY_LOCATION = 0x0c;
let dataHandler = function(key) {
    let keyboard = this;
    let keyBuffer = keyboard.keyBuffer;

    // ctrl-c ( end of text )
    if ( key === '\u0003' ) {
        process.stdout.write(keyBuffer.join(""));
        process.exit();
    }

    keyBuffer.push(key);
    keyBuffer.length = keyBuffer.length < KEY_BUFFER_SIZE ? keyBuffer.length : KEY_BUFFER_SIZE;
    keyboard.hasInterrupt = true;
    
    process.stdout.write(key);
};

class TKeyboard extends TDevice {
    constructor() {
        super(NAME, MEMORY_LOCATION);

        this.stdin = process.stdin;
        this.stdin.setEncoding('utf8');

        this.keyBuffer = [];
        this.dataHandler = dataHandler.bind(this);
    }

    enable() {
        super.enable();
        this.stdin.setRawMode(true);
        this.stdin.resume();
        // on any data into stdin
        this.stdin.on('data', this.dataHandler);
    }

    disable() {
        super.disable();
        this.stdin.removeListener('data', this.dataHandler);
        this.stdin.setRawMode(false);
        this.stdin.pause();
    }

    handleInterrupt() {
        super.handleInterrupt();
        return this.keyBuffer.shift();
    }
}

if (typeof module == 'object') {
    module.exports = TKeyboard;
} else if (typeof define == 'function') {
    define(function() {
        return TKeyboard;
    });
}
