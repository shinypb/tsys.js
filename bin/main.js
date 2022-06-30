'use strict';

let args = process.argv.slice(2);
if (args.length != 2) {
  console.log(`usage: ${process.argv[1]} <memory size in bytes> <memory_image.bin>`)
  process.exit(1);
}

const MEM_BASE_OFFSET = 0x80;

let TKeyboard = require('../lib/tkeyboard.js');
let TMemory = require('../lib/tmemory.js');
let TCPU = require('../lib/tcpu.js');
let fs = require('fs');

let mem_size = parseInt(args[0], 10);
let mem_img_filename = args[1];

console.log('Loading memory image...');
let mem_img = fs.readFileSync(mem_img_filename);
if (mem_img.length > mem_size) {
    console.error('Image is too big to fit into memory!');
    process.exit(1);
}

let devices = [
    new TKeyboard()
];

console.log('Creating memory:', mem_size, 'bytes')
let memory = new TMemory(mem_size);
console.log('Loading memory image at offset', MEM_BASE_OFFSET);
mem_img.forEach(function(b, i) {
    console.log(MEM_BASE_OFFSET + i + ' \t' + b);
    memory.setByte(MEM_BASE_OFFSET + i, b);
});

let cpu = new TCPU(memory, MEM_BASE_OFFSET, devices);
cpu.devices.forEach(function(d) {
    d.enable();
});

while (!cpu.isHalted) {
    cpu.tick();

    console.log('          A\tB\tC\tD\tE\tF\tG\tH');
    for (let i = 0; i < 4; i++) {
        console.log(i + ' @ ' + cpu.threadPCs[i] + '\t: ' + cpu.threadRegisters[i].join('\t'));
    }
    console.log('\n--------');
}

console.log('');
console.log('Halted! ' + cpu.haltReason);

cpu.devices.forEach(function(d) {
   d.disable();
});
