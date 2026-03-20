import type { SessionState, ResolutionStep } from '../../core/types';
import ClauseCard from './ClauseCard';

interface Props {
  state: SessionState;
  selected: [number | null, number | null];
  onSelect: (index: number) => void;
}

export default function KnowledgeBase({ state, selected, onSelect }: Props) {
  const findStep = (clauseIdx: number): ResolutionStep | undefined => {
    return state.steps.find(s => s.resolventIndex === clauseIdx);
  };

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-[#f9fafb] border-b border-[#e5e7eb] px-3 py-3 flex items-center justify-between">
        <h2 className="font-lexend font-bold text-base text-[#111418]">Knowledge Base</h2>
      </div>

      {/* Clause list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {state.clauses.map((clause, i) => {
          const idx = i + 1;
          const isSelected = selected[0] === idx || selected[1] === idx;
          return (
            <ClauseCard
              key={idx}
              index={idx}
              clause={clause}
              isInitial={i < state.initialClauseCount}
              isSelected={isSelected}
              onClick={() => onSelect(idx)}
              step={findStep(idx)}
            />
          );
        })}
      </div>
    </div>
  );
}
