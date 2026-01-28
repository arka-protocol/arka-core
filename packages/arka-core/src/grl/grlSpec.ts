/**
 * Global Rule Language (GRL) Specification
 *
 * Human-readable DSL for compliance rules with formal grammar
 * and parser (Enhancement #14).
 */

/**
 * GRL Token types
 */
export enum GRLTokenType {
  // Keywords
  RULE = 'RULE',
  WHEN = 'WHEN',
  THEN = 'THEN',
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  IF = 'IF',
  ELSE = 'ELSE',
  IN = 'IN',
  BETWEEN = 'BETWEEN',
  MATCHES = 'MATCHES',
  EXISTS = 'EXISTS',
  ALLOW = 'ALLOW',
  DENY = 'DENY',
  FLAG = 'FLAG',
  WITH = 'WITH',
  SEVERITY = 'SEVERITY',
  CODE = 'CODE',
  MESSAGE = 'MESSAGE',
  APPLIES_TO = 'APPLIES_TO',
  JURISDICTION = 'JURISDICTION',
  EFFECTIVE = 'EFFECTIVE',
  EXPIRES = 'EXPIRES',
  TAGS = 'TAGS',

  // Literals
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',
  REGEX = 'REGEX',

  // Operators
  EQ = 'EQ',           // ==
  NE = 'NE',           // !=
  LT = 'LT',           // <
  LE = 'LE',           // <=
  GT = 'GT',           // >
  GE = 'GE',           // >=
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',

  // Punctuation
  LPAREN = 'LPAREN',   // (
  RPAREN = 'RPAREN',   // )
  LBRACKET = 'LBRACKET', // [
  RBRACKET = 'RBRACKET', // ]
  COMMA = 'COMMA',     // ,
  DOT = 'DOT',         // .
  COLON = 'COLON',     // :

  // Identifiers
  IDENTIFIER = 'IDENTIFIER',
  FIELD_PATH = 'FIELD_PATH',

  // Special
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
  INVALID = 'INVALID',
}

/**
 * GRL Token
 */
export interface GRLToken {
  type: GRLTokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * GRL AST Node types
 */
export type GRLNode =
  | GRLRuleNode
  | GRLConditionNode
  | GRLConsequenceNode
  | GRLFieldNode
  | GRLLiteralNode
  | GRLArrayNode;

/**
 * Rule node
 */
export interface GRLRuleNode {
  type: 'rule';
  name: string;
  description?: string;
  condition: GRLConditionNode;
  consequence: GRLConsequenceNode;
  metadata: {
    appliesTo?: { entityType?: string; eventType?: string };
    jurisdiction?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    severity?: string;
    tags?: string[];
  };
}

/**
 * Condition nodes
 */
export type GRLConditionNode =
  | GRLAndCondition
  | GRLOrCondition
  | GRLNotCondition
  | GRLCompareCondition;

export interface GRLAndCondition {
  type: 'and';
  conditions: GRLConditionNode[];
}

export interface GRLOrCondition {
  type: 'or';
  conditions: GRLConditionNode[];
}

export interface GRLNotCondition {
  type: 'not';
  condition: GRLConditionNode;
}

export interface GRLCompareCondition {
  type: 'compare';
  field: string;
  operator: string;
  value: GRLLiteralNode | GRLArrayNode | GRLFieldNode;
}

/**
 * Consequence node
 */
export interface GRLConsequenceNode {
  type: 'consequence';
  decision: 'ALLOW' | 'DENY' | 'FLAG';
  code: string;
  message: string;
  remediation?: string;
}

/**
 * Field reference node
 */
export interface GRLFieldNode {
  type: 'field';
  path: string;
}

/**
 * Literal value node
 */
export interface GRLLiteralNode {
  type: 'literal';
  valueType: 'string' | 'number' | 'boolean' | 'null' | 'regex';
  value: unknown;
}

/**
 * Array node
 */
export interface GRLArrayNode {
  type: 'array';
  elements: (GRLLiteralNode | GRLFieldNode)[];
}

/**
 * Parse result
 */
export interface GRLParseResult {
  success: boolean;
  rules: GRLRuleNode[];
  errors: GRLParseError[];
}

/**
 * Parse error
 */
export interface GRLParseError {
  message: string;
  line: number;
  column: number;
  severity: 'ERROR' | 'WARNING';
}

/**
 * GRL Lexer
 */
export class GRLLexer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: GRLToken[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): GRLToken[] {
    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    this.tokens.push({ type: GRLTokenType.EOF, value: '', line: this.line, column: this.column });
    return this.tokens;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const char = this.source[this.pos];

      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else if (char === '\n') {
        this.advance();
        this.line++;
        this.column = 1;
      } else if (char === '/' && this.source[this.pos + 1] === '/') {
        // Single-line comment
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
          this.advance();
        }
      } else if (char === '/' && this.source[this.pos + 1] === '*') {
        // Multi-line comment
        this.advance(); // /
        this.advance(); // *
        while (this.pos < this.source.length - 1) {
          if (this.source[this.pos] === '*' && this.source[this.pos + 1] === '/') {
            this.advance(); // *
            this.advance(); // /
            break;
          }
          if (this.source[this.pos] === '\n') {
            this.line++;
            this.column = 1;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private nextToken(): GRLToken | null {
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.source[this.pos];

    // String literal
    if (char === '"' || char === "'") {
      return this.readString(char, startLine, startColumn);
    }

    // Number literal
    const nextChar = this.source[this.pos + 1];
    if (this.isDigit(char) || (char === '-' && nextChar !== undefined && this.isDigit(nextChar))) {
      return this.readNumber(startLine, startColumn);
    }

    // Regex literal
    if (char === '/' && nextChar !== '/' && nextChar !== '*') {
      return this.readRegex(startLine, startColumn);
    }

    // Operators and punctuation
    const opToken = this.readOperator(startLine, startColumn);
    if (opToken) return opToken;

    // Keywords and identifiers
    if (char && (this.isAlpha(char) || char === '_')) {
      return this.readIdentifier(startLine, startColumn);
    }

    // Invalid character
    this.advance();
    return { type: GRLTokenType.INVALID, value: char ?? '', line: startLine, column: startColumn };
  }

  private readString(quote: string, line: number, column: number): GRLToken {
    let value = '';
    this.advance(); // Opening quote

    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      if (this.source[this.pos] === '\\') {
        this.advance();
        if (this.pos < this.source.length) {
          const escaped = this.source[this.pos];
          switch (escaped) {
            case 'n': value += '\n'; break;
            case 't': value += '\t'; break;
            case 'r': value += '\r'; break;
            default: value += escaped;
          }
          this.advance();
        }
      } else {
        value += this.source[this.pos];
        this.advance();
      }
    }

    this.advance(); // Closing quote
    return { type: GRLTokenType.STRING, value, line, column };
  }

  private readNumber(line: number, column: number): GRLToken {
    let value = '';

    if (this.source[this.pos] === '-') {
      value += '-';
      this.advance();
    }

    while (this.pos < this.source.length && this.isDigit(this.source[this.pos]!)) {
      value += this.source[this.pos];
      this.advance();
    }

    if (this.pos < this.source.length && this.source[this.pos] === '.') {
      value += '.';
      this.advance();
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos]!)) {
        value += this.source[this.pos];
        this.advance();
      }
    }

    return { type: GRLTokenType.NUMBER, value, line, column };
  }

  private readRegex(line: number, column: number): GRLToken {
    let value = '';
    this.advance(); // Opening /

    while (this.pos < this.source.length && this.source[this.pos] !== '/') {
      if (this.source[this.pos] === '\\') {
        value += this.source[this.pos];
        this.advance();
        if (this.pos < this.source.length) {
          value += this.source[this.pos];
          this.advance();
        }
      } else {
        value += this.source[this.pos];
        this.advance();
      }
    }

    this.advance(); // Closing /

    // Read flags
    let flags = '';
    while (this.pos < this.source.length && this.source[this.pos] && this.isAlpha(this.source[this.pos])) {
      flags += this.source[this.pos];
      this.advance();
    }

    return { type: GRLTokenType.REGEX, value: `/${value}/${flags}`, line, column };
  }

  private readOperator(line: number, column: number): GRLToken | null {
    const twoChar = this.source.slice(this.pos, this.pos + 2);
    const oneChar = this.source[this.pos];

    const twoCharOps: Record<string, GRLTokenType> = {
      '==': GRLTokenType.EQ,
      '!=': GRLTokenType.NE,
      '<=': GRLTokenType.LE,
      '>=': GRLTokenType.GE,
    };

    if (twoCharOps[twoChar]) {
      this.advance();
      this.advance();
      return { type: twoCharOps[twoChar], value: twoChar, line, column };
    }

    const oneCharOps: Record<string, GRLTokenType> = {
      '<': GRLTokenType.LT,
      '>': GRLTokenType.GT,
      '(': GRLTokenType.LPAREN,
      ')': GRLTokenType.RPAREN,
      '[': GRLTokenType.LBRACKET,
      ']': GRLTokenType.RBRACKET,
      ',': GRLTokenType.COMMA,
      '.': GRLTokenType.DOT,
      ':': GRLTokenType.COLON,
    };

    if (oneChar && oneCharOps[oneChar]) {
      this.advance();
      return { type: oneCharOps[oneChar], value: oneChar, line, column };
    }

    return null;
  }

  private readIdentifier(line: number, column: number): GRLToken {
    let value = '';

    while (this.pos < this.source.length && this.source[this.pos] &&
           (this.isAlphaNumeric(this.source[this.pos]) || this.source[this.pos] === '_' || this.source[this.pos] === '.')) {
      value += this.source[this.pos];
      this.advance();
    }

    // Check for keywords
    const keywords: Record<string, GRLTokenType> = {
      RULE: GRLTokenType.RULE,
      WHEN: GRLTokenType.WHEN,
      THEN: GRLTokenType.THEN,
      AND: GRLTokenType.AND,
      OR: GRLTokenType.OR,
      NOT: GRLTokenType.NOT,
      IF: GRLTokenType.IF,
      ELSE: GRLTokenType.ELSE,
      IN: GRLTokenType.IN,
      BETWEEN: GRLTokenType.BETWEEN,
      MATCHES: GRLTokenType.MATCHES,
      EXISTS: GRLTokenType.EXISTS,
      ALLOW: GRLTokenType.ALLOW,
      DENY: GRLTokenType.DENY,
      FLAG: GRLTokenType.FLAG,
      WITH: GRLTokenType.WITH,
      SEVERITY: GRLTokenType.SEVERITY,
      CODE: GRLTokenType.CODE,
      MESSAGE: GRLTokenType.MESSAGE,
      APPLIES_TO: GRLTokenType.APPLIES_TO,
      JURISDICTION: GRLTokenType.JURISDICTION,
      EFFECTIVE: GRLTokenType.EFFECTIVE,
      EXPIRES: GRLTokenType.EXPIRES,
      TAGS: GRLTokenType.TAGS,
      CONTAINS: GRLTokenType.CONTAINS,
      STARTS_WITH: GRLTokenType.STARTS_WITH,
      ENDS_WITH: GRLTokenType.ENDS_WITH,
      true: GRLTokenType.BOOLEAN,
      false: GRLTokenType.BOOLEAN,
      null: GRLTokenType.NULL,
    };

    const upper = value.toUpperCase();
    const upperKeyword = keywords[upper];
    if (upperKeyword) {
      return { type: upperKeyword, value, line, column };
    }
    const valueKeyword = keywords[value];
    if (valueKeyword) {
      return { type: valueKeyword, value, line, column };
    }

    // Check if it's a field path
    if (value.includes('.')) {
      return { type: GRLTokenType.FIELD_PATH, value, line, column };
    }

    return { type: GRLTokenType.IDENTIFIER, value, line, column };
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private isDigit(char: string | undefined): boolean {
    if (!char) return false;
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string | undefined): boolean {
    if (!char) return false;
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }

  private isAlphaNumeric(char: string | undefined): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}

/**
 * GRL Parser
 */
export class GRLParser {
  private tokens: GRLToken[] = [];
  private pos = 0;
  private errors: GRLParseError[] = [];

  parse(source: string): GRLParseResult {
    const lexer = new GRLLexer(source);
    this.tokens = lexer.tokenize();
    this.pos = 0;
    this.errors = [];

    const rules: GRLRuleNode[] = [];

    while (!this.isAtEnd()) {
      try {
        const rule = this.parseRule();
        if (rule) {
          rules.push(rule);
        }
      } catch (error) {
        this.errors.push({
          message: (error as Error).message,
          line: this.current().line,
          column: this.current().column,
          severity: 'ERROR',
        });
        this.synchronize();
      }
    }

    return {
      success: this.errors.filter((e) => e.severity === 'ERROR').length === 0,
      rules,
      errors: this.errors,
    };
  }

  private parseRule(): GRLRuleNode | null {
    if (!this.match(GRLTokenType.RULE)) {
      return null;
    }

    const nameToken = this.consume(GRLTokenType.STRING, 'Expected rule name');
    const name = nameToken.value;

    // Parse optional metadata
    const metadata: GRLRuleNode['metadata'] = {};

    while (this.check(GRLTokenType.APPLIES_TO) ||
           this.check(GRLTokenType.JURISDICTION) ||
           this.check(GRLTokenType.SEVERITY) ||
           this.check(GRLTokenType.TAGS)) {
      if (this.match(GRLTokenType.APPLIES_TO)) {
        const entityType = this.consume(GRLTokenType.STRING, 'Expected entity type').value;
        metadata.appliesTo = { entityType };
      } else if (this.match(GRLTokenType.JURISDICTION)) {
        metadata.jurisdiction = this.consume(GRLTokenType.STRING, 'Expected jurisdiction').value;
      } else if (this.match(GRLTokenType.SEVERITY)) {
        metadata.severity = this.consume(GRLTokenType.IDENTIFIER, 'Expected severity').value;
      } else if (this.match(GRLTokenType.TAGS)) {
        metadata.tags = this.parseArray().map((e) => String((e as GRLLiteralNode).value));
      }
    }

    // Parse WHEN clause
    this.consume(GRLTokenType.WHEN, 'Expected WHEN');
    const condition = this.parseCondition();

    // Parse THEN clause
    this.consume(GRLTokenType.THEN, 'Expected THEN');
    const consequence = this.parseConsequence();

    return {
      type: 'rule',
      name,
      condition,
      consequence,
      metadata,
    };
  }

  private parseCondition(): GRLConditionNode {
    return this.parseOr();
  }

  private parseOr(): GRLConditionNode {
    let left = this.parseAnd();

    while (this.match(GRLTokenType.OR)) {
      const right = this.parseAnd();
      left = { type: 'or', conditions: [left, right] };
    }

    return left;
  }

  private parseAnd(): GRLConditionNode {
    let left = this.parseUnary();

    while (this.match(GRLTokenType.AND)) {
      const right = this.parseUnary();
      left = { type: 'and', conditions: [left, right] };
    }

    return left;
  }

  private parseUnary(): GRLConditionNode {
    if (this.match(GRLTokenType.NOT)) {
      const condition = this.parseUnary();
      return { type: 'not', condition };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): GRLConditionNode {
    if (this.match(GRLTokenType.LPAREN)) {
      const condition = this.parseCondition();
      this.consume(GRLTokenType.RPAREN, 'Expected )');
      return condition;
    }

    return this.parseComparison();
  }

  private parseComparison(): GRLCompareCondition {
    const field = this.parseFieldPath();

    // Parse operator
    const operator = this.parseOperator();

    // Parse value
    const value = this.parseValue();

    return {
      type: 'compare',
      field,
      operator,
      value,
    };
  }

  private parseFieldPath(): string {
    if (this.check(GRLTokenType.FIELD_PATH)) {
      return this.advance().value;
    }
    return this.consume(GRLTokenType.IDENTIFIER, 'Expected field name').value;
  }

  private parseOperator(): string {
    const opMap: Partial<Record<GRLTokenType, string>> = {
      [GRLTokenType.EQ]: '==',
      [GRLTokenType.NE]: '!=',
      [GRLTokenType.LT]: '<',
      [GRLTokenType.LE]: '<=',
      [GRLTokenType.GT]: '>',
      [GRLTokenType.GE]: '>=',
      [GRLTokenType.IN]: 'in',
      [GRLTokenType.CONTAINS]: 'contains',
      [GRLTokenType.STARTS_WITH]: 'starts_with',
      [GRLTokenType.ENDS_WITH]: 'ends_with',
      [GRLTokenType.MATCHES]: 'matches',
      [GRLTokenType.EXISTS]: 'exists',
    };

    for (const [tokenTypeStr, opString] of Object.entries(opMap)) {
      const tokenType = tokenTypeStr as GRLTokenType;
      if (this.match(tokenType)) {
        return opString!;
      }
    }

    throw new Error(`Expected operator at line ${this.current().line}`);
  }

  private parseValue(): GRLLiteralNode | GRLArrayNode | GRLFieldNode {
    if (this.check(GRLTokenType.LBRACKET)) {
      return { type: 'array', elements: this.parseArray() };
    }

    return this.parseLiteral();
  }

  private parseArray(): (GRLLiteralNode | GRLFieldNode)[] {
    this.consume(GRLTokenType.LBRACKET, 'Expected [');
    const elements: (GRLLiteralNode | GRLFieldNode)[] = [];

    if (!this.check(GRLTokenType.RBRACKET)) {
      do {
        elements.push(this.parseLiteral());
      } while (this.match(GRLTokenType.COMMA));
    }

    this.consume(GRLTokenType.RBRACKET, 'Expected ]');
    return elements;
  }

  private parseLiteral(): GRLLiteralNode | GRLFieldNode {
    if (this.check(GRLTokenType.STRING)) {
      return { type: 'literal', valueType: 'string', value: this.advance().value };
    }
    if (this.check(GRLTokenType.NUMBER)) {
      return { type: 'literal', valueType: 'number', value: parseFloat(this.advance().value) };
    }
    if (this.check(GRLTokenType.BOOLEAN)) {
      return { type: 'literal', valueType: 'boolean', value: this.advance().value === 'true' };
    }
    if (this.check(GRLTokenType.NULL)) {
      this.advance();
      return { type: 'literal', valueType: 'null', value: null };
    }
    if (this.check(GRLTokenType.REGEX)) {
      return { type: 'literal', valueType: 'regex', value: this.advance().value };
    }
    if (this.check(GRLTokenType.FIELD_PATH) || this.check(GRLTokenType.IDENTIFIER)) {
      return { type: 'field', path: this.advance().value };
    }

    throw new Error(`Expected value at line ${this.current().line}`);
  }

  private parseConsequence(): GRLConsequenceNode {
    let decision: 'ALLOW' | 'DENY' | 'FLAG' = 'FLAG';

    if (this.match(GRLTokenType.ALLOW)) {
      decision = 'ALLOW';
    } else if (this.match(GRLTokenType.DENY)) {
      decision = 'DENY';
    } else if (this.match(GRLTokenType.FLAG)) {
      decision = 'FLAG';
    }

    let code = 'DEFAULT';
    let message = '';

    this.consume(GRLTokenType.WITH, 'Expected WITH');

    while (this.check(GRLTokenType.CODE) || this.check(GRLTokenType.MESSAGE)) {
      if (this.match(GRLTokenType.CODE)) {
        code = this.consume(GRLTokenType.STRING, 'Expected code').value;
      } else if (this.match(GRLTokenType.MESSAGE)) {
        message = this.consume(GRLTokenType.STRING, 'Expected message').value;
      }
    }

    return {
      type: 'consequence',
      decision,
      code,
      message,
    };
  }

  // Helper methods

  private match(...types: GRLTokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: GRLTokenType): boolean {
    return this.current().type === type;
  }

  private advance(): GRLToken {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private current(): GRLToken {
    const token = this.tokens[this.pos];
    if (!token) {
      throw new Error(`No token at position ${this.pos}`);
    }
    return token;
  }

  private previous(): GRLToken {
    const token = this.tokens[this.pos - 1];
    if (!token) {
      throw new Error(`No token at position ${this.pos - 1}`);
    }
    return token;
  }

  private isAtEnd(): boolean {
    return this.current().type === GRLTokenType.EOF;
  }

  private consume(type: GRLTokenType, message: string): GRLToken {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} at line ${this.current().line}`);
  }

  private synchronize(): void {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.previous().type === GRLTokenType.THEN) return;
      if (this.check(GRLTokenType.RULE)) return;
      this.advance();
    }
  }
}

/**
 * Parse GRL source code
 */
export function parseGRL(source: string): GRLParseResult {
  const parser = new GRLParser();
  return parser.parse(source);
}

/**
 * Convert GRL AST to ArkaRule
 */
export function grlToArkaRule(grlRule: GRLRuleNode): import('@arka/types').ArkaRule {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: grlRule.name,
    description: grlRule.description ?? '',
    appliesToEntityType: grlRule.metadata.appliesTo?.entityType ?? null,
    appliesToEventType: grlRule.metadata.appliesTo?.eventType ?? null,
    jurisdiction: grlRule.metadata.jurisdiction ?? null,
    effectiveFrom: grlRule.metadata.effectiveFrom ?? null,
    effectiveTo: grlRule.metadata.effectiveTo ?? null,
    severity: (grlRule.metadata.severity as import('@arka/types').RuleSeverity) ?? 'MEDIUM',
    condition: convertCondition(grlRule.condition),
    consequence: {
      decision: grlRule.consequence.decision,
      code: grlRule.consequence.code,
      message: grlRule.consequence.message,
      remediation: grlRule.consequence.remediation,
    },
    tags: grlRule.metadata.tags ?? [],
    metadata: {},
  };
}

function convertCondition(cond: GRLConditionNode): import('@arka/types').ArkaCondition {
  switch (cond.type) {
    case 'and':
      return {
        type: 'and',
        conditions: cond.conditions.map(convertCondition),
      };
    case 'or':
      return {
        type: 'or',
        conditions: cond.conditions.map(convertCondition),
      };
    case 'not':
      return {
        type: 'not',
        condition: convertCondition(cond.condition),
      };
    case 'compare':
      return {
        type: 'compare',
        field: cond.field,
        operator: cond.operator as import('@arka/types').ComparisonOperator,
        value: extractValue(cond.value),
      };
  }
}

function extractValue(node: GRLLiteralNode | GRLArrayNode | GRLFieldNode): unknown {
  switch (node.type) {
    case 'literal':
      return node.value;
    case 'array':
      return node.elements.map((e) => extractValue(e));
    case 'field':
      return `$${node.path}`; // Field reference
  }
}

/**
 * Example GRL syntax
 */
export const GRL_EXAMPLE = `
// Example ARKA Global Rule Language

RULE "High APR Consumer Loan Check"
APPLIES_TO "consumer_loan"
JURISDICTION "US"
SEVERITY HIGH
TAGS ["lending", "consumer-protection", "apr"]

WHEN
  loan.apr > 36.0
  AND borrower.state IN ["CA", "NY", "TX"]
  AND loan.amount >= 1000

THEN
  DENY WITH
  CODE "APR_EXCEEDED_36"
  MESSAGE "APR exceeds 36% maximum for consumer loans in this state"

// Another rule example
RULE "Large Transaction Flagging"
APPLIES_TO "transaction"
SEVERITY MEDIUM

WHEN
  transaction.amount > 10000
  OR (transaction.type == "international" AND transaction.amount > 5000)

THEN
  FLAG WITH
  CODE "LARGE_TXN_REVIEW"
  MESSAGE "Transaction requires manual review due to amount"
`;
