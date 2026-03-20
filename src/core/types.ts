// ============================================================
// TERMS
// ============================================================

export interface Variable {
  readonly kind: 'variable';
  readonly name: string;
}

export interface Constant {
  readonly kind: 'constant';
  readonly name: string;
}

export interface FunctionApp {
  readonly kind: 'function';
  readonly name: string;
  readonly args: readonly Term[];
}

export type Term = Variable | Constant | FunctionApp;

// ============================================================
// LITERALS AND CLAUSES
// ============================================================

export interface Atom {
  readonly predicate: string;
  readonly args: readonly Term[];
}

export interface Literal {
  readonly atom: Atom;
  readonly negated: boolean;
}

export interface Clause {
  readonly literals: readonly Literal[];
}

// ============================================================
// SUBSTITUTIONS
// ============================================================

export interface Binding {
  readonly variable: Variable;
  readonly term: Term;
}

export interface Substitution {
  readonly bindings: readonly Binding[];
}

export const EMPTY_SUBSTITUTION: Substitution = { bindings: [] };

// ============================================================
// RESOLUTION DERIVATION
// ============================================================

export interface ResolutionStep {
  readonly clause1Index: number;
  readonly clause2Index: number;
  readonly literal1: Literal;
  readonly literal2: Literal;
  readonly mgu1: Substitution;
  readonly mgu2: Substitution;
  readonly resolvent: Clause;
  readonly resolventIndex: number;
}

export interface SessionState {
  readonly taskId: string;
  readonly clauses: readonly Clause[];
  readonly initialClauseCount: number;
  readonly steps: readonly ResolutionStep[];
  readonly isComplete: boolean;
  readonly hintCounts: Map<string, number>;
}

// ============================================================
// TASKS
// ============================================================

export type TaskLogicType = 'propositional' | 'predicate';

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly logicType: TaskLogicType;
  readonly clauses: readonly string[];
  readonly constants?: readonly string[];
  readonly hints?: readonly string[];
}

export interface TaskFile {
  readonly tasks: readonly Task[];
}

// ============================================================
// SAVE / LOAD
// ============================================================

export interface SerializedStep {
  readonly clause1Index: number;
  readonly clause2Index: number;
  readonly literal1String: string;
  readonly literal2String: string;
  readonly mgu1String: string;
  readonly mgu2String: string;
  readonly resolventString: string;
  readonly resolventIndex: number;
}

export interface SaveData {
  readonly version: string;
  readonly taskId: string;
  readonly timestamp: string;
  readonly clauseStrings: readonly string[];
  readonly initialClauseCount: number;
  readonly steps: readonly SerializedStep[];
  readonly isComplete: boolean;
}

// ============================================================
// VALIDATION RESULTS
// ============================================================

export interface ValidationError {
  readonly valid: false;
  readonly errorKind:
    | 'invalid_clause_index'
    | 'no_complementary_literals'
    | 'incorrect_mgu'
    | 'mgu_not_most_general'
    | 'unification_fails'
    | 'incorrect_resolvent'
    | 'duplicate_clause';
  readonly message: string;
}

export interface AnswerValidationSuccess {
  readonly valid: true;
  readonly resolvent: Clause;
  readonly mgu1: Substitution;
  readonly mgu2: Substitution;
  readonly literal1: Literal;
  readonly literal2: Literal;
}

export type AnswerValidationResult = AnswerValidationSuccess | ValidationError;
