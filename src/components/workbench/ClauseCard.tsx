import type { Clause, ResolutionStep, Substitution } from '../../core/types';
import { printClause, printTerm } from '../../core/printer';

interface Props {
  index: number;
  clause: Clause;
  isInitial: boolean;
  isSelected: boolean;
  onClick: () => void;
  step?: ResolutionStep;
}

function formatSub(sub: Substitution): string {
  if (sub.bindings.length === 0) return '';
  const parts = sub.bindings.map(b => `[${b.variable.name} ← ${printTerm(b.term)}]`);
  return `${parts.join(' ')}`;
}

function formatOrigin(step: ResolutionStep): string {
  const sub1 = formatSub(step.mgu1);
  const sub2 = formatSub(step.mgu2);
  const part1 = sub1 ? `${step.clause1Index} ${sub1}` : String(step.clause1Index);
  const part2 = sub2 ? `${step.clause2Index} ${sub2}` : String(step.clause2Index);
  return `${part1} ${part2}`;
}

export default function ClauseCard({ index, clause, isInitial, isSelected, onClick, step }: Props) {
  return (
    <div
      onClick={onClick}
      className={`flex flex-col gap-1 p-3.5 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'border-2 border-[#137fec] bg-[rgba(19,127,236,0.05)]'
          : 'border border-[#e5e7eb] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] hover:border-[#d1d5db]'
      }`}
    >
      {/* Top row: clause label + preq tag */}
      <div className="flex items-center justify-between">
        <span className={`font-lexend font-bold text-[10px] uppercase tracking-[0.5px] ${
          isSelected ? 'text-[#137fec]' : 'text-[#6b7280]'
        }`}>
          Clause #{index}
        </span>
        {isInitial && (
          <span className={`text-[10px] px-1 rounded ${
            isSelected
              ? 'bg-[rgba(19,127,236,0.1)] text-[rgba(19,127,236,0.7)]'
              : 'bg-[#f3f4f6] text-[#9ca3af]'
          }`}>
            preq
          </span>
        )}
      </div>

      {/* Clause text + origin annotation */}
      <div className="flex items-center justify-between overflow-hidden">
        <span className="font-inter font-bold text-base text-[#111418] whitespace-nowrap">
          {printClause(clause)}
        </span>
        {!isInitial && step && (
          <span className="text-xs text-[#d1d5db] whitespace-nowrap ml-2">
            {formatOrigin(step)}
          </span>
        )}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 6L5 8.5L9.5 4" stroke="rgba(19,127,236,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="font-lexend font-bold text-[9px] uppercase tracking-[0.9px] text-[rgba(19,127,236,0.7)]">
            Selected
          </span>
        </div>
      )}
    </div>
  );
}
