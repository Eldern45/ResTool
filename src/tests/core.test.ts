import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';

import { parseClause, parseLiteral, parseTerm, parseSubstitution } from '../core/parser';
import { printClause, printTerm } from '../core/printer';
import {
  applyToTerm, applyToClause,
  clausesEqual, variablesInClause, renameVariables,
} from '../core/substitution';
import { unifyAtoms, validateStudentMGU, validateStudentSubstitutions } from '../core/unifier';
import { validateResolutionByAnswer } from '../core/resolution';
import { ProofSession } from '../core/session';
import { EMPTY_SUBSTITUTION } from '../core/types';
import type { Task } from '../core/types';

// ============================================================
// LOAD TEST DATA
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDataPath = join(__dirname, 'tests.json');
const testData = JSON.parse(readFileSync(testDataPath, 'utf-8'));

// ============================================================
// PARSER TESTS
// ============================================================

describe('Parser - Valid Clauses', () => {
  for (const tc of testData.parser.validClauses) {
    it(`parse "${tc.input}" -> ${tc.expectedLiteralCount} literal(s)`, () => {
      const clause = parseClause(tc.input);
      expect(clause.literals.length).toBe(tc.expectedLiteralCount);
    });
  }
});

describe('Parser - Invalid Clauses', () => {
  for (const tc of testData.parser.invalidClauses) {
    it(`reject "${tc.input}" (${tc.description})`, () => {
      expect(() => parseClause(tc.input)).toThrow();
    });
  }
});

describe('Parser - Round Trips', () => {
  for (const input of testData.parser.roundTrips) {
    it(`roundtrip "${input}"`, () => {
      const clause = parseClause(input);
      const output = printClause(clause);
      expect(output).toBe(input);
    });
  }
});

describe('Parser - Substitutions', () => {
  for (const tc of testData.parser.validSubstitutions) {
    it(`parse substitution "${tc.input}" -> ${tc.expectedBindingCount} binding(s)`, () => {
      const sub = parseSubstitution(tc.input);
      expect(sub.bindings.length).toBe(tc.expectedBindingCount);
    });
  }
});

// ============================================================
// SUBSTITUTION TESTS
// ============================================================

describe('Substitution - Apply to Term', () => {
  for (const tc of testData.substitution.applyToTerm) {
    it(`apply ${tc.substitution} to ${tc.term} -> ${tc.expected}`, () => {
      const constants = new Set(tc.constants as string[]);
      const term = parseTerm(tc.term, constants);
      const sub = parseSubstitution(tc.substitution, constants);
      const result = applyToTerm(term, sub);
      const resultStr = printTerm(result);
      expect(resultStr).toBe(tc.expected);
    });
  }
});

describe('Substitution - Apply to Clause', () => {
  for (const tc of testData.substitution.applyToClause) {
    it(`apply ${tc.substitution} to ${tc.clause} -> ${tc.expected}`, () => {
      const constants = new Set(tc.constants as string[]);
      const clause = parseClause(tc.clause, constants);
      const sub = parseSubstitution(tc.substitution, constants);
      const result = applyToClause(clause, sub);
      const resultStr = printClause(result);
      expect(resultStr).toBe(tc.expected);
    });
  }
});

describe('Substitution - Variable Renaming', () => {
  it('renaming produces no variable conflicts', () => {
    const c1 = parseClause('{P(x, y)}');
    const c2 = parseClause('{Q(x, z)}');
    const c1Vars = variablesInClause(c1);
    const { renamed } = renameVariables(c2, c1Vars, { value: 1 });
    const renamedVars = variablesInClause(renamed);
    for (const v of renamedVars) {
      expect(c1Vars.has(v)).toBe(false);
    }
  });

  it('renaming preserves clause structure', () => {
    const c = parseClause('{P(x), Q(x, y)}');
    const { renamed } = renameVariables(c, new Set(['a']), { value: 1 });
    expect(renamed.literals.length).toBe(2);
    expect(renamed.literals[0].atom.predicate).toBe('P');
    expect(renamed.literals[1].atom.predicate).toBe('Q');
  });
});

// ============================================================
// UNIFICATION TESTS
// ============================================================

describe('Unification - Success', () => {
  for (const tc of testData.unification.success) {
    it(`unify ${tc.atom1} and ${tc.atom2} (${tc.description})`, () => {
      const constants = new Set(tc.constants as string[]);
      const a1 = parseLiteral(tc.atom1, constants).atom;
      const a2 = parseLiteral(tc.atom2, constants).atom;
      const result = unifyAtoms(a1, a2);
      expect(result.success).toBe(true);
    });
  }
});

describe('Unification - Failure', () => {
  for (const tc of testData.unification.failure) {
    it(`fail to unify ${tc.atom1} and ${tc.atom2} (${tc.description})`, () => {
      const constants = new Set(tc.constants as string[]);
      const a1 = parseLiteral(tc.atom1, constants).atom;
      const a2 = parseLiteral(tc.atom2, constants).atom;
      const result = unifyAtoms(a1, a2);
      expect(result.success).toBe(false);
    });
  }
});

describe('Unification - Single MGU Validation (legacy)', () => {
  it('correct MGU is accepted', () => {
    const constants = new Set(['a']);
    const a1 = parseLiteral('P(x)', constants).atom;
    const a2 = parseLiteral('P(a)', constants).atom;
    const studentMGU = parseSubstitution('{x/a}', constants);
    const result = validateStudentMGU(a1, a2, studentMGU);
    expect(result.valid).toBe(true);
  });

  it('incorrect MGU is rejected', () => {
    const constants = new Set(['a', 'b']);
    const a1 = parseLiteral('P(x)', constants).atom;
    const a2 = parseLiteral('P(a)', constants).atom;
    const studentMGU = parseSubstitution('{x/b}', constants);
    const result = validateStudentMGU(a1, a2, studentMGU);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorKind).toBe('incorrect_mgu');
  });

  it('non-most-general unifier is rejected', () => {
    const constants = new Set(['a']);
    const a1 = parseLiteral('P(x, y)', constants).atom;
    const a2 = parseLiteral('P(y, z)', constants).atom;
    const studentMGU = parseSubstitution('{x/a, y/a, z/a}', constants);
    const result = validateStudentMGU(a1, a2, studentMGU);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorKind).toBe('mgu_not_most_general');
  });
});

describe('Unification - Two-Substitution Validation', () => {
  it('correct per-clause substitutions accepted (simple)', () => {
    const constants = new Set(['a']);
    const a1 = parseLiteral('P(x)', constants).atom;
    const a2 = parseLiteral('P(a)', constants).atom;
    const sub1 = parseSubstitution('{x/a}', constants);
    const sub2 = parseSubstitution('{}', constants);
    const result = validateStudentSubstitutions(a1, a2, sub1, sub2);
    expect(result.valid).toBe(true);
  });

  it('correct per-clause substitutions accepted (overlapping vars)', () => {
    const constants = new Set<string>();
    const a1 = parseLiteral('P(f(x), x)', constants).atom;
    const a2 = parseLiteral('P(x, y)', constants).atom;
    const sub1 = parseSubstitution('{}', constants);
    const sub2 = parseSubstitution('{x/f(x), y/x}', constants);
    const result = validateStudentSubstitutions(a1, a2, sub1, sub2);
    expect(result.valid).toBe(true);
  });

  it('incorrect per-clause substitutions rejected', () => {
    const constants = new Set(['a', 'b']);
    const a1 = parseLiteral('P(x)', constants).atom;
    const a2 = parseLiteral('P(a)', constants).atom;
    const sub1 = parseSubstitution('{x/b}', constants);
    const sub2 = parseSubstitution('{}', constants);
    const result = validateStudentSubstitutions(a1, a2, sub1, sub2);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorKind).toBe('incorrect_mgu');
  });

  it('non-most-general per-clause substitutions rejected', () => {
    const constants = new Set(['a']);
    const a1 = parseLiteral('P(x)', constants).atom;
    const a2 = parseLiteral('P(y)', constants).atom;
    const sub1 = parseSubstitution('{x/a}', constants);
    const sub2 = parseSubstitution('{y/a}', constants);
    const result = validateStudentSubstitutions(a1, a2, sub1, sub2);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorKind).toBe('mgu_not_most_general');
  });

  it('identity substitutions accepted when atoms already match', () => {
    const constants = new Set<string>();
    const a1 = parseLiteral('P(x)', constants).atom;
    const a2 = parseLiteral('P(x)', constants).atom;
    const sub1 = parseSubstitution('{}', constants);
    const sub2 = parseSubstitution('{}', constants);
    const result = validateStudentSubstitutions(a1, a2, sub1, sub2);
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// RESOLUTION TESTS
// ============================================================

describe('Resolution - Valid Steps', () => {
  for (const tc of testData.resolution.validSteps) {
    it(tc.description, () => {
      const constants = new Set(tc.constants as string[]);
      const clauses = (tc.clauses as string[]).map(s => parseClause(s, constants));
      const mgu1 = parseSubstitution(tc.mgu1, constants);
      const mgu2 = parseSubstitution(tc.mgu2, constants);
      const expected = parseClause(tc.expectedResolvent, constants);

      const result = validateResolutionByAnswer(
        clauses, tc.clause1Idx, tc.clause2Idx, mgu1, mgu2, expected,
      );
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(clausesEqual(result.resolvent, expected)).toBe(true);
      }
    });
  }
});

describe('Resolution - Invalid Steps', () => {
  it('invalid clause index', () => {
    const clauses = [parseClause('{A}'), parseClause('{~A}')];
    const result = validateResolutionByAnswer(
      clauses, 1, 5, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{}'),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorKind).toBe('invalid_clause_index');
  });

  it('no complementary literal pair', () => {
    const clauses = [parseClause('{A, B}'), parseClause('{A, C}')];
    const result = validateResolutionByAnswer(
      clauses, 1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{B, C}'),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorKind).toBe('no_complementary_literals');
  });

  it('incorrect resolvent rejected', () => {
    const clauses = [parseClause('{A, B}'), parseClause('{~A, C}')];
    const result = validateResolutionByAnswer(
      clauses, 1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{A, C}'),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorKind).toBe('incorrect_resolvent');
  });
});

describe('Resolution - Empty Clause Detection', () => {
  it('detect empty clause derivation', () => {
    const clauses = [parseClause('{A}'), parseClause('{~A}')];
    const result = validateResolutionByAnswer(
      clauses, 1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{}'),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.resolvent.literals.length).toBe(0);
    }
  });

  it('duplicate literals removed in resolvent', () => {
    const constants = new Set(['a']);
    const clauses = [
      parseClause('{P(x), Q(x)}', constants),
      parseClause('{~P(a), Q(a)}', constants),
    ];
    const mgu1 = parseSubstitution('{x/a}', constants);
    const mgu2 = parseSubstitution('{}', constants);
    const expected = parseClause('{Q(a)}', constants);

    const result = validateResolutionByAnswer(clauses, 1, 2, mgu1, mgu2, expected);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.resolvent.literals.length).toBe(1);
    }
  });
});

// ============================================================
// RESOLUTION BY ANSWER TESTS
// ============================================================

describe('Resolution - By Answer (propositional)', () => {
  it('correct resolvent accepted', () => {
    const clauses = [parseClause('{A, B}'), parseClause('{~A, C}')];
    const expected = parseClause('{B, C}');
    const result = validateResolutionByAnswer(
      clauses, 1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, expected,
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(clausesEqual(result.resolvent, expected)).toBe(true);
    }
  });

  it('incorrect resolvent rejected', () => {
    const clauses = [parseClause('{A, B}'), parseClause('{~A, C}')];
    const wrong = parseClause('{A, C}');
    const result = validateResolutionByAnswer(
      clauses, 1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, wrong,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorKind).toBe('incorrect_resolvent');
  });

  it('multiple complementary pairs, correct resolvent disambiguates', () => {
    // {A, B} vs {~A, ~B} has two pairs: (A,~A) -> {B,~B} and (B,~B) -> {A,~A}
    const clauses = [parseClause('{A, B}'), parseClause('{~A, ~B}')];
    const expected = parseClause('{B, ~B}');
    const result = validateResolutionByAnswer(
      clauses, 1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, expected,
    );
    expect(result.valid).toBe(true);
  });

  it('empty resolvent accepted', () => {
    const clauses = [parseClause('{A}'), parseClause('{~A}')];
    const expected = parseClause('{}');
    const result = validateResolutionByAnswer(
      clauses, 1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, expected,
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.resolvent.literals.length).toBe(0);
    }
  });
});

describe('Resolution - By Answer (predicate)', () => {
  it('correct MGUs + correct resolvent accepted', () => {
    const constants = new Set(['a']);
    const clauses = [
      parseClause('{P(x), Q(x)}', constants),
      parseClause('{~P(a)}', constants),
    ];
    const sub1 = parseSubstitution('{x/a}', constants);
    const sub2 = parseSubstitution('{}', constants);
    const expected = parseClause('{Q(a)}', constants);

    const result = validateResolutionByAnswer(clauses, 1, 2, sub1, sub2, expected);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(clausesEqual(result.resolvent, expected)).toBe(true);
    }
  });

  it('correct MGUs + wrong resolvent rejected', () => {
    const constants = new Set(['a']);
    const clauses = [
      parseClause('{P(x), Q(x)}', constants),
      parseClause('{~P(a)}', constants),
    ];
    const sub1 = parseSubstitution('{x/a}', constants);
    const sub2 = parseSubstitution('{}', constants);
    const wrong = parseClause('{Q(x)}', constants);

    const result = validateResolutionByAnswer(clauses, 1, 2, sub1, sub2, wrong);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorKind).toBe('incorrect_resolvent');
  });

  it('wrong MGUs rejected', () => {
    const constants = new Set(['a', 'b']);
    const clauses = [
      parseClause('{P(x)}', constants),
      parseClause('{~P(a)}', constants),
    ];
    const sub1 = parseSubstitution('{x/b}', constants);
    const sub2 = parseSubstitution('{}', constants);
    const expected = parseClause('{}', constants);

    const result = validateResolutionByAnswer(clauses, 1, 2, sub1, sub2, expected);
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// SESSION TESTS
// ============================================================

describe('Session - Basic Operations', () => {
  it('undo restores previous state', () => {
    const td = testData.session.undoTest;
    const task = td.task as Task;
    const constants = new Set<string>();
    const parsedClauses = (task.clauses as string[]).map(s => parseClause(s, constants));
    const session = new ProofSession(task, parsedClauses, constants);

    // {A, B} + {~A} → {B}
    session.resolveByAnswer(1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{B}'));
    // {A, B} + {~B} → {A}
    session.resolveByAnswer(1, 3, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{A}'));

    expect(session.getState().clauses.length).toBe(td.expectedClauseCountAfterSteps);

    const undone = session.undo();
    expect(undone).toBe(true);
    expect(session.getState().clauses.length).toBe(td.expectedClauseCountAfterUndo);
  });

  it('undo on empty stack returns false', () => {
    const task: Task = {
      id: 'test', title: 'Test',
      logicType: 'propositional',
      clauses: ['{A}'],
    };
    const session = new ProofSession(task, [parseClause('{A}')], new Set());
    expect(session.undo()).toBe(false);
  });

  it('isComplete detects empty clause', () => {
    const task: Task = {
      id: 'test', title: 'Test',
      logicType: 'propositional',
      clauses: ['{A}', '{~A}'],
    };
    const clauses = [parseClause('{A}'), parseClause('{~A}')];
    const session = new ProofSession(task, clauses, new Set());

    expect(session.isComplete()).toBe(false);

    session.resolveByAnswer(1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{}'));
    expect(session.isComplete()).toBe(true);
  });
});

describe('Session - Save/Load', () => {
  it('save and restore round-trip', () => {
    const task: Task = {
      id: 'prop-01', title: 'Test',
      logicType: 'propositional',
      clauses: ['{A, B}', '{~A}', '{~B}'],
    };
    const constants = new Set<string>();
    const clauses = task.clauses.map(s => parseClause(s, constants));
    const session = new ProofSession(task, clauses, constants);

    // {A, B} + {~A} → {B}
    session.resolveByAnswer(1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{B}'));

    const saveData = session.toSaveData();
    expect(saveData.taskId).toBe('prop-01');
    expect(saveData.steps.length).toBe(1);
    expect(saveData.clauseStrings.length).toBe(4);

    const restored = ProofSession.fromSaveData(saveData, task, constants);
    expect(restored.getState().clauses.length).toBe(4);
    expect(restored.getState().steps.length).toBe(1);
  });
});

// ============================================================
// SESSION - resolveByAnswer TESTS
// ============================================================

describe('Session - resolveByAnswer', () => {
  it('resolveByAnswer accepts correct resolvent and updates state', () => {
    const task: Task = {
      id: 'test', title: 'Test',
      logicType: 'propositional',
      clauses: ['{A, B}', '{~A, C}'],
    };
    const constants = new Set<string>();
    const clauses = task.clauses.map(s => parseClause(s, constants));
    const session = new ProofSession(task, clauses, constants);

    const expected = parseClause('{B, C}', constants);
    const result = session.resolveByAnswer(1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, expected);
    expect(result.valid).toBe(true);
    expect(session.getState().clauses.length).toBe(3);
    expect(session.getState().steps.length).toBe(1);
  });

  it('resolveByAnswer rejects wrong resolvent without changing state', () => {
    const task: Task = {
      id: 'test', title: 'Test',
      logicType: 'propositional',
      clauses: ['{A, B}', '{~A, C}'],
    };
    const constants = new Set<string>();
    const clauses = task.clauses.map(s => parseClause(s, constants));
    const session = new ProofSession(task, clauses, constants);

    const wrong = parseClause('{A, C}', constants);
    const result = session.resolveByAnswer(1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, wrong);
    expect(result.valid).toBe(false);
    expect(session.getState().clauses.length).toBe(2);
    expect(session.getState().steps.length).toBe(0);
  });
});
