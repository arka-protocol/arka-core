/**
 * RTVM Bytecode Definition
 *
 * Defines the instruction set for the Rule-Time Virtual Machine (Enhancement #3).
 */

/**
 * Opcode definitions
 */
export enum Opcode {
  // Stack operations
  PUSH = 0x01,        // Push constant onto stack
  POP = 0x02,         // Pop top of stack
  DUP = 0x03,         // Duplicate top of stack

  // Load operations
  LOAD_FIELD = 0x10,  // Load field from context
  LOAD_CONST = 0x11,  // Load constant from constant pool
  LOAD_VAR = 0x12,    // Load variable from locals

  // Store operations
  STORE_VAR = 0x20,   // Store to local variable

  // Comparison operations
  CMP_EQ = 0x30,      // Equal
  CMP_NE = 0x31,      // Not equal
  CMP_LT = 0x32,      // Less than
  CMP_LE = 0x33,      // Less than or equal
  CMP_GT = 0x34,      // Greater than
  CMP_GE = 0x35,      // Greater than or equal
  CMP_IN = 0x36,      // In array
  CMP_NOT_IN = 0x37,  // Not in array
  CMP_CONTAINS = 0x38, // String/array contains
  CMP_STARTS = 0x39,  // Starts with
  CMP_ENDS = 0x3A,    // Ends with
  CMP_MATCHES = 0x3B, // Regex match
  CMP_EXISTS = 0x3C,  // Field exists (not null/undefined)

  // Logical operations
  AND = 0x40,         // Logical AND
  OR = 0x41,          // Logical OR
  NOT = 0x42,         // Logical NOT

  // Arithmetic operations (for computed fields)
  ADD = 0x50,
  SUB = 0x51,
  MUL = 0x52,
  DIV = 0x53,
  MOD = 0x54,

  // Control flow
  JUMP = 0x60,        // Unconditional jump
  JUMP_IF = 0x61,     // Jump if true
  JUMP_IF_NOT = 0x62, // Jump if false

  // Function-like operations
  CALL = 0x70,        // Call built-in function
  RETURN = 0x71,      // Return from evaluation

  // Special
  NOP = 0x00,         // No operation
  HALT = 0xFF,        // Halt execution
}

/**
 * Built-in function IDs for CALL instruction
 */
export enum BuiltinFunction {
  STRLEN = 0x01,      // String length
  LOWER = 0x02,       // To lowercase
  UPPER = 0x03,       // To uppercase
  TRIM = 0x04,        // Trim whitespace
  ABS = 0x05,         // Absolute value
  FLOOR = 0x06,       // Floor
  CEIL = 0x07,        // Ceiling
  ROUND = 0x08,       // Round
  NOW = 0x09,         // Current timestamp
  LEN = 0x0A,         // Array length
  SUM = 0x0B,         // Sum array
  AVG = 0x0C,         // Average array
  MIN = 0x0D,         // Minimum
  MAX = 0x0E,         // Maximum
}

/**
 * Single bytecode instruction
 */
export interface Instruction {
  /** Opcode */
  opcode: Opcode;

  /** Operand (index into constant pool, jump offset, etc.) */
  operand?: number;

  /** Optional second operand */
  operand2?: number;

  /** Source location for debugging */
  sourceLocation?: {
    line: number;
    column: number;
    source?: string;
  };
}

/**
 * Constant value types
 */
export type ConstantValue =
  | { type: 'null' }
  | { type: 'boolean'; value: boolean }
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'array'; value: ConstantValue[] }
  | { type: 'regex'; pattern: string; flags?: string };

/**
 * Compiled bytecode program
 */
export interface BytecodeProgram {
  /** Version of the bytecode format */
  version: number;

  /** Constant pool */
  constants: ConstantValue[];

  /** Instructions */
  instructions: Instruction[];

  /** Metadata */
  metadata: {
    /** Original rule ID */
    ruleId: string;

    /** Rule name */
    ruleName: string;

    /** Compilation timestamp */
    compiledAt: string;

    /** Source hash for cache invalidation */
    sourceHash: string;

    /** Estimated max stack depth */
    maxStackDepth: number;

    /** Number of local variables */
    localCount: number;
  };

  /** Debug symbols (optional) */
  debugSymbols?: {
    /** Field names referenced */
    fieldNames: string[];

    /** Local variable names */
    localNames: string[];
  };
}

/**
 * Helper to create instructions
 */
export function instruction(opcode: Opcode, operand?: number, operand2?: number): Instruction {
  return { opcode, operand, operand2 };
}

/**
 * Helper to create constant values
 */
export const constant = {
  null: (): ConstantValue => ({ type: 'null' }),
  boolean: (value: boolean): ConstantValue => ({ type: 'boolean', value }),
  number: (value: number): ConstantValue => ({ type: 'number', value }),
  string: (value: string): ConstantValue => ({ type: 'string', value }),
  array: (value: ConstantValue[]): ConstantValue => ({ type: 'array', value }),
  regex: (pattern: string, flags?: string): ConstantValue => ({ type: 'regex', pattern, flags }),
};

/**
 * Get opcode name for debugging
 */
export function opcodeName(opcode: Opcode): string {
  return Opcode[opcode] ?? `UNKNOWN(0x${opcode.toString(16)})`;
}

/**
 * Disassemble a program to human-readable format
 */
export function disassemble(program: BytecodeProgram): string {
  const lines: string[] = [];

  lines.push(`; ARKA RTVM Bytecode v${program.version}`);
  lines.push(`; Rule: ${program.metadata.ruleName} (${program.metadata.ruleId})`);
  lines.push(`; Compiled: ${program.metadata.compiledAt}`);
  lines.push('');

  lines.push('; Constants:');
  program.constants.forEach((c, i) => {
    lines.push(`  [${i}] ${formatConstant(c)}`);
  });
  lines.push('');

  lines.push('; Instructions:');
  program.instructions.forEach((inst, i) => {
    const op = opcodeName(inst.opcode).padEnd(12);
    const operands = inst.operand !== undefined
      ? inst.operand2 !== undefined
        ? `${inst.operand}, ${inst.operand2}`
        : `${inst.operand}`
      : '';
    lines.push(`  ${i.toString().padStart(4)}: ${op} ${operands}`);
  });

  return lines.join('\n');
}

/**
 * Format constant for display
 */
function formatConstant(c: ConstantValue): string {
  switch (c.type) {
    case 'null':
      return 'null';
    case 'boolean':
      return c.value.toString();
    case 'number':
      return c.value.toString();
    case 'string':
      return `"${c.value}"`;
    case 'array':
      return `[${c.value.map(formatConstant).join(', ')}]`;
    case 'regex':
      return `/${c.pattern}/${c.flags ?? ''}`;
  }
}
