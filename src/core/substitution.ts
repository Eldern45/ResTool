import type { Term, Atom, Literal, Clause, Substitution, Variable } from './types';

// ============================================================
// STRUCTURAL EQUALITY
// ============================================================

export function termsEqual(t1: Term, t2: Term): boolean {
  if (t1.kind !== t2.kind) return false;
  switch (t1.kind) {
    case 'variable':
      return t1.name === (t2 as Variable).name;
    case 'constant':
      return t1.name === (t2 as { name: string }).name;
    case 'function': {
      const f2 = t2 as { kind: 'function'; name: string; args: readonly Term[] };
      if (t1.name !== f2.name || t1.args.length !== f2.args.length) return false;
      return t1.args.every((arg, i) => termsEqual(arg, f2.args[i]));
    }
  }
}

export function atomsEqual(a1: Atom, a2: Atom): boolean {
  if (a1.predicate !== a2.predicate) return false;
  if (a1.args.length !== a2.args.length) return false;
  return a1.args.every((arg, i) => termsEqual(arg, a2.args[i]));
}

export function literalsEqual(l1: Literal, l2: Literal): boolean {
  return l1.negated === l2.negated && atomsEqual(l1.atom, l2.atom);
}

export function clausesEqual(c1: Clause, c2: Clause): boolean {
  if (c1.literals.length !== c2.literals.length) return false;
  // Set equality: every literal in c1 has a match in c2 and vice versa
  return (
    c1.literals.every(l1 => c2.literals.some(l2 => literalsEqual(l1, l2))) &&
    c2.literals.every(l2 => c1.literals.some(l1 => literalsEqual(l1, l2)))
  );
}

// ============================================================
// VARIABLE COLLECTION
// ============================================================

export function variablesInTerm(term: Term): Set<string> {
  const vars = new Set<string>();
  collectVarsInTerm(term, vars);
  return vars;
}

function collectVarsInTerm(term: Term, vars: Set<string>): void {
  switch (term.kind) {
    case 'variable':
      vars.add(term.name);
      break;
    case 'constant':
      break;
    case 'function':
      for (const arg of term.args) collectVarsInTerm(arg, vars);
      break;
  }
}

export function variablesInLiteral(literal: Literal): Set<string> {
  const vars = new Set<string>();
  for (const arg of literal.atom.args) collectVarsInTerm(arg, vars);
  return vars;
}

export function variablesInClause(clause: Clause): Set<string> {
  const vars = new Set<string>();
  for (const lit of clause.literals) {
    for (const arg of lit.atom.args) collectVarsInTerm(arg, vars);
  }
  return vars;
}

// ============================================================
// APPLY SUBSTITUTION
// ============================================================

export function applyToTerm(term: Term, sub: Substitution): Term {
  switch (term.kind) {
    case 'variable': {
      const binding = sub.bindings.find(b => b.variable.name === term.name);
      return binding ? binding.term : term;
    }
    case 'constant':
      return term;
    case 'function':
      return {
        kind: 'function',
        name: term.name,
        args: term.args.map(arg => applyToTerm(arg, sub)),
      };
  }
}

export function applyToAtom(atom: Atom, sub: Substitution): Atom {
  if (atom.args.length === 0) return atom;
  return {
    predicate: atom.predicate,
    args: atom.args.map(arg => applyToTerm(arg, sub)),
  };
}

export function applyToLiteral(literal: Literal, sub: Substitution): Literal {
  return {
    atom: applyToAtom(literal.atom, sub),
    negated: literal.negated,
  };
}

export function applyToClause(clause: Clause, sub: Substitution): Clause {
  return {
    literals: clause.literals.map(lit => applyToLiteral(lit, sub)),
  };
}

// ============================================================
// SUBSTITUTION COMPOSITION
// ============================================================

export function compose(s1: Substitution, s2: Substitution): Substitution {
  // Apply s2 to all terms in s1, then add s2 bindings for vars not in s1's domain
  const s1Domain = new Set(s1.bindings.map(b => b.variable.name));

  const newBindings = s1.bindings.map(b => ({
    variable: b.variable,
    term: applyToTerm(b.term, s2),
  }));

  for (const b of s2.bindings) {
    if (!s1Domain.has(b.variable.name)) {
      newBindings.push(b);
    }
  }

  // Remove identity bindings (x -> x)
  const filtered = newBindings.filter(b =>
    !(b.term.kind === 'variable' && b.term.name === b.variable.name)
  );

  return { bindings: filtered };
}

// ============================================================
// VARIABLE RENAMING
// ============================================================

export function renameVariables(
  clause: Clause,
  existingNames: ReadonlySet<string>,
  counter: { value: number },
): { renamed: Clause; renaming: Substitution } {
  const vars = variablesInClause(clause);
  if (vars.size === 0) {
    return { renamed: clause, renaming: { bindings: [] } };
  }

  const bindings: { variable: Variable; term: Term }[] = [];

  for (const varName of vars) {
    let newName: string;
    do {
      newName = `${varName}_${counter.value}`;
      counter.value++;
    } while (existingNames.has(newName));

    bindings.push({
      variable: { kind: 'variable', name: varName },
      term: { kind: 'variable', name: newName },
    });
  }

  const renaming: Substitution = { bindings };
  const renamed = applyToClause(clause, renaming);
  return { renamed, renaming };
}

// ============================================================
// REMOVE DUPLICATE LITERALS
// ============================================================

export function removeDuplicateLiterals(clause: Clause): Clause {
  const unique: Literal[] = [];
  for (const lit of clause.literals) {
    if (!unique.some(u => literalsEqual(u, lit))) {
      unique.push(lit);
    }
  }
  return { literals: unique };
}
