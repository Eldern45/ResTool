import type { ReactNode } from 'react';

/**
 * GuidePage — onboarding/help page explaining the goal of the tool,
 * how to use it, and the underlying theory of the resolution method.
 */
export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 font-lexend">Guide</h1>
        <p className="text-sm text-gray-500 mt-1">
          What this tool is for, how to use it, and a refresher on the resolution method.
        </p>
      </header>

      {/* ─── 1. Goal ─────────────────────────────────────── */}
      <Section title="Goal" anchor="goal">
        <p>
          <strong>ResTool</strong> is an educational tool for practicing the
          {' '}<em>resolution method</em> in propositional and first-order
          (predicate) logic. It is designed for students who have just learned
          the rule on paper and want to drill it interactively, with
          step-by-step feedback and progressive hints.
        </p>
        <p>
          Each exercise gives you a set of clauses (a knowledge base) and asks
          you to derive the <strong>empty clause</strong> by repeatedly resolving pairs of clauses. When you reach the empty
          clause, the original goal is proven by refutation.
        </p>
      </Section>

      {/* ─── 2. How to use ───────────────────────────────── */}
      <Section title="How to use the tool" anchor="how-to-use">
        <ol className="list-decimal list-outside pl-6 space-y-3 marker:text-gray-400">
          <li>
            <strong>Pick an exercise.</strong> On the{' '}
            <Anchor to="/">Exercises</Anchor> page, choose one of the
            built-in tasks. You can also import your own task as JSON via{' '}
            <em>Load Exercise</em>.
          </li>
          <li>
            <strong>Select two clauses.</strong> In the workbench, click two
            clauses in the left panel - these are the parents of your next
            resolution step.
          </li>
          <li>
            <strong>Provide the MGUs (predicate logic only).</strong> Enter a
            substitution σ₁ for parent 1 and σ₂ for parent 2 in the form{' '}
            <Code>x←a</Code>. Use the <Code>+</Code> button or a comma <Code>,</Code> to add
            more bindings. For propositional tasks, leave the MGU fields empty.
          </li>
          <li>
            <strong>Type the resolvent.</strong> Write the clause you expect to
            derive - the literals that survive after removing the resolved pair
            and applying σ₁ and σ₂.
          </li>
          <li>
            <strong>Verify.</strong> Click <em>Verify &amp; Add Step</em>. If
            the step is correct, the resolvent is added to the knowledge base.
            If not, you get an error message, and after a wrong
            answer, a <Code>?</Code> button appears with progressive hints.
          </li>
          <li>
            <strong>Repeat until the empty clause.</strong> Use
            <Code>∅ Empty</Code> when your next resolvent is the empty clause -
            that finishes the proof. <em>Undo</em>, <em>Redo</em>, and
            <em>Reset</em> are available in the header.
          </li>
        </ol>

        <Callout>
          <strong>Syntax cheat-sheet.</strong> To input negation sign <Code>¬</Code> use <Code>~</Code> or
          <Code>-</Code>. To input <Code>←</Code> use <Code>/</Code> or <Code>&lt;</Code>. Predicates start with an uppercase letter
          (<Code>P</Code>, <Code>Likes</Code>); variables are lowercase
          (<Code>x</Code>, <Code>y</Code>); constants are the lowercase names
          declared in the task (default: <Code>a, b, c, d, e</Code>);
          functions are lowercase names with arguments (<Code>f(x)</Code>).
        </Callout>
      </Section>

      {/* ─── 3. Theory ───────────────────────────────────── */}
      <Section title="A bit of theory" anchor="theory">
        <Subsection title="Clauses, literals, terms">
          <ul className="list-disc list-outside pl-6 space-y-2 marker:text-gray-400">
            <li>
              A <strong>term</strong> denotes an object: a variable
              (<Code>x</Code>), a constant (<Code>a</Code>), or a function
              applied to terms (<Code>f(x, a)</Code>).
            </li>
            <li>
              An <strong>atom</strong> is a predicate applied to terms
              (<Code>P(x)</Code>); in propositional logic, atoms have no
              arguments (<Code>P</Code>).
            </li>
            <li>
              A <strong>literal</strong> is an atom or its negation
              (<Code>P(x)</Code>, <Code>¬P(x)</Code>).
            </li>
            <li>
              A <strong>clause</strong> is a disjunction of literals, written
              as a set: <Code>{'{P(x), ¬Q(a)}'}</Code>.
            </li>
          </ul>
        </Subsection>

        <Subsection title="The resolution rule">
          <p>
            Given two clauses with complementary literals, resolution removes
            the matching pair and merges the remaining literals:
          </p>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-sm overflow-x-auto">
{`C₁ ∨ L      C₂ ∨ ¬L
─────────────────────
       C₁ ∨ C₂`}
          </pre>
          <p>
            In <strong>propositional</strong> logic, the literals must match
            exactly. In <strong>first-order</strong> logic, they only need to
            match <em>after</em> applying a substitution - that is what the
            MGU is for.
          </p>
        </Subsection>

        <Subsection title="Most general unifier (MGU)">
          <p>
            A <strong>substitution</strong> replaces variables with terms, for
            example <Code>[x←a, y←f(z)]</Code>. A <strong>unifier</strong> of
            two atoms is a substitution that, when applied, makes them
            syntactically equal. The <strong>most general unifier</strong> is
            the one that imposes the fewest constraints - every other unifier
            is an instance of it.
          </p>
        </Subsection>

        <Subsection title="Proof by refutation">
          <p>
            Resolution is a <strong>refutation</strong> procedure: to prove a
            goal G from a knowledge base KB, one shows that{' '}
            <Code>KB ∪ {'{¬G}'}</Code> is unsatisfiable. The exercises in this
            tool already include the negated goal - your job is to derive the
            empty clause, which witnesses the contradiction.
          </p>
        </Subsection>
      </Section>

      <p className="text-center text-sm text-gray-400 mt-12">
        Ready to practice? Head over to the{' '}
        <Anchor to="/">Exercises</Anchor> page and pick a task.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * Small presentational helpers - kept in-file because they
 * are only used here.
 * ───────────────────────────────────────────────────────── */

function Section({
  title,
  anchor,
  children,
}: {
  title: string;
  anchor: string;
  children: ReactNode;
}) {
  return (
    <section id={anchor} className="mb-10 bg-white border border-gray-200 rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6">
      <h2 className="text-xl font-bold text-gray-900 font-lexend mb-4">
        {title}
      </h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="text-base font-bold text-gray-900 font-lexend mb-2">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[0.85em] bg-gray-100 text-[#137fec] px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 bg-[rgba(19,127,236,0.06)] border border-[rgba(19,127,236,0.2)] rounded-lg px-4 py-3 text-sm text-gray-700">
      {children}
    </div>
  );
}

function Anchor({ to, children }: { to: string; children: ReactNode }) {
  // Plain anchor - react-router's <Link> would force this file to depend on
  // the router; for the few in-page references that's overkill.
  return (
    <a href={to} className="text-[#137fec] hover:underline">
      {children}
    </a>
  );
}
