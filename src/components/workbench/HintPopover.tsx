import type { HintData, SolverStep } from '../../core/solver';
import { printClause } from '../../core/printer';

interface Props {
  hintData: HintData;
  level: number; // 1, 2, or 3
  onFillMgus?: (step: SolverStep) => void;
  onFillResolvent?: (resolvent: string) => void;
  isPredicate: boolean;
}

export default function HintPopover({
  hintData,
  level,
  onFillMgus,
  onFillResolvent,
  isPredicate,
}: Props) {
  const step = hintData.suggestedStep;

  return (
    <div className="w-full bg-[#fffbeb] border border-[#fbbf24] rounded-lg p-3 text-left">
      <div className="flex items-center gap-1.5 mb-2">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 1L1 13H13L7 1Z" stroke="#f59e0b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M7 5.5V8.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="7" cy="10.5" r="0.6" fill="#f59e0b" />
        </svg>
        <span className="font-lexend font-bold text-[10px] uppercase tracking-[0.5px] text-[#92400e]">
          Hint {level}/{hintData.maxLevel}
        </span>
      </div>

      {/* Level 1 */}
      <p className="text-sm text-[#78350f] leading-relaxed">
        {hintData.level1Message}
      </p>
      {hintData.level1Details && hintData.level1Details.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {hintData.level1Details.map((detail, i) => (
            <li key={i} className="text-xs text-[#92400e] font-mono pl-2 border-l-2 border-[#fbbf24]">
              {detail}
            </li>
          ))}
        </ul>
      )}

      {/* Level 2 */}
      {level >= 2 && (
        <div className="mt-3 pt-2.5 border-t border-[#fde68a]">
          <p className="text-sm text-[#78350f] leading-relaxed font-medium">
            {hintData.level2Message}
          </p>

          {/* Fill button for MGU hints */}
          {step && isPredicate && onFillMgus && (
            hintData.errorKind === 'incorrect_mgu' ||
            hintData.errorKind === 'unification_fails' ||
            hintData.errorKind === 'mgu_not_most_general' ||
            hintData.errorKind === 'no_matching_resolution'
          ) && (
            <button
              onClick={() => onFillMgus(step)}
              className="mt-2 text-xs font-lexend font-bold text-[#92400e] bg-[#fef3c7] hover:bg-[#fde68a] border border-[#fbbf24] rounded px-2 py-1 transition-colors"
            >
              Fill MGUs
            </button>
          )}

          {/* Suggest pair button */}
          {step && hintData.errorKind === 'no_complementary_literals' && (
            <p className="mt-1.5 text-xs text-[#92400e] font-mono">
              Clause {step.idx1} + Clause {step.idx2} → {printClause(step.resolvent)}
            </p>
          )}
        </div>
      )}

      {/* Level 3 (only incorrect_resolvent) */}
      {level >= 3 && hintData.maxLevel >= 3 && (
        <div className="mt-3 pt-2.5 border-t border-[#fde68a]">
          <p className="text-sm text-[#78350f] leading-relaxed font-medium">
            {hintData.level3Message}
          </p>

          {hintData.correctResolvent && onFillResolvent && (
            <button
              onClick={() => onFillResolvent(hintData.correctResolvent!)}
              className="mt-2 text-xs font-lexend font-bold text-[#92400e] bg-[#fef3c7] hover:bg-[#fde68a] border border-[#fbbf24] rounded px-2 py-1 transition-colors"
            >
              Fill Resolvent
            </button>
          )}
        </div>
      )}
    </div>
  );
}
