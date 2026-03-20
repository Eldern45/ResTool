import type { ExerciseStatus } from '../../context/appTypes';

const styles: Record<ExerciseStatus, { bg: string; dot: string; text: string; ring: string; label: string }> = {
  'solved': {
    bg: 'bg-[#dcfce7]',
    dot: 'bg-[#22c55e]',
    text: 'text-[#15803d]',
    ring: 'ring-[rgba(22,163,74,0.2)]',
    label: 'Solved',
  },
  'in-progress': {
    bg: 'bg-[#ffedd5]',
    dot: 'bg-[#f97316]',
    text: 'text-[#c2410c]',
    ring: 'ring-[rgba(234,88,12,0.2)]',
    label: 'In Progress',
  },
  'not-started': {
    bg: 'bg-[#f1f5f9]',
    dot: '',
    text: 'text-[#475569]',
    ring: 'ring-[rgba(100,116,139,0.1)]',
    label: 'Not Started',
  },
};

export default function StatusBadge({ status }: { status: ExerciseStatus }) {
  const s = styles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {s.dot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
      {s.label}
    </span>
  );
}
