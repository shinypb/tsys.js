'use strict';

const MEM_BASE_OFFSET = 0x80;

function initCPUWithMemoryImage(mem_img_filename) {
    return new Promise((resolve) => {
        fetch('./lib/instructionset.json').then((response) => {
            response.json().then((data) => {
                window.instruction_set = data;

                require(['./lib/tmemory.js', './lib/tcpu.js'], function(TMemory, TCPU) {
                    let mem_size = 1024;

                    console.log('Loading memory image...');
                    fetch('./demos/' + mem_img_filename).then(function(response) {
                        response.arrayBuffer().then((buffer) => {
                            let view = new Uint8Array(buffer);

                            let memory = new TMemory(mem_size);
                            for (let i = 0; i < buffer.byteLength; i++) {
                                memory.setByte(MEM_BASE_OFFSET + i, view[i]);
                            }
                            
                            let cpu = new TCPU(memory, MEM_BASE_OFFSET);
                            resolve(cpu);
                        });
                    });
                });
            });
        });
    });
}

function makeRegisterCell(value) {
    let hexValue = value.toString(16);
    let abbr = document.createElement('abbr');
    abbr.title = value;
    if (hexValue.length == 1) {
        abbr.innerText = '0' + hexValue;
    } else {
        abbr.innerText = hexValue;
    }
    
    let cell = document.createElement('td');
    cell.appendChild(abbr);

    return cell;
}

function updateUI(cpu) {
    const REGISTERS = cpu.constructor.REGISTERS;
    
    let registerRenderOrder = [ 'PC', 'T', 'TC', 'CE', 'CG', 'CL', 'CE', 'OF' ];
    Object.keys(REGISTERS).forEach((reg) => {
        if (!registerRenderOrder.includes(reg)) {
            registerRenderOrder.push(reg);
        }
    });

    let row = document.querySelector('#register_names');
    row.innerHTML = '<th></th>';
    registerRenderOrder.forEach((reg) => {
        let header = document.createElement('th');
        header.appendChild(document.createTextNode(reg));
        row.appendChild(header);
    });
    
    for (let i = 0; i < 4; i++) {
        let row = document.querySelector('#registers_' + i);
        row.innerHTML = '<td>T#' + i + '</td>';
        
        registerRenderOrder.forEach((reg) => {
            let value = cpu.getRegisterForThread(REGISTERS[reg], i);
            row.appendChild(makeRegisterCell(value));
        });
        
    }
}

// Figure out what memory image to load; it can be specified with ?img=filename
let filename;
let match = location.search.match(/\?img=(.+)/);
if (match && match[1]) {
    filename = match[1];
} else {
    filename = 'fibo.bin';
}

initCPUWithMemoryImage(filename).then((cpu) => {
    window.__cpu = cpu;
    
    function _pause() {
        document.querySelector('#pause').disabled = true;
        document.querySelector('#run').disabled = false;
        document.querySelector('#step').disabled = false;
    }

    function _run() {
        document.querySelector('#run').disabled = true;
        document.querySelector('#step').disabled = true;
        document.querySelector('#pause').disabled = false;
        
        document.querySelector('#state').classList.add('running');
        
        function _raf() {
            if (document.querySelector('#pause').disabled) {
                // someone has pressed the pause button
                return;
            }

            _step();

            if (cpu.isHalted) {
                document.querySelector('#state').classList.add('halted');
                document.querySelector('#state').classList.remove('running');
                document.querySelector('#pause').disabled = true;
                return;
            }

            requestAnimationFrame(_raf);
        }
        
        _raf();
    }
    
    function _step() {
        cpu.tick();
        updateUI(cpu);
    }

    document.querySelector('#pause').onclick = _pause;
    document.querySelector('#step').onclick = _step;
    document.querySelector('#run').onclick = _run

    _step();
});