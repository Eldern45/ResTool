import { useNavigate } from 'react-router-dom';
import type { Task } from '../../core/types';
import type { ExerciseStatus } from '../../context/appTypes';
import StatusBadge from './StatusBadge';

interface Props {
  tasks: Task[];
  progress: Record<string, ExerciseStatus>;
}

export default function ExerciseTable({ tasks, progress }: Props) {
  const navigate = useNavigate();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs">
              Exercise Name
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs">
              Type
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr
              key={task.id}
              onClick={() => navigate(`/workbench/${task.id}`)}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-medium text-gray-900">{task.title}</td>
              <td className="px-4 py-3 text-gray-600 capitalize">{task.logicType}</td>
              <td className="px-4 py-3">
                <StatusBadge status={progress[task.id] || 'not-started'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
