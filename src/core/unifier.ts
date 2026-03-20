import type { Term, Atom, Substitution } from './types';
import { EMPTY_SUBSTITUTION } from './types';
import { applyToTerm, applyToAtom, termsEqual, atomsEqual, compose, variablesInTerm } from './substitution';
import { printTerm } from './printer';

// ============================================================
// UNIFICATION RESULT
// ============================================================

export type UnificationResult =
  | { success: true; mgu: Substitution }
  | { success: false; reason: string };

// ============================================================
// OCCURS CHECK
// ============================================================

export function occursIn(varName: string, term: Term): boolean {
  switch (term.kind) {
    case 'variable':
      return term.name === varName;
    case 'constant':
      return false;
    case 'function':
      return term.args.some(arg => occursIn(varName, arg));
  }
}

// ============================================================
// ROBINSON'S UNIFICATION ALGORITHM
// ============================================================

function unifyTermsWithSub(t1: Term, t2: Term, sigma: Substitution): UnificationResult {
  const s = applyToTerm(t1, sigma);
  const t = applyToTerm(t2, sigma);

  // If already equal, done
  if (termsEqual(s, t)) {
    return { success: true, mgu: sigma };
  }

  // Variable cases
  if (s.kind === 'variable') {
    if (occursIn(s.name, t)) {
      return { success: false, reason: `Occurs check failed: ${s.name} occurs in ${printTerm(t)}` };
    }
    const newBinding: Substitution = {
      bindings: [{ variable: { kind: 'variable', name: s.name }, term: t }],
    };
    return { success: true, mgu: compose(sigma, newBinding) };
  }

  if (t.kind === 'variable') {
    if (occursIn(t.name, s)) {
      return { success: false, reason: `Occurs check failed: ${t.name} occurs in ${printTerm(s)}` };
    }
    const newBinding: Substitution = {
      bindings: [{ variable: { kind: 'variable', name: t.name }, term: s }],
    };
    return { success: true, mgu: compose(sigma, newBinding) };
  }

  // Constant-constant
  if (s.kind === 'constant' && t.kind === 'constant') {
    if (s.name === t.name) {
      return { success: true, mgu: sigma };
    }
    return { success: false, reason: `Cannot unify constants ${s.name} and ${t.name}` };
  }

  // Function-function
  if (s.kind === 'function' && t.kind === 'function') {
    if (s.name !== t.name) {
      return { success: false, reason: `Cannot unify functions ${s.name} and ${t.name}` };
    }
    if (s.args.length !== t.args.length) {
      return {
        success: false,
        reason: `Arity mismatch: ${s.name}/${s.args.length} vs ${t.name}/${t.args.length}`,
      };
    }
    let currentSub = sigma;
    for (let i = 0; i < s.args.length; i++) {
      const result = unifyTermsWithSub(s.args[i], t.args[i], currentSub);
      if (!result.success) return result;
      currentSub = result.mgu;
    }
    return { success: true, mgu: currentSub };
  }

  // Mismatched kinds (constant vs function, etc.)
  return {
    success: false,
    reason: `Cannot unify ${printTerm(s)} with ${printTerm(t)}`,
  };
}

export function unifyTerms(t1: Term, t2: Term): UnificationResult {
  return unifyTermsWithSub(t1, t2, EMPTY_SUBSTITUTION);
}

export function unifyAtoms(a1: Atom, a2: Atom): UnificationResult {
  if (a1.predicate !== a2.predicate) {
    return { success: false, reason: `Different predicates: ${a1.predicate} vs ${a2.predicate}` };
  }
  if (a1.args.length !== a2.args.length) {
    return {
      success: false,
      reason: `Arity mismatch: ${a1.predicate}/${a1.args.length} vs ${a2.predicate}/${a2.args.length}`,
    };
  }
  if (a1.args.length === 0) {
    // Propositional atoms - trivially unify
    return { success: true, mgu: EMPTY_SUBSTITUTION };
  }

  let sigma = EMPTY_SUBSTITUTION;
  for (let i = 0; i < a1.args.length; i++) {
    const result = unifyTermsWithSub(a1.args[i], a2.args[i], sigma);
    if (!result.success) return result;
    sigma = result.mgu;
  }
  return { success: true, mgu: sigma };
}

// ============================================================
// VALIDATE STUDENT'S MGU (single substitution - kept for reference)
// ============================================================

export type MGUValidationResult =
  | { valid: true }
  | { valid: false; errorKind: 'incorrect_mgu' | 'mgu_not_most_general'; message: string };

export function validateStudentMGU(
  atom1: Atom,
  atom2: Atom,
  studentSub: Substitution,
): MGUValidationResult {
  // 1. Check student's sub actually unifies the atoms
  const applied1 = applyToAtom(atom1, studentSub);
  const applied2 = applyToAtom(atom2, studentSub);

  if (!atomsEqual(applied1, applied2)) {
    return {
      valid: false,
      errorKind: 'incorrect_mgu',
      message: "Your substitution doesn't make the atoms equal.",
    };
  }

  // 2. Compute the system's MGU
  const systemResult = unifyAtoms(atom1, atom2);
  if (!systemResult.success) {
    return {
      valid: false,
      errorKind: 'incorrect_mgu',
      message: 'These atoms cannot be unified.',
    };
  }

  // 3. Check most-generality
  const allVars = new Set<string>();
  for (const arg of atom1.args) {
    for (const v of variablesInTerm(arg)) allVars.add(v);
  }
  for (const arg of atom2.args) {
    for (const v of variablesInTerm(arg)) allVars.add(v);
  }

  if (!isEquivalentMGU(systemResult.mgu, studentSub, allVars)) {
    return {
      valid: false,
      errorKind: 'mgu_not_most_general',
      message: 'The substitution correctly unifies the atoms but is not the most general unifier.',
    };
  }

  return { valid: true };
}

// ============================================================
// VALIDATE STUDENT'S TWO SUBSTITUTIONS (per-clause)
// ============================================================
//
// Instead of one MGU applied to both clauses (which breaks when
// clauses share variable names), the student provides σ1 for clause 1
// and σ2 for clause 2. Validation:
//   1. atom1·σ1 = atom2·σ2 (atoms become identical after substitutions)
//   2. The pair (σ1, σ2) is most general (not more specific than needed)

export type TwoSubValidationResult =
  | { valid: true }
  | { valid: false; errorKind: 'incorrect_mgu' | 'mgu_not_most_general'; message: string };

export function validateStudentSubstitutions(
  atom1: Atom,
  atom2: Atom,
  studentSub1: Substitution,
  studentSub2: Substitution,
): TwoSubValidationResult {
  // 1. Apply σ1 to atom1 and σ2 to atom2, check equality
  const applied1 = applyToAtom(atom1, studentSub1);
  const applied2 = applyToAtom(atom2, studentSub2);

  if (!atomsEqual(applied1, applied2)) {
    return {
      valid: false,
      errorKind: 'incorrect_mgu',
      message: "Your substitutions don't make the atoms equal.",
    };
  }

  // 2. Check most-generality by comparing with the system's solution.
  //    Internally rename atom2's variables to avoid conflicts, compute the
  //    system MGU on the renamed pair, then split back into σ1_sys and σ2_sys.
  //    The student's pair is most general iff applied1/applied2 contain only
  //    variables (not ground terms) wherever the system solution would have variables.

  // Collect all variables from both atoms
  const vars1 = new Set<string>();
  for (const arg of atom1.args) {
    for (const v of variablesInTerm(arg)) vars1.add(v);
  }
  const vars2 = new Set<string>();
  for (const arg of atom2.args) {
    for (const v of variablesInTerm(arg)) vars2.add(v);
  }

  // Rename atom2's variables to fresh names to avoid overlap
  const allExisting = new Set([...vars1, ...vars2]);
  const renaming = new Map<string, string>();
  let counter = 1;
  for (const v of vars2) {
    let fresh = `_u${counter}`;
    while (allExisting.has(fresh)) {
      counter++;
      fresh = `_u${counter}`;
    }
    renaming.set(v, fresh);
    allExisting.add(fresh);
    counter++;
  }

  // Apply renaming to atom2
  const renamedAtom2 = renameAtom(atom2, renaming);

  // Compute system MGU on (atom1, renamedAtom2)
  const systemResult = unifyAtoms(atom1, renamedAtom2);
  if (!systemResult.success) {
    // If the system can't unify them, but student's subs did make them equal,
    // then the student's solution must be valid (it found a valid unification)
    // This shouldn't happen if atom1·σ1 = atom2·σ2, but just in case:
    return { valid: true };
  }

  // Split the system MGU into parts for vars1 and vars2 (renamed)
  // σ1_sys: bindings for vars in atom1
  // σ2_sys: bindings for renamed vars in atom2 (then un-rename)
  // For most-generality: student's applied result should match system's up to renaming

  // Apply system MGU to atom1 to get the "canonical" unified atom
  const systemUnified = applyToAtom(atom1, systemResult.mgu);

  // The student's unified atom (applied1 = applied2) should be equivalent to
  // systemUnified up to consistent variable renaming
  const mapping = new Map<string, string>();
  if (!atomMatchUpToRenaming(systemUnified, applied1, mapping)) {
    return {
      valid: false,
      errorKind: 'mgu_not_most_general',
      message: 'The substitutions make the atoms equal but are not the most general unifiers.',
    };
  }

  return { valid: true };
}

/**
 * Rename variables in an atom according to a mapping.
 */
function renameAtom(atom: Atom, renaming: Map<string, string>): Atom {
  return {
    predicate: atom.predicate,
    args: atom.args.map(arg => renameTerm(arg, renaming)),
  };
}

function renameTerm(term: Term, renaming: Map<string, string>): Term {
  switch (term.kind) {
    case 'variable': {
      const newName = renaming.get(term.name);
      return newName ? { kind: 'variable', name: newName } : term;
    }
    case 'constant':
      return term;
    case 'function':
      return {
        kind: 'function',
        name: term.name,
        args: term.args.map(a => renameTerm(a, renaming)),
      };
  }
}

/**
 * Check if two atoms match up to consistent variable renaming.
 */
function atomMatchUpToRenaming(
  a1: Atom,
  a2: Atom,
  mapping: Map<string, string>,
): boolean {
  if (a1.predicate !== a2.predicate) return false;
  if (a1.args.length !== a2.args.length) return false;
  for (let i = 0; i < a1.args.length; i++) {
    if (!termsMatchUpToRenaming(a1.args[i], a2.args[i], mapping)) return false;
  }
  return true;
}

/**
 * Check if two substitutions are equivalent (produce the same result up to consistent
 * variable renaming) on the given set of variables.
 */
function isEquivalentMGU(
  mgu: Substitution,
  student: Substitution,
  vars: ReadonlySet<string>,
): boolean {
  // Build a mapping from variables in mgu's results to variables in student's results
  const varMapping = new Map<string, string>();

  for (const varName of vars) {
    const mguTerm = applyToTerm({ kind: 'variable', name: varName }, mgu);
    const studentTerm = applyToTerm({ kind: 'variable', name: varName }, student);

    if (!termsMatchUpToRenaming(mguTerm, studentTerm, varMapping)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two terms are equal up to a consistent variable renaming.
 * The mapping tracks the bijection between variable names.
 */
function termsMatchUpToRenaming(
  t1: Term,
  t2: Term,
  mapping: Map<string, string>,
): boolean {
  if (t1.kind === 'variable' && t2.kind === 'variable') {
    const existing = mapping.get(t1.name);
    if (existing !== undefined) {
      return existing === t2.name;
    }
    // Check reverse: t2.name should not already be mapped to by a different t1 name
    for (const [k, v] of mapping) {
      if (v === t2.name && k !== t1.name) return false;
    }
    mapping.set(t1.name, t2.name);
    return true;
  }

  if (t1.kind === 'constant' && t2.kind === 'constant') {
    return t1.name === t2.name;
  }

  if (t1.kind === 'function' && t2.kind === 'function') {
    if (t1.name !== t2.name || t1.args.length !== t2.args.length) return false;
    for (let i = 0; i < t1.args.length; i++) {
      if (!termsMatchUpToRenaming(t1.args[i], t2.args[i], mapping)) return false;
    }
    return true;
  }

  return false;
}
