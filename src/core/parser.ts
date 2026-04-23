import type { Term, Atom, Literal, Clause, Substitution, Variable, Constant, FunctionApp, Binding } from './types';

// ============================================================
// PARSE ERROR
// ============================================================

export class ParseError extends Error {
  readonly position: number;
  readonly input: string;

  constructor(message: string, position: number, input: string) {
    super(message);
    this.name = 'ParseError';
    this.position = position;
    this.input = input;
  }

  formatError(): string {
    const pointer = ' '.repeat(this.position) + '^';
    return `${this.input}\n${pointer} ${this.message}`;
  }
}

// ============================================================
// TOKENIZER
// ============================================================

const TokenType = {
  LBRACE: 'LBRACE',
  RBRACE: 'RBRACE',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  TILDE: 'TILDE',
  SLASH: 'SLASH',
  UPPER_IDENT: 'UPPER_IDENT',
  LOWER_IDENT: 'LOWER_IDENT',
  EOF: 'EOF',
} as const;

type TokenType = (typeof TokenType)[keyof typeof TokenType];

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    const ch = input[i];
    switch (ch) {
      case '{': tokens.push({ type: TokenType.LBRACE, value: '{', position: i }); i++; break;
      case '}': tokens.push({ type: TokenType.RBRACE, value: '}', position: i }); i++; break;
      case '(': tokens.push({ type: TokenType.LPAREN, value: '(', position: i }); i++; break;
      case ')': tokens.push({ type: TokenType.RPAREN, value: ')', position: i }); i++; break;
      case '[': tokens.push({type: TokenType.LBRACE, value: '[', position: i }); i++; break;
      case ']': tokens.push({type: TokenType.RBRACE, value: ']', position: i }); i++; break;
      case ',': tokens.push({ type: TokenType.COMMA, value: ',', position: i }); i++; break;
      case '~': tokens.push({ type: TokenType.TILDE, value: '~', position: i }); i++; break; //TODO: fix tests
      case '¬': tokens.push({ type: TokenType.TILDE, value: ch, position: i }); i++; break;
      case '/': tokens.push({ type: TokenType.SLASH, value: '/', position: i }); i++; break; //TODO: fix tests
      case '←': tokens.push({ type: TokenType.SLASH, value: ch, position: i }); i++; break;
      default: {
        if (/[a-zA-Z]/.test(ch)) {
          const start = i;
          while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
            i++;
          }
          const value = input.slice(start, i);
          const type = /^[A-Z]/.test(value) ? TokenType.UPPER_IDENT : TokenType.LOWER_IDENT;
          tokens.push({ type, value, position: start });
        } else {
          throw new ParseError(`Unexpected character '${ch}'`, i, input);
        }
      }
    }
  }

  tokens.push({ type: TokenType.EOF, value: '', position: i });
  return tokens;
}

// ============================================================
// PARSER
// ============================================================

const DEFAULT_CONSTANTS = new Set(['a', 'b', 'c', 'd', 'e']);

class Parser {
  private pos = 0;
  private tokens: Token[];
  private input: string;
  private constants: ReadonlySet<string>;

  constructor(tokens: Token[], input: string, constants?: ReadonlySet<string>) {
    this.tokens = tokens;
    this.input = input;
    this.constants = constants ?? DEFAULT_CONSTANTS;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private expect(type: TokenType, context?: string): Token {
    const token = this.peek();
    if (token.type !== type) {
      const ctx = context ? ` ${context}` : '';
      throw new ParseError(
        `Expected ${type}${ctx}, got ${token.type}${token.value ? ` '${token.value}'` : ''}`,
        token.position,
        this.input,
      );
    }
    return this.advance();
  }

  // clause = '{' literal_list? '}'
  parseClause(): Clause {
    this.expect(TokenType.LBRACE);
    const literals: Literal[] = [];

    if (this.peek().type !== TokenType.RBRACE) {
      literals.push(this.parseLiteral());
      while (this.peek().type === TokenType.COMMA) {
        this.advance(); // consume comma
        literals.push(this.parseLiteral());
      }
    }

    this.expect(TokenType.RBRACE);
    return { literals };
  }

  // literal = '~'? atom
  parseLiteral(): Literal {
    let negated = false;
    if (this.peek().type === TokenType.TILDE) {
      this.advance();
      negated = true;
    }
    const atom = this.parseAtom();
    return { atom, negated };
  }

  // atom = UPPER_IDENT ( '(' term_list ')' )?
  parseAtom(): Atom {
    const nameToken = this.expect(TokenType.UPPER_IDENT, 'for predicate name');
    const predicate = nameToken.value;
    const args: Term[] = [];

    if (this.peek().type === TokenType.LPAREN) {
      this.advance(); // consume '('
      if (this.peek().type !== TokenType.RPAREN) {
        args.push(this.parseTerm());
        while (this.peek().type === TokenType.COMMA) {
          this.advance(); // consume comma
          args.push(this.parseTerm());
        }
      }
      this.expect(TokenType.RPAREN);
    }

    return { predicate, args };
  }

  // term = LOWER_IDENT '(' term_list ')' | LOWER_IDENT
  parseTerm(): Term {
    const token = this.expect(TokenType.LOWER_IDENT, 'for term');
    const name = token.value;

    // Lookahead: if followed by '(', it's a function application
    if (this.peek().type === TokenType.LPAREN) {
      this.advance(); // consume '('
      const args: Term[] = [];
      if (this.peek().type !== TokenType.RPAREN) {
        args.push(this.parseTerm());
        while (this.peek().type === TokenType.COMMA) {
          this.advance(); // consume comma
          args.push(this.parseTerm());
        }
      }
      this.expect(TokenType.RPAREN);
      return { kind: 'function', name, args } as FunctionApp;
    }

    // Otherwise: variable or constant
    if (this.constants.has(name)) {
      return { kind: 'constant', name } as Constant;
    }
    return { kind: 'variable', name } as Variable;
  }

  // substitution = '{' (binding (',' binding)*)? '}'
  // binding = LOWER_IDENT '/' term
  parseSubstitution(): Substitution {
    this.expect(TokenType.LBRACE);
    const bindings: Binding[] = [];

    if (this.peek().type !== TokenType.RBRACE) {
      bindings.push(this.parseBinding());
      while (this.peek().type === TokenType.COMMA) {
        this.advance(); // consume comma
        bindings.push(this.parseBinding());
      }
    }

    this.expect(TokenType.RBRACE);
    return { bindings };
  }

  private parseBinding(): Binding {
    const varToken = this.expect(TokenType.LOWER_IDENT, 'for variable name in binding');
    if (this.peek().type === TokenType.LPAREN) {
      throw new ParseError(
        `Left side of a binding must be a variable, not a function. Write 'variable←${varToken.value}(…)', not '${varToken.value}(…)←variable'.`,
        varToken.position,
        this.input,
      );
    }
    if (this.constants.has(varToken.value)) {
      throw new ParseError(
        `'${varToken.value}' is a constant — you can only substitute variables`,
        varToken.position,
        this.input,
      );
    }
    this.expect(TokenType.SLASH);
    const term = this.parseTerm();
    return {
      variable: { kind: 'variable', name: varToken.value },
      term,
    };
  }

  expectEnd(): void {
    if (this.peek().type !== TokenType.EOF) {
      const token = this.peek();
      throw new ParseError(
        `Unexpected token '${token.value}' after end of expression`,
        token.position,
        this.input,
      );
    }
  }
}

// ============================================================
// PUBLIC API
// ============================================================

export function parseClause(input: string, constants?: ReadonlySet<string>): Clause {
  const tokens = tokenize(input);
  const parser = new Parser(tokens, input, constants);
  const clause = parser.parseClause();
  parser.expectEnd();
  return clause;
}

export function parseLiteral(input: string, constants?: ReadonlySet<string>): Literal {
  const tokens = tokenize(input);
  const parser = new Parser(tokens, input, constants);
  const literal = parser.parseLiteral();
  parser.expectEnd();
  return literal;
}

export function parseTerm(input: string, constants?: ReadonlySet<string>): Term {
  const tokens = tokenize(input);
  const parser = new Parser(tokens, input, constants);
  const term = parser.parseTerm();
  parser.expectEnd();
  return term;
}

export function parseSubstitution(input: string, constants?: ReadonlySet<string>): Substitution {
  const tokens = tokenize(input);
  const parser = new Parser(tokens, input, constants);
  const sub = parser.parseSubstitution();
  parser.expectEnd();
  return sub;
}
