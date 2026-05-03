import { useState, useCallback, useRef } from 'react';
import type { Clause, SessionState, AnswerValidationResult, Substitution } from '../../core/types';
import { EMPTY_SUBSTITUTION } from '../../core/types';
import { parseSubstitution, parseClause } from '../../core/parser';
import { diagnoseStep, type HintData, type SolverStep } from '../../core/solver';
import { printSubstitution, printClause, printTerm } from '../../core/printer';
import { usePersistedState } from '../../hooks/usePersistedState';
import ParentSlot from './ParentSlot';
import MguInput from './MguInput';
import SmartInput, { type SmartInputHandle } from './SmartInput';
import HintPopover from './HintPopover';

function formatDerivation(state: SessionState, isPredicate: boolean): string {
  const lines: string[] = [];
  lines.push('Resolution Derivation');
  lines.push('='.repeat(40));
  lines.push('');

  // Initial clauses
  lines.push('Initial clauses:');
  for (let i = 0; i < state.initialClauseCount; i++) {
    lines.push(`  ${i + 1}. ${printClause(state.clauses[i])}`);
  }
  lines.push('');

  // Derived steps
  if (state.steps.length > 0) {
    lines.push('Derivation:');
    for (const step of state.steps) {
      const resolventStr = printClause(step.resolvent);
      let origin = `${step.clause1Index}, ${step.clause2Index}`;
      if (isPredicate) {
        const fmt = (sub: Substitution): string => {
          if (sub.bindings.length === 0) return '';
          const parts = sub.bindings.map(b => `[${b.variable.name} ← ${printTerm(b.term)}]`);
          return ` ${parts.join(' ')}`;
        };
        origin = `${step.clause1Index}${fmt(step.mgu1)}, ${step.clause2Index}${fmt(step.mgu2)}`;
      }
      lines.push(`  ${step.resolventIndex}. ${resolventStr}  (${origin})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function downloadDerivation(state: SessionState, isPredicate: boolean, taskId: string) {
  const text = formatDerivation(state, isPredicate);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `derivation-${taskId}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  state: SessionState;
  selected: [number | null, number | null];
  isPredicate: boolean;
  constants: ReadonlySet<string>;
  taskId: string;
  onResolve: (idx1: number, idx2: number, sub1: string, sub2: string, resolvent: string) =>
    (AnswerValidationResult | { valid: false; errorKind: string; message: string });
  onComplete: () => void;
}

/** Join binding strings into parser format: {b1, b2, ...} */
function bindingsToString(bindings: string[]): string {
  const filled = bindings.map(b => b.trim()).filter(Boolean);
  if (filled.length === 0) return '{}';
  return `{${filled.join(', ')}}`;
}

export default function WorkbenchPanel({ state, selected, isPredicate, constants, taskId, onResolve, onComplete }: Props) {
  const [mgu1Bindings, setMgu1Bindings] = usePersistedState<string[]>(`restool-mgu1-${taskId}`, ['']);
  const [mgu2Bindings, setMgu2Bindings] = usePersistedState<string[]>(`restool-mgu2-${taskId}`, ['']);
  const [resolventInner, setResolventInner] = usePersistedState<string>(`restool-resolvent-${taskId}`, '');
  const [error, setError] = useState<string | null>(null);
  const resolventInputRef = useRef<SmartInputHandle>(null);
  const [showNegBtn, setShowNegBtn] = useState(false);
  const negBtnTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterNeg = () => { if (negBtnTimeout.current) clearTimeout(negBtnTimeout.current); setShowNegBtn(true); };
  const leaveNeg = () => { negBtnTimeout.current = setTimeout(() => setShowNegBtn(false), 80); };

  // Hint state
  const [hintData, setHintData] = useState<HintData | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [lastErrorKind, setLastErrorKind] = useState<string | null>(null);

  const clearHints = useCallback(() => {
    setHintData(null);
    setHintLevel(0);
    setLastErrorKind(null);
  }, []);

  const clause1: Clause | null = selected[0] ? (state.clauses[selected[0] - 1] ?? null) : null;
  const clause2: Clause | null = selected[1] ? (state.clauses[selected[1] - 1] ?? null) : null;
  const isInitial1 = selected[0] ? (selected[0] - 1) < state.initialClauseCount : false;
  const isInitial2 = selected[1] ? (selected[1] - 1) < state.initialClauseCount : false;
  const canSubmit = selected[0] !== null && selected[1] !== null;

  const handleSubmitWith = (inner: string) => {
    if (!selected[0] || !selected[1]) return;
    setError(null);
    clearHints();

    // Wrap resolvent inner content in braces for the parser
    const resolventStr = `{${inner.trim()}}`;

    const result = onResolve(
      selected[0],
      selected[1],
      bindingsToString(mgu1Bindings),
      bindingsToString(mgu2Bindings),
      resolventStr,
    );

    if (result.valid) {
      setMgu1Bindings(['']);
      setMgu2Bindings(['']);
      setResolventInner('');
      setError(null);
      if (state.isComplete || (result as { resolvent: Clause }).resolvent.literals.length === 0) {
        onComplete();
      }
    } else {
      const errResult = result as { message: string; errorKind: string };
      setError(errResult.message);

      // Compute hint data for non-parse errors
      if (errResult.errorKind !== 'parse_error') {
        setLastErrorKind(errResult.errorKind);
        try {
          const mgu1Str = bindingsToString(mgu1Bindings);
          const mgu2Str = bindingsToString(mgu2Bindings);
          const parsedSub1: Substitution = isPredicate
            ? parseSubstitution(mgu1Str, constants)
            : EMPTY_SUBSTITUTION;
          const parsedSub2: Substitution = isPredicate
            ? parseSubstitution(mgu2Str, constants)
            : EMPTY_SUBSTITUTION;
          const parsedResolvent: Clause = parseClause(resolventStr, constants);

          const diagnosis = diagnoseStep(
            state.clauses,
            selected[0],
            selected[1],
            parsedSub1,
            parsedSub2,
            parsedResolvent,
            errResult.errorKind,
          );
          setHintData(diagnosis);
        } catch {
          // If parsing fails for diagnosis, still show error but no hints
        }
      }
    }
  };

  const handleSubmit = () => handleSubmitWith(resolventInner);

  const handleHintClick = () => {
    if (!hintData) return;
    setHintLevel(prev => Math.min(prev + 1, hintData.maxLevel));
  };

  const handleFillMgus = useCallback((step: SolverStep) => {
    // Convert solver step MGUs into binding strings
    const toBindings = (sub: Substitution): string[] => {
      if (sub.bindings.length === 0) return [''];
      return sub.bindings.map(b => {
        const subStr = printSubstitution({ bindings: [b] });
        // printSubstitution returns {x/a}, strip braces
        return subStr.slice(1, -1);
      });
    };
    setMgu1Bindings(toBindings(step.mgu1));
    setMgu2Bindings(toBindings(step.mgu2));
  }, [setMgu1Bindings, setMgu2Bindings]);

  const handleFillResolvent = useCallback((resolventStr: string) => {
    // resolventStr is like "{~Q(a), P(x)}", strip outer braces
    const inner = resolventStr.startsWith('{') && resolventStr.endsWith('}')
      ? resolventStr.slice(1, -1)
      : resolventStr;
    setResolventInner(inner);
  }, [setResolventInner]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Title row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-lexend font-bold text-2xl text-[#111418] leading-8">Working Area</h1>
          <p className="font-lexend text-sm text-[#6b7280]">Select two clauses on the left, then enter the resolvent below.</p>
        </div>
        {/* Hint icon placeholder — hints appear inline after errors */}
        <div className="w-9" />
      </div>

      {/* Success banner */}
      {state.isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-green-800 font-lexend font-bold text-lg">Proof Complete!</p>
          <p className="text-green-600 text-sm mt-1">You have derived the empty clause.</p>
          <button
            onClick={() => downloadDerivation(state, isPredicate, taskId)}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-green-300 bg-white text-green-700 text-sm font-lexend font-bold hover:bg-green-50 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2V10M5 7.5L8 10.5L11 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Download Derivation
          </button>
        </div>
      )}

      {/* Main resolution flow card */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white border border-[#e5e7eb] rounded-xl shadow-[0px_4px_20px_-4px_rgba(0,0,0,0.1)] relative p-8">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(19,127,236,0.5) 0%, transparent 70%)',
          }}
        />

        <div className="flex flex-col items-center gap-0 w-full max-w-[700px] mx-auto">
          {/* Parent clause slots + MGU grid (predicate) */}
          {isPredicate ? (
            <>
              {/* 3-column grid: Parent1 | plus | Parent2, aligned with MGUs below */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-start justify-items-center gap-x-4">
                {/* Row 1: Parent slots */}
                <ParentSlot
                  label="Parent 1"
                  clause={clause1}
                  index={selected[0]}
                  isInitial={isInitial1}
                  variant="primary"
                />
                <div className="self-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M5 12H19" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <ParentSlot
                  label="Parent 2"
                  clause={clause2}
                  index={selected[1]}
                  isInitial={isInitial2}
                  variant="secondary"
                />

                {/* Row 2: Vertical connectors */}
                <div className="w-px h-6 bg-[#e5e7eb]" />
                <div />
                <div className="w-px h-6 bg-[#e5e7eb]" />

                {/* Row 3: MGU cards */}
                <MguInput
                  label="MGU 1"
                  bindings={mgu1Bindings}
                  onChange={setMgu1Bindings}
                />
                <div />
                <MguInput
                  label="MGU 2"
                  bindings={mgu2Bindings}
                  onChange={setMgu2Bindings}
                />
              </div>

              {/* Arrow down to resolvent */}
              <div className="flex flex-col items-center py-2">
                <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 0V18M5 14L10 19L15 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </>
          ) : (
            <>
              {/* Propositional: just parents + centered arrow */}
              <div className="flex items-center justify-center gap-4">
                <ParentSlot
                  label="Parent 1"
                  clause={clause1}
                  index={selected[0]}
                  isInitial={isInitial1}
                  variant="primary"
                />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19M5 12H19" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <ParentSlot
                  label="Parent 2"
                  clause={clause2}
                  index={selected[1]}
                  isInitial={isInitial2}
                  variant="secondary"
                />
              </div>

              {/* Single centered arrow */}
              <div className="flex flex-col items-center py-2">
                <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 0V18M5 14L10 19L15 14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </>
          )}

          {/* Derived Resolvent card */}
          <div
            onMouseEnter={enterNeg}
            onMouseLeave={leaveNeg}
            className="bg-white border border-[#e5e7eb] rounded-xl shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] py-5 px-[30.5px] w-[325px] flex flex-col items-center"
          >
            {/* Label */}
            <span className="font-lexend font-bold text-[10px] uppercase tracking-[1px] text-[#6b7280] mb-3">
              Derived Resolvent
            </span>

            {/* Input with decorative braces + help icon */}
            <div className="flex items-center gap-2 w-full mb-4">
              {/*
               * ¬ button is absolute, right: calc(100% + 4px) — 4px to the left of `{`.
               * Visibility is driven by hover on the whole Derived Resolvent card.
               */}
              <div className="relative flex-1 flex items-center">
                <span className="text-lg text-[#9ca3af] select-none mr-1">{'{'}</span>
                {/* ¬ button — 4px to the left of `{`, zero layout footprint */}
                <button
                  onMouseDown={e => { e.preventDefault(); resolventInputRef.current?.insertChar('¬'); }}
                  title='Insert "¬"'
                  style={{ position: 'absolute', right: 'calc(100% + 4px)', top: '50%', transform: 'translateY(-50%)' }}
                  className={`h-5 min-w-[1.25rem] px-1 rounded text-[11px] font-mono bg-gray-100 hover:bg-[rgba(19,127,236,0.1)] text-gray-500 hover:text-[#137fec] border border-gray-200 hover:border-[rgba(19,127,236,0.3)] transition-colors leading-none flex items-center justify-center select-none z-10 ${showNegBtn ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                >
                  ¬
                </button>
                <div className="flex-1">
                  <SmartInput
                    ref={resolventInputRef}
                    value={resolventInner}
                    onChange={val => { setResolventInner(val); setError(null); clearHints(); }}
                    placeholder={isPredicate ? '¬X(c), Y(c)' : '¬X, Y'}
                    className={`w-full py-2 text-center font-inter font-bold text-base focus:outline-none transition-colors bg-transparent text-[#111418] placeholder:text-[#d1d5db] placeholder:font-normal`}
                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                  />
                </div>
                <span className="text-lg text-[#9ca3af] select-none ml-1">{'}'}</span>
              </div>
              {/* Hint button — only visible after a non-parse error */}
              {hintData && lastErrorKind && (
                <button
                  onClick={handleHintClick}
                  className={`shrink-0 relative transition-colors ${
                    hintLevel > 0
                      ? 'text-[#f59e0b] hover:text-[#d97706]'
                      : 'text-[#f59e0b] hover:text-[#d97706] animate-pulse'
                  }`}
                  title={hintLevel === 0 ? 'Get a hint' : `Hint ${hintLevel}/${hintData.maxLevel} — click for more`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 9.5C10 9.5 10.5 8 12 8C13.5 8 14 9 14 9.75C14 10.5 13.5 11 12 11.5V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="12" cy="15.5" r="0.75" fill="currentColor"/>
                  </svg>
                  {hintLevel > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#f59e0b] text-white text-[8px] font-bold flex items-center justify-center">
                      {hintLevel}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Error + hint area */}
            {error && (
              <div className="w-full mb-3 -mt-3 border-t-2 border-red-500 pt-2">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* Hint popover (shown when user clicks ?) */}
            {hintData && hintLevel > 0 && (
              <div className="w-full mb-3">
                <HintPopover
                  hintData={hintData}
                  level={hintLevel}
                  isPredicate={isPredicate}
                  onFillMgus={handleFillMgus}
                  onFillResolvent={handleFillResolvent}
                />
              </div>
            )}

            {/* Verify button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || state.isComplete}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#137fec] text-white shadow-[0px_10px_15px_-3px_rgba(19,127,236,0.1),0px_4px_6px_-4px_rgba(19,127,236,0.1)] hover:bg-[#1171d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 9L7.5 12.5L14 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-lexend font-bold text-sm">Verify & Add Step</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
