import { useRef, useEffect, useState } from 'react';
import SmartInput, { type SmartInputHandle } from './SmartInput';

interface Props {
  label: string;
  bindings: string[];
  onChange: (bindings: string[]) => void;
}

/** Char button: appears 7px to the right of the bracket, floats over the input. */
function CharBtn({ label, onInsert }: { label: string; onInsert: () => void }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onInsert(); }}
      title={`Insert "${label}"`}
      className="h-5 min-w-[1.25rem] px-1 rounded text-[11px] font-mono bg-gray-100 hover:bg-[rgba(19,127,236,0.1)] text-gray-500 hover:text-[#137fec] border border-gray-200 hover:border-[rgba(19,127,236,0.3)] transition-colors leading-none flex items-center justify-center select-none"
    >
      {label}
    </button>
  );
}

export default function MguInput({ label, bindings, onChange }: Props) {
  const focusNewRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(SmartInputHandle | null)[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const rowTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enterRow = (i: number) => {
    if (rowTimeout.current) clearTimeout(rowTimeout.current);
    setHoveredRow(i);
  };
  const leaveRow = () => {
    rowTimeout.current = setTimeout(() => setHoveredRow(null), 80);
  };

  // Focus the last input when a new binding is added
  useEffect(() => {
    if (focusNewRef.current && containerRef.current) {
      const inputs = containerRef.current.querySelectorAll('input');
      const lastInput = inputs[inputs.length - 1];
      lastInput?.focus();
      focusNewRef.current = false;
    }
  });

  const updateBinding = (index: number, value: string) => {
    const next = [...bindings];
    next[index] = value;
    onChange(next);
  };

  const addBinding = () => {
    focusNewRef.current = true;
    onChange([...bindings, '']);
  };

  const removeBinding = (index: number) => {
    if (bindings.length <= 1) {
      onChange(['']);
      return;
    }
    const next = bindings.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div ref={containerRef} className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] px-5 py-3 flex flex-col items-center gap-2 w-full">
      <span className="font-lexend font-bold text-[9px] uppercase tracking-[0.9px] text-[#9ca3af]">
        {label}
      </span>

      <div className="flex flex-col gap-1.5 w-full items-center">
        {bindings.map((binding, i) => (
          /*
           * Buttons are absolute with right: calc(100% + 4px) — 4px left of `[`.
           * JS timeout (80ms) bridges the mouse-travel gap between row and buttons.
           */
          <div
            key={i}
            className="relative flex items-center gap-1.5"
            onMouseEnter={() => enterRow(i)}
            onMouseLeave={leaveRow}
          >
            {/* Char buttons — 4px to the left of `[`, zero layout footprint */}
            <div
              style={{ position: 'absolute', right: 'calc(100% + 4px)', top: '50%', transform: 'translateY(-50%)' }}
              className={`flex gap-0.5 z-10 transition-opacity duration-150 ${hoveredRow === i ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
              onMouseEnter={() => enterRow(i)}
              onMouseLeave={leaveRow}
            >
              <CharBtn label="←" onInsert={() => inputRefs.current[i]?.insertChar('←')} />
            </div>

            <span className="text-base text-[#9ca3af] select-none">[</span>
            <SmartInput
              ref={el => { inputRefs.current[i] = el; }}
              value={binding}
              onChange={val => updateBinding(i, val)}
              onCommaSplit={addBinding}
              convertSlash
              placeholder="x←a"
              className="w-24 border-b border-[#d1d5db] bg-transparent text-center text-base font-inter pb-1 pt-0.5 focus:outline-none focus:border-[#137fec] placeholder:text-[#d1d5db]"
            />
            <span className="text-base text-[#9ca3af] select-none">]</span>
            {bindings.length > 1 && (
              <button
                onClick={() => removeBinding(i)}
                className="text-[#d1d5db] hover:text-[#9ca3af] transition-colors ml-0.5"
                title="Remove binding"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4L10 10M4 10L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add binding button */}
      <button
        onClick={addBinding}
        className="text-[#9ca3af] hover:text-[#6b7280] transition-colors"
        title="Add binding (or press , in input)"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10 7V13M7 10H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
