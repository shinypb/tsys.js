'use strict';

let TDevice = require('../lib/TDevice.js');
let KEY_BUFFER_SIZE = 25;
let NAME = "Keyboard";
let MEMORY_LOCATION = 0x0c;
let dataHandler = function(key) {
    let keyBuffer = keyboard.keyBuffer;

    // ctrl-c ( end of text )
    if ( key === '\u0003' ) {
        process.stdout.write(keyBuffer.join(""));
        process.exit();
    }

    keyBuffer.push(key);
    keyBuffer.length = keyBuffer.length < KEY_BUFFER_SIZE ? keyBuffer.length : KEY_BUFFER_SIZE;

    process.stdout.write(key);
};

class TKeyboard extends TDevice {
    constructor() {
        super(NAME, MEMORY_LOCATION);

        this.stdin = process.stdin;
        this.stdin.setEncoding( 'utf8' );

        this.keyBuffer = [];
    }

    enable () {
        super.enable();
        this.stdin.setRawMode(true);
        this.stdin.resume();
 
	let keyboard = this;

        // on any data into stdin
        this.stdin.on('data', dataHandler);
    }

    disable () {
        super.disable();
        this.stdin.removeListener('data', dataHandler);
        this.stdin.setRawMode(false);
        this.stdin.pause();
    }
}

if (typeof module == 'object') {
    module.exports = TKeyboard;
} else if (typeof define == 'function') {
    define(function() {
        return TKeyboard;
    });
}
