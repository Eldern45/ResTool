import type { Clause, Literal, Substitution, AnswerValidationResult } from './types';
import { EMPTY_SUBSTITUTION } from './types';
import {
  literalsEqual,
  clausesEqual,
  applyToClause,
  applyToAtom,
  atomsEqual,
  removeDuplicateLiterals,
} from './substitution';
import { validateStudentSubstitutions, unifyAtoms } from './unifier';


// ============================================================
// VALIDATE BY ANSWER (student provides expected resolvent)
// ============================================================

export function validateResolutionByAnswer(
  clauses: readonly Clause[],
  clause1Idx: number,
  clause2Idx: number,
  studentSub1: Substitution,
  studentSub2: Substitution,
  expectedResolvent: Clause,
): AnswerValidationResult {
  // console.log("validateResolutionByAnswer called with:", {
  //   clause1Idx,
  //   clause2Idx,
  //   clausesLength: clauses // all clauses
  // });
  // 1. Check indices
  if (clause1Idx < 1 || clause1Idx > clauses.length) {
    return {
      valid: false,
      errorKind: 'invalid_clause_index',
      message: `Clause index ${clause1Idx} is out of range (1-${clauses.length}).`,
    };
  }
  if (clause2Idx < 1 || clause2Idx > clauses.length) {
    return {
      valid: false,
      errorKind: 'invalid_clause_index',
      message: `Clause index ${clause2Idx} is out of range (1-${clauses.length}).`,
    };
  }

  const c1 = clauses[clause1Idx - 1];
  const c2 = clauses[clause2Idx - 1];

  // 2. Find all complementary literal pairs
  const pairs: Array<{ lit1: Literal; lit2: Literal }> = [];
  for (const l1 of c1.literals) {
    for (const l2 of c2.literals) {
      if (l1.negated !== l2.negated && l1.atom.predicate === l2.atom.predicate) {
        pairs.push({ lit1: l1, lit2: l2 });
      }
    }
  }

  if (pairs.length === 0) {
    return {
      valid: false,
      errorKind: 'no_complementary_literals',
      message: 'No complementary literal pair found between the selected clauses.',
    };
  }

  const isPropositional = c1.literals.every(l => l.atom.args.length === 0)
    && c2.literals.every(l => l.atom.args.length === 0);

  if (isPropositional) {
    if (studentSub1.bindings.length > 0 || studentSub2.bindings.length > 0) {
      return {
        valid: false,
        errorKind: 'incorrect_mgu',
        message: 'Propositional resolution does not require substitutions. Both should be empty {}.',
      };
    }

    // Try each complementary pair and check if resolvent matches
    for (const { lit1, lit2 } of pairs) {
      const remaining1 = c1.literals.filter(l => !literalsEqual(l, lit1));
      const remaining2 = c2.literals.filter(l => !literalsEqual(l, lit2));
      const resolvent = removeDuplicateLiterals({ literals: [...remaining1, ...remaining2] });

      if (clausesEqual(resolvent, expectedResolvent)) {
        if (clauses.some(c => clausesEqual(c, resolvent))) {
          return { valid: false, errorKind: 'duplicate_clause', message: 'This clause is already in the knowledge base.' };
        }
        return {
          valid: true,
          resolvent,
          mgu1: EMPTY_SUBSTITUTION,
          mgu2: EMPTY_SUBSTITUTION,
          literal1: lit1,
          literal2: lit2,
        };
      }
    }

    return {
      valid: false,
      errorKind: 'incorrect_resolvent',
      message: 'Incorrect resolvent.',
    };
  }

  // Predicate logic: find the pair where atom1·σ1 = atom2·σ2
  let mguError: AnswerValidationResult | null = null;

  for (const { lit1, lit2 } of pairs) {
    const applied1 = applyToAtom(lit1.atom, studentSub1);
    const applied2 = applyToAtom(lit2.atom, studentSub2);

    if (!atomsEqual(applied1, applied2)) continue;

    // Found matching pair — validate MGU most-generality
    const subCheck = validateStudentSubstitutions(
      lit1.atom, lit2.atom, studentSub1, studentSub2,
    );
    if (!subCheck.valid) {
      mguError = { valid: false, errorKind: subCheck.errorKind, message: subCheck.message };
      continue;
    }

    // Compute resolvent
    const remaining1 = c1.literals.filter(l => !literalsEqual(l, lit1));
    const remaining2 = c2.literals.filter(l => !literalsEqual(l, lit2));
    const substituted1 = applyToClause({ literals: remaining1 }, studentSub1);
    const substituted2 = applyToClause({ literals: remaining2 }, studentSub2);
    const resolvent = removeDuplicateLiterals({
      literals: [...substituted1.literals, ...substituted2.literals],
    });

    if (clausesEqual(resolvent, expectedResolvent)) {
      if (clauses.some(c => clausesEqual(c, resolvent))) {
        return { valid: false, errorKind: 'duplicate_clause', message: 'This clause is already in the knowledge base.' };
      }
      return {
        valid: true,
        resolvent,
        mgu1: studentSub1,
        mgu2: studentSub2,
        literal1: lit1,
        literal2: lit2,
      };
    }

    return {
      valid: false,
      errorKind: 'incorrect_resolvent',
      message: 'Incorrect resolvent.',
    };
  }

  // No pair matched the MGUs
  if (mguError) return mguError;

  // Distinguish: atoms fundamentally ununifiable vs student's substitution just wrong
  const anyUnifiable = pairs.some(({ lit1, lit2 }) => unifyAtoms(lit1.atom, lit2.atom).success);
  if (!anyUnifiable) {
    return {
      valid: false,
      errorKind: 'unification_fails',
      message: 'No complementary literal pair in these clauses can be unified.',
    };
  }

  return {
    valid: false,
    errorKind: 'incorrect_mgu',
    message: "Your substitutions don't make the atoms equal.",
  };
}
