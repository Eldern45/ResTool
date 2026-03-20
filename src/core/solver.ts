import type { Clause, Literal, Substitution } from './types';
import { EMPTY_SUBSTITUTION } from './types';
import {
  literalsEqual,
  applyToClause,
  applyToAtom,
  removeDuplicateLiterals,
  variablesInClause,
  renameVariables,
} from './substitution';
import { unifyAtoms } from './unifier';
import { printAtom, printLiteral, printClause, printSubstitution } from './printer';

// ============================================================
// SOLVER STEP
// ============================================================

export interface SolverStep {
  readonly idx1: number;
  readonly idx2: number;
  readonly mgu1: Substitution;
  readonly mgu2: Substitution;
  readonly resolvent: Clause;
  readonly literal1: Literal;
  readonly literal2: Literal;
}

// ============================================================
// FIND ALL VALID RESOLUTION STEPS FOR A CLAUSE PAIR
// ============================================================

function findResolutionsForPair(
  c1: Clause,
  c2: Clause,
  idx1: number,
  idx2: number,
): SolverStep[] {
  const steps: SolverStep[] = [];

  // Rename c2's variables to avoid overlap with c1
  const vars1 = variablesInClause(c1);
  const { renamed: c2Renamed, renaming } = renameVariables(c2, vars1, { value: 1 });

  for (const l1 of c1.literals) {
    for (let li2 = 0; li2 < c2.literals.length; li2++) {
      const l2orig = c2.literals[li2];
      const l2 = c2Renamed.literals[li2];

      if (l1.negated === l2.negated) continue;
      if (l1.atom.predicate !== l2.atom.predicate) continue;

      // For propositional: atoms trivially match
      if (l1.atom.args.length === 0 && l2.atom.args.length === 0) {
        const remaining1 = c1.literals.filter(l => !literalsEqual(l, l1));
        const remaining2 = c2.literals.filter(l => !literalsEqual(l, l2orig));
        const resolvent = removeDuplicateLiterals({
          literals: [...remaining1, ...remaining2],
        });
        steps.push({
          idx1, idx2,
          mgu1: EMPTY_SUBSTITUTION,
          mgu2: EMPTY_SUBSTITUTION,
          resolvent,
          literal1: l1,
          literal2: l2orig,
        });
        continue;
      }

      // Predicate: try to unify
      const result = unifyAtoms(l1.atom, l2.atom);
      if (!result.success) continue;

      const mgu = result.mgu;

      // Split MGU into σ1 (bindings for c1's vars) and σ2 (bindings for c2's renamed vars, un-renamed)
      const vars1Set = variablesInClause(c1);
      const renamedVars = new Map<string, string>();
      for (const b of renaming.bindings) {
        renamedVars.set(b.term.kind === 'variable' ? b.term.name : '', b.variable.name);
      }

      const mgu1Bindings = mgu.bindings.filter(b => vars1Set.has(b.variable.name));
      const mgu2RenamedBindings = mgu.bindings.filter(b => !vars1Set.has(b.variable.name));

      // Un-rename mgu2 bindings back to original c2 variable names
      const mgu2Bindings = mgu2RenamedBindings.map(b => {
        const origName = renamedVars.get(b.variable.name) ?? b.variable.name;
        return {
          variable: { kind: 'variable' as const, name: origName },
          term: unRenameTerm(b.term, renamedVars),
        };
      });

      const mgu1: Substitution = { bindings: mgu1Bindings.map(b => ({
        variable: b.variable,
        term: unRenameTerm(b.term, renamedVars),
      })) };
      const mgu2: Substitution = { bindings: mgu2Bindings };

      // Compute resolvent
      const remaining1 = c1.literals.filter(l => !literalsEqual(l, l1));
      const remaining2 = c2.literals.filter(l => !literalsEqual(l, l2orig));
      const sub1 = applyToClause({ literals: remaining1 }, mgu1);
      const sub2 = applyToClause({ literals: remaining2 }, mgu2);
      const resolvent = removeDuplicateLiterals({
        literals: [...sub1.literals, ...sub2.literals],
      });

      steps.push({
        idx1, idx2,
        mgu1, mgu2,
        resolvent,
        literal1: l1,
        literal2: l2orig,
      });
    }
  }

  return steps;
}

import type { Term } from './types';

function unRenameTerm(term: Term, renamedToOrig: Map<string, string>): Term {
  switch (term.kind) {
    case 'variable': {
      const orig = renamedToOrig.get(term.name);
      return orig ? { kind: 'variable', name: orig } : term;
    }
    case 'constant':
      return term;
    case 'function':
      return {
        kind: 'function',
        name: term.name,
        args: term.args.map(a => unRenameTerm(a, renamedToOrig)),
      };
  }
}

// ============================================================
// FIND NEXT STEP (any valid resolution from the current clause set)
// ============================================================

export function findNextStep(clauses: readonly Clause[]): SolverStep | null {
  // Try all pairs, prefer ones that produce shorter resolvents (closer to empty clause)
  let best: SolverStep | null = null;

  for (let i = 0; i < clauses.length; i++) {
    for (let j = i; j < clauses.length; j++) {
      const steps = findResolutionsForPair(clauses[i], clauses[j], i + 1, j + 1);
      for (const step of steps) {
        if (step.resolvent.literals.length === 0) {
          return step; // Empty clause — immediate win
        }
        if (!best || step.resolvent.literals.length < best.resolvent.literals.length) {
          best = step;
        }
      }
    }
  }

  return best;
}

// ============================================================
// FIND ALL RESOLVABLE STEPS FOR A SPECIFIC PAIR
// ============================================================

export function findStepsForPair(
  clauses: readonly Clause[],
  idx1: number,
  idx2: number,
): SolverStep[] {
  if (idx1 < 1 || idx1 > clauses.length || idx2 < 1 || idx2 > clauses.length) {
    return [];
  }
  return findResolutionsForPair(clauses[idx1 - 1], clauses[idx2 - 1], idx1, idx2);
}

// ============================================================
// HINT DATA
// ============================================================

export interface HintData {
  readonly errorKind: string;
  readonly maxLevel: number; // 2 for most errors, 3 for incorrect_resolvent

  // Level 1 data
  readonly level1Message: string;
  readonly level1Details?: string[];

  // Level 2 data
  readonly level2Message: string;
  readonly suggestedStep?: SolverStep;

  // Level 3 data (only for incorrect_resolvent)
  readonly level3Message?: string;
  readonly correctResolvent?: string;
}

// ============================================================
// DIAGNOSE A FAILED STEP
// ============================================================

export function diagnoseStep(
  clauses: readonly Clause[],
  idx1: number,
  idx2: number,
  userSub1: Substitution,
  userSub2: Substitution,
  _userResolvent: Clause,
  errorKind: string,
): HintData {
  switch (errorKind) {
    case 'no_complementary_literals':
      return diagnoseNoComplementary(clauses, idx1, idx2);
    case 'incorrect_mgu':
    case 'unification_fails':
      return diagnoseIncorrectMgu(clauses, idx1, idx2, userSub1, userSub2);
    case 'mgu_not_most_general':
      return diagnoseMguNotGeneral(clauses, idx1, idx2);
    case 'incorrect_resolvent':
      return diagnoseIncorrectResolvent(clauses, idx1, idx2, userSub1, userSub2);
    default:
      return {
        errorKind,
        maxLevel: 1,
        level1Message: 'An unexpected error occurred.',
        level2Message: '',
      };
  }
}

// ── no_complementary_literals ────────────────────────────────

function diagnoseNoComplementary(
  clauses: readonly Clause[],
  idx1: number,
  idx2: number,
): HintData {
  const c1 = clauses[idx1 - 1];
  const c2 = clauses[idx2 - 1];

  const preds1 = [...new Set(c1.literals.map(l => (l.negated ? '~' : '') + l.atom.predicate))];
  const preds2 = [...new Set(c2.literals.map(l => (l.negated ? '~' : '') + l.atom.predicate))];

  // Find a valid alternative step
  const alt = findNextStep(clauses);

  return {
    errorKind: 'no_complementary_literals',
    maxLevel: 2,
    level1Message:
      'These clauses share no complementary literal pair. A resolvable pair needs the same predicate positive in one clause and negative in the other.',
    level1Details: [
      `Clause ${idx1} has: ${preds1.join(', ')}`,
      `Clause ${idx2} has: ${preds2.join(', ')}`,
    ],
    level2Message: alt
      ? `Try resolving clause ${alt.idx1} with clause ${alt.idx2} instead.`
      : 'No valid resolution steps found in the current clause set.',
    suggestedStep: alt ?? undefined,
  };
}

// ── incorrect_mgu / unification_fails ────────────────────────

function diagnoseIncorrectMgu(
  clauses: readonly Clause[],
  idx1: number,
  idx2: number,
  userSub1: Substitution,
  userSub2: Substitution,
): HintData {
  const c1 = clauses[idx1 - 1];
  const c2 = clauses[idx2 - 1];

  // Show what the user's substitutions do to each complementary pair
  const details: string[] = [];
  for (const l1 of c1.literals) {
    for (const l2 of c2.literals) {
      if (l1.negated !== l2.negated && l1.atom.predicate === l2.atom.predicate) {
        const app1 = applyToAtom(l1.atom, userSub1);
        const app2 = applyToAtom(l2.atom, userSub2);
        details.push(
          `${printLiteral(l1)} with σ₁ → ${printAtom(app1)}`,
          `${printLiteral(l2)} with σ₂ → ${printAtom(app2)}`,
        );
      }
    }
  }

  // Find correct step for this pair
  const correctSteps = findStepsForPair(clauses, idx1, idx2);
  const correct = correctSteps[0];

  // If the pair is not unifiable at all, say so upfront
  if (!correct) {
    const alt = findNextStep(clauses);
    return {
      errorKind: 'incorrect_mgu',
      maxLevel: 2,
      level1Message:
        'These atoms cannot be unified — no substitution exists that makes them equal.',
      level1Details: details,
      level2Message: alt
        ? `Try resolving clause ${alt.idx1} with clause ${alt.idx2} instead.`
        : 'No valid resolution steps found in the current clause set.',
      suggestedStep: alt ?? undefined,
    };
  }

  return {
    errorKind: 'incorrect_mgu',
    maxLevel: 2,
    level1Message:
      'Your substitutions don\'t make the atoms equal. You need σ₁ and σ₂ such that L₁·σ₁ = L₂·σ₂.',
    level1Details: details,
    level2Message: `The correct MGUs are: σ₁ = ${printSubstitution(correct.mgu1)}, σ₂ = ${printSubstitution(correct.mgu2)}`,
    suggestedStep: correct,
  };
}

// ── mgu_not_most_general ─────────────────────────────────────

function diagnoseMguNotGeneral(
  clauses: readonly Clause[],
  idx1: number,
  idx2: number,
): HintData {
  const correctSteps = findStepsForPair(clauses, idx1, idx2);
  const correct = correctSteps[0];

  return {
    errorKind: 'mgu_not_most_general',
    maxLevel: 2,
    level1Message:
      'Your substitutions unify the atoms, but they\'re not the most general. A most general unifier uses variables wherever possible — try removing unnecessary bindings.',
    level2Message: correct
      ? `The most general MGUs are: σ₁ = ${printSubstitution(correct.mgu1)}, σ₂ = ${printSubstitution(correct.mgu2)}`
      : 'Could not compute the most general unifier for this pair.',
    suggestedStep: correct,
  };
}

// ── incorrect_resolvent ──────────────────────────────────────

function diagnoseIncorrectResolvent(
  clauses: readonly Clause[],
  idx1: number,
  idx2: number,
  userSub1: Substitution,
  userSub2: Substitution,
): HintData {
  const c1 = clauses[idx1 - 1];
  const c2 = clauses[idx2 - 1];

  // Find which pair the user's MGUs actually resolve on
  let resolvedLit1: Literal | undefined;
  let resolvedLit2: Literal | undefined;
  let remaining1: Literal[] = [];
  let remaining2: Literal[] = [];

  for (const l1 of c1.literals) {
    for (const l2 of c2.literals) {
      if (l1.negated !== l2.negated && l1.atom.predicate === l2.atom.predicate) {
        const app1 = applyToAtom(l1.atom, userSub1);
        const app2 = applyToAtom(l2.atom, userSub2);
        if (printAtom(app1) === printAtom(app2)) {
          resolvedLit1 = l1;
          resolvedLit2 = l2;
          remaining1 = c1.literals.filter(l => !literalsEqual(l, l1));
          remaining2 = c2.literals.filter(l => !literalsEqual(l, l2));
          break;
        }
      }
    }
    if (resolvedLit1) break;
  }

  const details: string[] = [];
  if (resolvedLit1 && resolvedLit2) {
    details.push(`Resolved on: ${printLiteral(resolvedLit1)} and ${printLiteral(resolvedLit2)}`);
  }

  // Compute the correct resolvent from user's MGUs
  let correctResolventStr: string | undefined;
  if (remaining1.length > 0 || remaining2.length > 0 || (resolvedLit1 && resolvedLit2)) {
    const sub1 = applyToClause({ literals: remaining1 }, userSub1);
    const sub2 = applyToClause({ literals: remaining2 }, userSub2);
    const correctResolvent = removeDuplicateLiterals({
      literals: [...sub1.literals, ...sub2.literals],
    });
    correctResolventStr = printClause(correctResolvent);
  }

  const rem1Strs = remaining1.map(l => printLiteral(l));
  const rem2Strs = remaining2.map(l => printLiteral(l));

  return {
    errorKind: 'incorrect_resolvent',
    maxLevel: 3,
    level1Message:
      'Your MGUs are correct! Remember: resolvent = (C₁ \\ {L₁})·σ₁ ∪ (C₂ \\ {L₂})·σ₂. Remove the resolved literals, then apply each substitution to the remaining ones.',
    level1Details: details,
    level2Message:
      `Remaining from C₁: {${rem1Strs.join(', ')}}. Remaining from C₂: {${rem2Strs.join(', ')}}. Now apply σ₁ and σ₂ respectively.`,
    level3Message: correctResolventStr
      ? `The resolvent is ${correctResolventStr}`
      : undefined,
    correctResolvent: correctResolventStr,
  };
}

