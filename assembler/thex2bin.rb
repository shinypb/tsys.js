#!/usr/bin/env ruby

def assert(value, msg = '')
  unless value
    puts "Assertion failed: #{msg}"
    abort
  end
end

output_bytes = []
ARGF.readlines.each do |line|
  instruction = line.split('#').first.strip
  next if instruction == ''

  assert instruction.match(/[a-z0-9]{8}/), 'Expected instruction to be 8 hexadecimal characters'
  i = 0
  while i < instruction.size
    output_bytes.push Integer(instruction.slice(i, 2), 16)
    i += 2
  end
end

print output_bytes.pack('c*')