import type { Clause } from '../../core/types';
import { printClause } from '../../core/printer';

interface Props {
  label: string;
  clause: Clause | null;
  index: number | null;
  isInitial: boolean;
  variant: 'primary' | 'secondary';
}

export default function ParentSlot({ label, clause, index, isInitial, variant }: Props) {
  const isPrimary = variant === 'primary';

  return (
    <div className={`relative bg-[#f6f7f8] border-2 border-dashed rounded-xl p-4 w-[200px] min-h-[100px] flex flex-col items-center justify-center ${
      isPrimary ? 'border-[rgba(19,127,236,0.4)]' : 'border-[#d1d5db]'
    }`}>
      {/* Corner index */}
      {index !== null && (
        <span className="absolute top-2 left-2.5 text-[10px] text-[#9ca3af]">
          #{index}
        </span>
      )}

      {/* Label */}
      <span className={`font-lexend font-bold text-[9px] uppercase tracking-[0.9px] text-center mb-2 ${
        isPrimary ? 'text-[#137fec]' : 'text-[#9ca3af]'
      }`}>
        {label}
      </span>

      {clause ? (
        <>
          {/* Clause text */}
          <span className="font-inter font-bold text-base text-[#111418] text-center mb-1">
            {printClause(clause)}
          </span>
          {/* Origin badge */}
          {isInitial && (
            <span className="bg-[#dbeafe] rounded px-1 font-lexend text-[9px] text-[#2563eb] text-center">
              preq
            </span>
          )}
        </>
      ) : (
        <span className="text-xs text-[#9ca3af] text-center italic">
          Click a clause on the left
        </span>
      )}
    </div>
  );
}
