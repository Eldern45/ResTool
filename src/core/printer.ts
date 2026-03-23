import type { Term, Atom, Literal, Clause, Substitution } from './types';

export function printTerm(term: Term): string {
  switch (term.kind) {
    case 'variable':
      return term.name;
    case 'constant':
      return term.name;
    case 'function':
      return `${term.name}(${term.args.map(printTerm).join(', ')})`;
  }
}

export function printAtom(atom: Atom): string {
  if (atom.args.length === 0) {
    return atom.predicate;
  }
  return `${atom.predicate}(${atom.args.map(printTerm).join(', ')})`;
}

export function printLiteral(literal: Literal): string {
  const atomStr = printAtom(literal.atom);
  return literal.negated ? `¬${atomStr}` : atomStr;
}

export function printClause(clause: Clause): string {
  if (clause.literals.length === 0) {
    return '{}';
  }
  return `{${clause.literals.map(printLiteral).join(', ')}}`;
}

export function printSubstitution(sub: Substitution): string {
  if (sub.bindings.length === 0) {
    return '[]';
  }
  const parts = sub.bindings.map(b => `${b.variable.name}←${printTerm(b.term)}`);
  return `[${parts.join(', ')}]`;
}
