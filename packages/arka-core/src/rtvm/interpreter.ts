/**
 * RTVM Interpreter
 *
 * Deterministic bytecode interpreter for rule evaluation (Enhancement #3).
 */

import {
  Opcode,
  BuiltinFunction,
  type BytecodeProgram,
  type ConstantValue,
  opcodeName,
} from './bytecode.js';

/**
 * Execution context providing field values
 */
export interface ExecutionContext {
  /** Get field value by path (e.g., "loan.amount") */
  getField(path: string): unknown;

  /** Optional: Get current timestamp (for deterministic testing) */
  getNow?: () => number;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  /** Final boolean result */
  result: boolean;

  /** Execution metrics */
  metrics: {
    instructionsExecuted: number;
    maxStackDepth: number;
    executionTimeMs: number;
  };

  /** Any errors encountered */
  error?: string;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  /** Maximum instructions to execute (safety limit) */
  maxInstructions?: number;

  /** Enable debug tracing */
  debug?: boolean;
}

const DEFAULT_MAX_INSTRUCTIONS = 10000;

/**
 * RTVM Interpreter
 */
export class RTVMInterpreter {
  private program: BytecodeProgram;
  private context: ExecutionContext;
  private options: Required<ExecutionOptions>;

  // Execution state
  private stack: unknown[] = [];
  private locals: unknown[] = [];
  private pc = 0; // Program counter
  private instructionCount = 0;
  private maxStackDepth = 0;

  constructor(
    program: BytecodeProgram,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ) {
    this.program = program;
    this.context = context;
    this.options = {
      maxInstructions: options.maxInstructions ?? DEFAULT_MAX_INSTRUCTIONS,
      debug: options.debug ?? false,
    };
  }

  /**
   * Execute the program
   */
  execute(): ExecutionResult {
    const startTime = performance.now();

    try {
      // Reset state
      this.stack = [];
      this.locals = new Array(this.program.metadata.localCount).fill(null);
      this.pc = 0;
      this.instructionCount = 0;
      this.maxStackDepth = 0;

      // Execute instructions
      while (this.pc < this.program.instructions.length) {
        // Safety check
        if (this.instructionCount >= this.options.maxInstructions) {
          throw new Error(`Exceeded maximum instruction limit (${this.options.maxInstructions})`);
        }

        const instruction = this.program.instructions[this.pc];
        if (!instruction) {
          throw new Error(`No instruction at program counter ${this.pc}`);
        }
        this.instructionCount++;

        if (this.options.debug) {
          console.log(`[${this.pc}] ${opcodeName(instruction.opcode)} stack=${JSON.stringify(this.stack)}`);
        }

        // Execute instruction
        const shouldHalt = this.executeInstruction(instruction.opcode, instruction.operand, instruction.operand2);

        if (shouldHalt) {
          break;
        }

        // Track max stack depth
        if (this.stack.length > this.maxStackDepth) {
          this.maxStackDepth = this.stack.length;
        }
      }

      // Get final result
      const result = this.stack.length > 0 ? Boolean(this.pop()) : false;

      return {
        result,
        metrics: {
          instructionsExecuted: this.instructionCount,
          maxStackDepth: this.maxStackDepth,
          executionTimeMs: performance.now() - startTime,
        },
      };
    } catch (error) {
      return {
        result: false,
        metrics: {
          instructionsExecuted: this.instructionCount,
          maxStackDepth: this.maxStackDepth,
          executionTimeMs: performance.now() - startTime,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a single instruction
   */
  private executeInstruction(opcode: Opcode, operand?: number, operand2?: number): boolean {
    switch (opcode) {
      // Stack operations
      case Opcode.PUSH:
        this.push(operand);
        break;

      case Opcode.POP:
        this.pop();
        break;

      case Opcode.DUP:
        this.push(this.peek());
        break;

      // Load operations
      case Opcode.LOAD_FIELD: {
        const fieldPath = this.getConstantString(operand!);
        const value = this.context.getField(fieldPath);
        this.push(value);
        break;
      }

      case Opcode.LOAD_CONST: {
        const value = this.getConstantValue(operand!);
        this.push(value);
        break;
      }

      case Opcode.LOAD_VAR:
        this.push(this.locals[operand!]);
        break;

      // Store operations
      case Opcode.STORE_VAR:
        this.locals[operand!] = this.pop();
        break;

      // Comparison operations
      case Opcode.CMP_EQ: {
        const b = this.pop();
        const a = this.pop();
        this.push(this.equals(a, b));
        break;
      }

      case Opcode.CMP_NE: {
        const b = this.pop();
        const a = this.pop();
        this.push(!this.equals(a, b));
        break;
      }

      case Opcode.CMP_LT: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a < b);
        break;
      }

      case Opcode.CMP_LE: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a <= b);
        break;
      }

      case Opcode.CMP_GT: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a > b);
        break;
      }

      case Opcode.CMP_GE: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a >= b);
        break;
      }

      case Opcode.CMP_IN: {
        const arr = this.pop() as unknown[];
        const value = this.pop();
        this.push(Array.isArray(arr) && arr.includes(value));
        break;
      }

      case Opcode.CMP_NOT_IN: {
        const arr = this.pop() as unknown[];
        const value = this.pop();
        this.push(!Array.isArray(arr) || !arr.includes(value));
        break;
      }

      case Opcode.CMP_CONTAINS: {
        const needle = this.pop() as string;
        const haystack = this.pop();
        if (typeof haystack === 'string') {
          this.push(haystack.includes(needle));
        } else if (Array.isArray(haystack)) {
          this.push(haystack.includes(needle));
        } else {
          this.push(false);
        }
        break;
      }

      case Opcode.CMP_STARTS: {
        const prefix = this.pop() as string;
        const str = this.pop() as string;
        this.push(typeof str === 'string' && str.startsWith(prefix));
        break;
      }

      case Opcode.CMP_ENDS: {
        const suffix = this.pop() as string;
        const str = this.pop() as string;
        this.push(typeof str === 'string' && str.endsWith(suffix));
        break;
      }

      case Opcode.CMP_MATCHES: {
        const pattern = this.pop() as { pattern: string; flags?: string } | string;
        const str = this.pop() as string;
        try {
          const regex = typeof pattern === 'string'
            ? new RegExp(pattern)
            : new RegExp(pattern.pattern, pattern.flags);
          this.push(typeof str === 'string' && regex.test(str));
        } catch {
          this.push(false);
        }
        break;
      }

      case Opcode.CMP_EXISTS: {
        this.pop(); // Ignore the comparison value
        const value = this.pop();
        this.push(value !== null && value !== undefined);
        break;
      }

      // Logical operations
      case Opcode.AND: {
        const b = this.pop();
        const a = this.pop();
        this.push(Boolean(a) && Boolean(b));
        break;
      }

      case Opcode.OR: {
        const b = this.pop();
        const a = this.pop();
        this.push(Boolean(a) || Boolean(b));
        break;
      }

      case Opcode.NOT: {
        const a = this.pop();
        this.push(!a);
        break;
      }

      // Arithmetic operations
      case Opcode.ADD: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a + b);
        break;
      }

      case Opcode.SUB: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a - b);
        break;
      }

      case Opcode.MUL: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(a * b);
        break;
      }

      case Opcode.DIV: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(b !== 0 ? a / b : 0);
        break;
      }

      case Opcode.MOD: {
        const b = this.pop() as number;
        const a = this.pop() as number;
        this.push(b !== 0 ? a % b : 0);
        break;
      }

      // Control flow
      case Opcode.JUMP:
        this.pc = operand! - 1; // -1 because we increment after
        break;

      case Opcode.JUMP_IF:
        if (this.peek()) {
          this.pc = operand! - 1;
        }
        break;

      case Opcode.JUMP_IF_NOT:
        if (!this.peek()) {
          this.pc = operand! - 1;
        }
        break;

      // Function calls
      case Opcode.CALL:
        this.executeBuiltin(operand as BuiltinFunction);
        break;

      // Termination
      case Opcode.RETURN:
      case Opcode.HALT:
        return true;

      case Opcode.NOP:
        break;

      default: {
        const unknownOpcode = opcode as number;
        throw new Error(`Unknown opcode: 0x${unknownOpcode.toString(16)}`);
      }
    }

    this.pc++;
    return false;
  }

  /**
   * Execute built-in function
   */
  private executeBuiltin(func: BuiltinFunction): void {
    switch (func) {
      case BuiltinFunction.STRLEN: {
        const str = this.pop() as string;
        this.push(typeof str === 'string' ? str.length : 0);
        break;
      }

      case BuiltinFunction.LOWER: {
        const str = this.pop() as string;
        this.push(typeof str === 'string' ? str.toLowerCase() : str);
        break;
      }

      case BuiltinFunction.UPPER: {
        const str = this.pop() as string;
        this.push(typeof str === 'string' ? str.toUpperCase() : str);
        break;
      }

      case BuiltinFunction.TRIM: {
        const str = this.pop() as string;
        this.push(typeof str === 'string' ? str.trim() : str);
        break;
      }

      case BuiltinFunction.ABS: {
        const num = this.pop() as number;
        this.push(Math.abs(num));
        break;
      }

      case BuiltinFunction.FLOOR: {
        const num = this.pop() as number;
        this.push(Math.floor(num));
        break;
      }

      case BuiltinFunction.CEIL: {
        const num = this.pop() as number;
        this.push(Math.ceil(num));
        break;
      }

      case BuiltinFunction.ROUND: {
        const num = this.pop() as number;
        this.push(Math.round(num));
        break;
      }

      case BuiltinFunction.NOW: {
        const now = this.context.getNow ? this.context.getNow() : Date.now();
        this.push(now);
        break;
      }

      case BuiltinFunction.LEN: {
        const arr = this.pop() as unknown[];
        this.push(Array.isArray(arr) ? arr.length : 0);
        break;
      }

      case BuiltinFunction.SUM: {
        const arr = this.pop() as number[];
        this.push(Array.isArray(arr) ? arr.reduce((a, b) => a + b, 0) : 0);
        break;
      }

      case BuiltinFunction.AVG: {
        const arr = this.pop() as number[];
        if (Array.isArray(arr) && arr.length > 0) {
          this.push(arr.reduce((a, b) => a + b, 0) / arr.length);
        } else {
          this.push(0);
        }
        break;
      }

      case BuiltinFunction.MIN: {
        const arr = this.pop() as number[];
        this.push(Array.isArray(arr) && arr.length > 0 ? Math.min(...arr) : 0);
        break;
      }

      case BuiltinFunction.MAX: {
        const arr = this.pop() as number[];
        this.push(Array.isArray(arr) && arr.length > 0 ? Math.max(...arr) : 0);
        break;
      }

      default:
        throw new Error(`Unknown builtin function: ${func}`);
    }
  }

  // Stack operations
  private push(value: unknown): void {
    this.stack.push(value);
  }

  private pop(): unknown {
    if (this.stack.length === 0) {
      throw new Error('Stack underflow');
    }
    return this.stack.pop();
  }

  private peek(): unknown {
    if (this.stack.length === 0) {
      throw new Error('Stack underflow');
    }
    return this.stack[this.stack.length - 1];
  }

  // Constant access
  private getConstantValue(index: number): unknown {
    const constant = this.program.constants[index];
    if (!constant) {
      throw new Error(`No constant at index ${index}`);
    }
    return this.resolveConstant(constant);
  }

  private getConstantString(index: number): string {
    const constant = this.program.constants[index];
    if (!constant) {
      throw new Error(`No constant at index ${index}`);
    }
    if (constant.type !== 'string') {
      throw new Error(`Expected string constant at index ${index}, got ${constant.type}`);
    }
    return constant.value;
  }

  private resolveConstant(c: ConstantValue): unknown {
    switch (c.type) {
      case 'null':
        return null;
      case 'boolean':
        return c.value;
      case 'number':
        return c.value;
      case 'string':
        return c.value;
      case 'array':
        return c.value.map((v) => this.resolveConstant(v));
      case 'regex':
        return { pattern: c.pattern, flags: c.flags };
    }
  }

  // Comparison helpers
  private equals(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((v, i) => this.equals(v, b[i]));
    }
    return false;
  }
}

/**
 * Execute a bytecode program
 */
export function executeProgram(
  program: BytecodeProgram,
  context: ExecutionContext,
  options?: ExecutionOptions
): ExecutionResult {
  const interpreter = new RTVMInterpreter(program, context, options);
  return interpreter.execute();
}

/**
 * Create an execution context from an event payload
 */
export function createContextFromPayload(payload: Record<string, unknown>): ExecutionContext {
  return {
    getField(path: string): unknown {
      const parts = path.split('.');
      let current: unknown = payload;

      for (const part of parts) {
        if (current === null || current === undefined) {
          return undefined;
        }
        if (typeof current !== 'object') {
          return undefined;
        }
        current = (current as Record<string, unknown>)[part];
      }

      return current;
    },
  };
}
