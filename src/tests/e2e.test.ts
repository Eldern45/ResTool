import { describe, it, expect } from 'vitest';
import { parseClause, parseSubstitution } from '../core/parser';
import { ProofSession } from '../core/session';
import { EMPTY_SUBSTITUTION } from '../core/types';
import { getTaskById, getTaskConstants } from '../core/taskLoader';

describe('E2E: prop-01 (propositional)', () => {
  it('completes a full propositional proof', () => {
    const task = getTaskById('prop-01')!;
    const c = new Set<string>();
    const clauses = task.clauses.map(s => parseClause(s, c));
    const session = new ProofSession(task, clauses, c);

    // Step 1: {A, B} resolve with {~B} on B -> {A}
    let r = session.resolveByAnswer(1, 3, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{A}', c));
    expect(r.valid).toBe(true);

    // Step 2: {A} resolve with {~A, C} on A -> {C}
    r = session.resolveByAnswer(5, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{C}', c));
    expect(r.valid).toBe(true);

    // Step 3: {C} resolve with {~C} on C -> {}
    r = session.resolveByAnswer(6, 4, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{}', c));
    expect(r.valid).toBe(true);
    expect(session.isComplete()).toBe(true);
  });
});

describe('E2E: pred-01 (predicate)', () => {
  it('completes a predicate logic proof', () => {
    const task = getTaskById('pred-01')!;
    const c = getTaskConstants(task);
    const clauses = task.clauses.map(s => parseClause(s, c));
    const session = new ProofSession(task, clauses, c);

    // Step 1: {P(x), Q(x)} resolve with {~P(a)} -> {Q(a)}
    let r = session.resolveByAnswer(
      1, 2,
      parseSubstitution('{x/a}', c),
      parseSubstitution('{}', c),
      parseClause('{Q(a)}', c),
    );
    expect(r.valid).toBe(true);

    // Step 2: {Q(a)} resolve with {~Q(a)} -> {}
    r = session.resolveByAnswer(
      4, 3,
      parseSubstitution('{}', c),
      parseSubstitution('{}', c),
      parseClause('{}', c),
    );
    expect(r.valid).toBe(true);
    expect(session.isComplete()).toBe(true);
  });
});

describe('E2E: pred-02 (function symbols)', () => {
  it('completes a proof with function symbols', () => {
    const task = getTaskById('pred-02')!;
    const c = getTaskConstants(task);
    const clauses = task.clauses.map(s => parseClause(s, c));
    const session = new ProofSession(task, clauses, c);

    // Step 1: {P(x, f(x))} resolve with {~P(a, y), Q(y)} -> {Q(f(a))}
    let r = session.resolveByAnswer(
      1, 2,
      parseSubstitution('{x/a}', c),
      parseSubstitution('{y/f(a)}', c),
      parseClause('{Q(f(a))}', c),
    );
    expect(r.valid).toBe(true);

    // Step 2: {Q(f(a))} resolve with {~Q(f(a))} -> {}
    r = session.resolveByAnswer(
      4, 3,
      parseSubstitution('{}', c),
      parseSubstitution('{}', c),
      parseClause('{}', c),
    );
    expect(r.valid).toBe(true);
    expect(session.isComplete()).toBe(true);
  });
});

describe('E2E: Undo/Redo', () => {
  it('undo restores state correctly', () => {
    // Inline task — prop-03 was removed from tasks.json
    const task = { id: 'prop-03', title: 'Undo test', logicType: 'propositional' as const, clauses: ['{A}', '{~A, B}', '{~B, C}', '{~C}'] };
    const c = new Set<string>();
    const clauses = task.clauses.map(s => parseClause(s, c));
    const session = new ProofSession(task, clauses, c);

    // {A} + {~A, B} → {B}
    session.resolveByAnswer(1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{B}', c));
    expect(session.getState().clauses.length).toBe(clauses.length + 1);

    // {B} + {~B, C} → {C}
    session.resolveByAnswer(5, 3, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{C}', c));
    expect(session.getState().clauses.length).toBe(clauses.length + 2);

    expect(session.undo()).toBe(true);
    expect(session.getState().clauses.length).toBe(clauses.length + 1);

    expect(session.undo()).toBe(true);
    expect(session.getState().clauses.length).toBe(clauses.length);

    expect(session.undo()).toBe(false);
  });
});

describe('E2E: Save/Load', () => {
  it('save, restore, and continue', () => {
    const task = getTaskById('prop-01')!;
    // prop-01 clauses: {A, B}, {~A, C}, {~B}, {~C}
    const c = new Set<string>();
    const clauses = task.clauses.map(s => parseClause(s, c));
    const session = new ProofSession(task, clauses, c);

    // {A, B} + {~B} → {A}
    session.resolveByAnswer(1, 3, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{A}', c));

    const saveData = session.toSaveData();
    const restored = ProofSession.fromSaveData(saveData, task, c);
    expect(restored.getState().clauses.length).toBe(clauses.length + 1);
    expect(restored.getState().steps.length).toBe(1);

    // Continue from restored: {A} + {~A, C} → {C}
    const r = restored.resolveByAnswer(5, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{C}', c));
    expect(r.valid).toBe(true);
  });
});

describe('E2E: Error feedback', () => {
  it('rejects invalid clause index', () => {
    const task = getTaskById('prop-01')!;
    const c = new Set<string>();
    const clauses = task.clauses.map(s => parseClause(s, c));
    const session = new ProofSession(task, clauses, c);

    const r = session.resolveByAnswer(1, 10, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{}', c));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errorKind).toBe('invalid_clause_index');
  });

  it('rejects when no complementary literal pair exists', () => {
    const task = getTaskById('prop-01')!;
    // prop-01 clauses: {A, B}, {~A, C}, {~B}, {~C}
    // clauses 3 and 4 are {~B} and {~C} — no complementary pair
    const c = new Set<string>();
    const clauses = task.clauses.map(s => parseClause(s, c));
    const session = new ProofSession(task, clauses, c);

    const r = session.resolveByAnswer(3, 4, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{}', c));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errorKind).toBe('no_complementary_literals');
  });

  it('rejects incorrect resolvent', () => {
    const task = getTaskById('prop-01')!;
    const c = new Set<string>();
    const clauses = task.clauses.map(s => parseClause(s, c));
    const session = new ProofSession(task, clauses, c);

    // {A, B} + {~A, C} → correct is {B, C}, submit wrong answer
    const r = session.resolveByAnswer(1, 2, EMPTY_SUBSTITUTION, EMPTY_SUBSTITUTION, parseClause('{A, C}', c));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errorKind).toBe('incorrect_resolvent');
  });
});

describe('E2E: Task 111 (overlapping variables)', () => {
  it('completes proof with overlapping variable names using resolveByAnswer', () => {
    // Inline task — 111 was removed from tasks.json
    const task = { id: '111', title: 'Introduction', logicType: 'predicate' as const, clauses: ['{V(f(x), x)}', '{~V(x, y), ~V(y, z), W(x, z)}', '{~W(y, a)}'], constants: ['a'] };
    const c = getTaskConstants(task);
    const clauses = task.clauses.map(s => parseClause(s, c));
    const session = new ProofSession(task, clauses, c);

    // Step 1: Resolve 1 and 2 on V
    // σ1 = {}, σ2 = {x/f(x), y/x}
    // Resolvent: {~V(x, z), W(f(x), z)}
    let r = session.resolveByAnswer(
      1, 2,
      parseSubstitution('{}', c),
      parseSubstitution('{x/f(x), y/x}', c),
      parseClause('{~V(x, z), W(f(x), z)}', c),
    );
    expect(r.valid).toBe(true);

    // Step 2: Resolve 4 with 1 on V
    // σ1 (clause 4) = {x/f(x), z/x}, σ2 (clause 1) = {}
    // Resolvent: {W(f(f(x)), x)}
    r = session.resolveByAnswer(
      4, 1,
      parseSubstitution('{x/f(x), z/x}', c),
      parseSubstitution('{}', c),
      parseClause('{W(f(f(x)), x)}', c),
    );
    expect(r.valid).toBe(true);

    // Step 3: Resolve 5 with 3 on W
    // σ1 = {x/a}, σ2 = {y/f(f(a))}
    // Resolvent: {}
    r = session.resolveByAnswer(
      5, 3,
      parseSubstitution('{x/a}', c),
      parseSubstitution('{y/f(f(a))}', c),
      parseClause('{}', c),
    );
    expect(r.valid).toBe(true);
    expect(session.isComplete()).toBe(true);
  });
});
