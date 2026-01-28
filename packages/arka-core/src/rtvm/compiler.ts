/**
 * RTVM Compiler
 *
 * Compiles ARKA Rule DSL to RTVM bytecode (Enhancement #3).
 */

import type { ArkaRule, ArkaCondition } from '@arka-protocol/types';
import { createHash } from 'crypto';
import {
  Opcode,
  type BytecodeProgram,
  type Instruction,
  type ConstantValue,
  instruction,
  constant,
} from './bytecode.js';

/**
 * Compiler state
 */
interface CompilerState {
  constants: ConstantValue[];
  instructions: Instruction[];
  constantMap: Map<string, number>;
  localCount: number;
  maxStackDepth: number;
  currentStackDepth: number;
  fieldNames: Set<string>;
}

/**
 * Compile a ARKA rule to bytecode
 */
export function compileRule(rule: ArkaRule): BytecodeProgram {
  const state: CompilerState = {
    constants: [],
    instructions: [],
    constantMap: new Map(),
    localCount: 0,
    maxStackDepth: 0,
    currentStackDepth: 0,
    fieldNames: new Set(),
  };

  // Compile the condition
  compileCondition(rule.condition, state);

  // Add return instruction
  emit(state, instruction(Opcode.RETURN));

  // Compute source hash
  const sourceHash = createHash('sha256')
    .update(JSON.stringify(rule.condition))
    .digest('hex')
    .substring(0, 16);

  return {
    version: 1,
    constants: state.constants,
    instructions: state.instructions,
    metadata: {
      ruleId: rule.id,
      ruleName: rule.name,
      compiledAt: new Date().toISOString(),
      sourceHash,
      maxStackDepth: state.maxStackDepth,
      localCount: state.localCount,
    },
    debugSymbols: {
      fieldNames: Array.from(state.fieldNames),
      localNames: [],
    },
  };
}

/**
 * Compile a condition to bytecode
 */
function compileCondition(condition: ArkaCondition, state: CompilerState): void {
  switch (condition.type) {
    case 'compare':
      compileCompare(condition, state);
      break;

    case 'and':
      compileAnd(condition.conditions, state);
      break;

    case 'or':
      compileOr(condition.conditions, state);
      break;

    case 'not':
      compileNot(condition.condition, state);
      break;

    default:
      throw new Error(`Unknown condition type: ${(condition as ArkaCondition).type}`);
  }
}

/**
 * Compile a comparison condition
 */
function compileCompare(
  condition: Extract<ArkaCondition, { type: 'compare' }>,
  state: CompilerState
): void {
  const { field, operator, value } = condition;

  // Load the field value
  const fieldIndex = addConstant(state, constant.string(field));
  emit(state, instruction(Opcode.LOAD_FIELD, fieldIndex));
  state.fieldNames.add(field);
  pushStack(state);

  // Load the comparison value
  const valueIndex = addConstant(state, valueToConstant(value));
  emit(state, instruction(Opcode.LOAD_CONST, valueIndex));
  pushStack(state);

  // Emit comparison opcode
  const compOpcode = operatorToOpcode(operator);
  emit(state, instruction(compOpcode));
  popStack(state); // Comparison consumes 2, produces 1
}

/**
 * Compile AND condition
 */
function compileAnd(conditions: ArkaCondition[], state: CompilerState): void {
  if (conditions.length === 0) {
    // Empty AND is true
    const trueIndex = addConstant(state, constant.boolean(true));
    emit(state, instruction(Opcode.LOAD_CONST, trueIndex));
    pushStack(state);
    return;
  }

  // Compile first condition
  const firstCondition = conditions[0];
  if (!firstCondition) {
    throw new Error('First condition is undefined');
  }
  compileCondition(firstCondition, state);

  // For each subsequent condition, AND with previous result
  for (let i = 1; i < conditions.length; i++) {
    // Short-circuit: if false, jump to end
    const jumpIndex = state.instructions.length;
    emit(state, instruction(Opcode.JUMP_IF_NOT, 0)); // Placeholder

    popStack(state);

    // Compile next condition
    const condition = conditions[i];
    if (!condition) {
      throw new Error(`Condition at index ${i} is undefined`);
    }
    compileCondition(condition, state);

    // AND the results
    emit(state, instruction(Opcode.AND));
    popStack(state); // AND consumes 2, produces 1
    pushStack(state);

    // Patch the jump
    const jumpInst = state.instructions[jumpIndex];
    if (!jumpInst) {
      throw new Error(`Jump instruction at index ${jumpIndex} is undefined`);
    }
    jumpInst.operand = state.instructions.length;
  }
}

/**
 * Compile OR condition
 */
function compileOr(conditions: ArkaCondition[], state: CompilerState): void {
  if (conditions.length === 0) {
    // Empty OR is false
    const falseIndex = addConstant(state, constant.boolean(false));
    emit(state, instruction(Opcode.LOAD_CONST, falseIndex));
    pushStack(state);
    return;
  }

  // Compile first condition
  const firstCondition = conditions[0];
  if (!firstCondition) {
    throw new Error('First condition is undefined');
  }
  compileCondition(firstCondition, state);

  // For each subsequent condition, OR with previous result
  for (let i = 1; i < conditions.length; i++) {
    // Short-circuit: if true, jump to end
    const jumpIndex = state.instructions.length;
    emit(state, instruction(Opcode.JUMP_IF, 0)); // Placeholder

    popStack(state);

    // Compile next condition
    const condition = conditions[i];
    if (!condition) {
      throw new Error(`Condition at index ${i} is undefined`);
    }
    compileCondition(condition, state);

    // OR the results
    emit(state, instruction(Opcode.OR));
    popStack(state); // OR consumes 2, produces 1
    pushStack(state);

    // Patch the jump
    const jumpInst = state.instructions[jumpIndex];
    if (!jumpInst) {
      throw new Error(`Jump instruction at index ${jumpIndex} is undefined`);
    }
    jumpInst.operand = state.instructions.length;
  }
}

/**
 * Compile NOT condition
 */
function compileNot(condition: ArkaCondition, state: CompilerState): void {
  compileCondition(condition, state);
  emit(state, instruction(Opcode.NOT));
  // NOT consumes 1, produces 1 - stack unchanged
}

/**
 * Convert operator to opcode
 */
function operatorToOpcode(operator: string): Opcode {
  switch (operator) {
    case '==':
    case 'eq':
      return Opcode.CMP_EQ;
    case '!=':
    case 'ne':
      return Opcode.CMP_NE;
    case '<':
    case 'lt':
      return Opcode.CMP_LT;
    case '<=':
    case 'le':
      return Opcode.CMP_LE;
    case '>':
    case 'gt':
      return Opcode.CMP_GT;
    case '>=':
    case 'ge':
      return Opcode.CMP_GE;
    case 'in':
      return Opcode.CMP_IN;
    case 'not_in':
      return Opcode.CMP_NOT_IN;
    case 'contains':
      return Opcode.CMP_CONTAINS;
    case 'not_contains':
      return Opcode.NOT; // Will need special handling
    case 'starts_with':
      return Opcode.CMP_STARTS;
    case 'ends_with':
      return Opcode.CMP_ENDS;
    case 'matches':
      return Opcode.CMP_MATCHES;
    case 'exists':
      return Opcode.CMP_EXISTS;
    case 'not_exists':
      return Opcode.CMP_EXISTS; // Will apply NOT after
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * Convert a value to a constant
 */
function valueToConstant(value: unknown): ConstantValue {
  if (value === null || value === undefined) {
    return constant.null();
  }

  if (typeof value === 'boolean') {
    return constant.boolean(value);
  }

  if (typeof value === 'number') {
    return constant.number(value);
  }

  if (typeof value === 'string') {
    return constant.string(value);
  }

  if (Array.isArray(value)) {
    return constant.array(value.map(valueToConstant));
  }

  if (typeof value === 'object' && value !== null) {
    // Check if it's a regex pattern
    const obj = value as Record<string, unknown>;
    if ('$regex' in obj) {
      return constant.regex(
        obj.$regex as string,
        obj.$flags as string | undefined
      );
    }
  }

  // Default to string representation
  return constant.string(String(value));
}

/**
 * Add a constant to the pool, returning its index
 */
function addConstant(state: CompilerState, value: ConstantValue): number {
  const key = JSON.stringify(value);

  // Check if already exists
  const existing = state.constantMap.get(key);
  if (existing !== undefined) {
    return existing;
  }

  // Add new constant
  const index = state.constants.length;
  state.constants.push(value);
  state.constantMap.set(key, index);
  return index;
}

/**
 * Emit an instruction
 */
function emit(state: CompilerState, inst: Instruction): void {
  state.instructions.push(inst);
}

/**
 * Track stack push
 */
function pushStack(state: CompilerState): void {
  state.currentStackDepth++;
  if (state.currentStackDepth > state.maxStackDepth) {
    state.maxStackDepth = state.currentStackDepth;
  }
}

/**
 * Track stack pop
 */
function popStack(state: CompilerState): void {
  state.currentStackDepth--;
}

/**
 * Compile multiple rules to bytecode
 */
export function compileRules(rules: ArkaRule[]): Map<string, BytecodeProgram> {
  const programs = new Map<string, BytecodeProgram>();

  for (const rule of rules) {
    try {
      const program = compileRule(rule);
      programs.set(rule.id, program);
    } catch (error) {
      // Log error but continue with other rules
      console.error(`Failed to compile rule ${rule.id}:`, error);
    }
  }

  return programs;
}

/**
 * Validate bytecode program
 */
export function validateProgram(program: BytecodeProgram): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check version
  if (program.version !== 1) {
    errors.push(`Unsupported bytecode version: ${program.version}`);
  }

  // Check instructions
  for (let i = 0; i < program.instructions.length; i++) {
    const inst = program.instructions[i];
    if (!inst) {
      errors.push(`Instruction ${i}: Instruction is undefined`);
      continue;
    }

    // Check constant references
    if (inst.opcode === Opcode.LOAD_CONST || inst.opcode === Opcode.LOAD_FIELD) {
      if (inst.operand === undefined || inst.operand >= program.constants.length) {
        errors.push(`Instruction ${i}: Invalid constant index ${inst.operand}`);
      }
    }

    // Check jump targets
    if (inst.opcode === Opcode.JUMP || inst.opcode === Opcode.JUMP_IF || inst.opcode === Opcode.JUMP_IF_NOT) {
      if (inst.operand === undefined || inst.operand < 0 || inst.operand > program.instructions.length) {
        errors.push(`Instruction ${i}: Invalid jump target ${inst.operand}`);
      }
    }
  }

  // Check for RETURN or HALT at end
  const lastInst = program.instructions[program.instructions.length - 1];
  if (lastInst?.opcode !== Opcode.RETURN && lastInst?.opcode !== Opcode.HALT) {
    errors.push('Program does not end with RETURN or HALT');
  }

  return { valid: errors.length === 0, errors };
}
