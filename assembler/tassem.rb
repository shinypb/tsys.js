#!/usr/bin/env ruby

require 'json'

REGISTERS = {}
REGISTERS[:A] = 0x00
REGISTERS[:B] = 0x01
REGISTERS[:C] = 0x02
REGISTERS[:D] = 0x03
REGISTERS[:E] = 0x04
REGISTERS[:F] = 0x05
REGISTERS[:G] = 0x06
REGISTERS[:H] = 0x07

REGISTERS[:T] = 0x80,
REGISTERS[:TC] = 0x81
REGISTERS[:PC] = 0x82 # note: PC is 2 bytes wide, hence jump from 0x82 to 0x84
REGISTERS[:CE] = 0x84
REGISTERS[:CG] = 0x85
REGISTERS[:CL] = 0x86
REGISTERS[:OF] = 0x87

OPS = []

instructionset = JSON.parse(File.read(File.join(File.dirname(__FILE__), '../lib/instructionset.json')))
instructionset.each do |instr|
    OPS[instr['code']] = instr['name'].to_sym
end

def assert(value, msg = '')
  unless value
    puts "Assertion failed: #{msg}"
    abort
  end
end

def to_op(value)
  OPS.index(value)
end

def to_register(register_number_or_name)
  register_number = if register_number_or_name.match(/^\d$/)
    register_number_or_name.to_i
  else
    REGISTERS[register_number_or_name.to_sym]
  end

  register_number.to_s(16).rjust(2, '0')
end

def to_address(value)
  value.to_s(16).rjust(4, '0')
end

def to_value(value)
    value.to_s(16).rjust(2, '0')
end

def MAKE_VALUE(value)
    [:value, GET_NUMBER(value)]
end

def MAKE_LABEL(label_name)
  [:set_label, label_name]
end

def MAKE_OP(op, *args)
  [:op, op].concat(args)
end

def GET_NUMBER(num)
    if num.start_with?('0x')
      Integer(num, 16)
    else
      num.to_i
    end
end

def MAKE_ADDRESS_OR_LABEL(address_or_label)
  if address_or_label.start_with?(':')
    [:get_label, address_or_label.split(':', 2).last.to_sym]
  else
    [:address, GET_NUMBER(address_or_label)]
  end
end

def MAKE_REGISTER(register)
  [:register, register]
end

def MAKE_DATA(data, line)
  [:data, nil, line].concat(data)
end

def MAKE_STRING(str, line)
  str_as_data = str.bytes.map do |byte|
    byte.to_s(16)
  end
  MAKE_DATA(str_as_data, line)
end

assembly = []
lines = ARGF.readlines.reject do |line|
  line.strip.start_with?('#')
end.map do |line|
  if line.strip.start_with?('+')
    filename = line.strip.slice(1, line.size)
    File.readlines(filename)
  else
    line
  end
end.flatten

base_address = 0
lines.each do |line|
  line = line.split('#', 2).first.strip
  next unless line.size > 0

  begin
    chunks = line.split(/\s+/, 2)
    if line.start_with?(':')
      label_name = line.split(':', 2).last.to_sym
      assert(!label_name.match(/^\d$/))

      assembly.push MAKE_LABEL(label_name)
    elsif line.start_with?('=')
      assert chunks[0] == '=BASE_ADDRESS'
      base_address = GET_NUMBER(chunks[1])

    elsif chunks.first == 'DATA'
      data = chunks.last.split(/\s+/).map do |hex|
        hex.to_i(16)
      end
      assembly.push MAKE_DATA(data, line)
    elsif chunks.first == 'STRING'
      assembly.push MAKE_STRING(chunks.last, line)
    else
      op, args = chunks
      op = op.upcase.to_sym
      args = (args || '').gsub('→', ',').gsub('->', ',').split(/\s*,\s*/)

      assembled_args = case op
        when :YIELD, :STOP, :HALT
          []
        when :MBTS
          [MAKE_VALUE(args[0]), MAKE_VALUE(args[1])]
        when :AND, :OR, :XOR
          [MAKE_REGISTER(args[0]), MAKE_REGISTER(args[1])]
        when :SET
          [MAKE_VALUE(args[0]), MAKE_REGISTER(args[1])]
        when :JUMP
          [MAKE_ADDRESS_OR_LABEL(args[0])]
        when :JUMP_UNLESS_ZERO, :JUMP_IF_ZERO
          [MAKE_REGISTER(args[0]), MAKE_ADDRESS_OR_LABEL(args[1])]
        when :JUMP_REG
          [MAKE_REGISTER(args[0])]
        when :M2R
          [MAKE_ADDRESS_OR_LABEL(args[0]), MAKE_REGISTER(args[1])]
        when :R2M
          [MAKE_REGISTER(args[0]), MAKE_ADDRESS_OR_LABEL(args[1])]
        when :R2R, :ADD, :SUB, :COMPARE, :IM2R
          [MAKE_REGISTER(args[0]), MAKE_REGISTER(args[1])]
        when :ZERO, :INCR, :DECR, :LSHIFT, :RSHIFT, :NOT
          [MAKE_REGISTER(args[0])]
        when :SPAWN
          [MAKE_ADDRESS_OR_LABEL(args[0])]
        else
          STDERR.puts "Unknown op #{op}"
          abort
      end

      assembly.push MAKE_OP(op, line, *assembled_args)
    end
  rescue => e
    puts "Error: #{e}"
    puts "Line: #{line}"
  end

end

# Find labels
address = base_address
labels = {}
assembly.each do |item|
  if item[0] == :set_label
    label_name = item[1]
    assert(labels[label_name] == nil)
    labels[label_name] = address
  else
    address += 4
  end
end

STDERR.puts "Labels: #{labels.inspect}"

# Assemble
address = 0
output = []
assembly.each do |item|
  command = item[0]
  op = item[1]
  original_input = item[2]
  args = item.slice(3, item.size)

  case command
    when :set_label
      # already did this
      output.push "          #  [#{address.to_s(16).rjust(4, '0')}] :#{op}"
    when :data
      args.each do |byte|
        output.push byte.to_s.rjust(8, '0') + "  #  [#{address.to_s(16).rjust(4, '0')}] #{original_input}"
        address += 4
      end
    when :op
      statement = []
      statement.push to_op(op).to_s(16).rjust(2, '0')
      STDERR.puts "#{op} -- #{statement.inspect}; #{args.inspect}"
      args.each do |arg|
        case arg[0]
          when :address
            statement.push to_address(arg[1])
          when :register
            statement.push to_register(arg[1])
          when :get_label
            label_name = arg[1]
            assert labels.has_key?(label_name), "Missing label #{arg[1]}"

            statement.push to_address(labels[label_name])
          when :value
            statement.push to_value(arg[1])
          else
            STDERR.puts "Unknown arg type #{arg[0]}"
            abort
        end
      end
      STDERR.puts "Pushed #{op} #{statement.inspect}"
      output.push statement.join('').ljust(8, '0') + "  #  [#{address.to_s(16).rjust(4, '0')}] #{original_input}"
      address += 4
    else
      STDERR.puts "Err! #{command}"
  end

end

puts output.join("\n")
