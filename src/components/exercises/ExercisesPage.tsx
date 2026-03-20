import { useState, useCallback } from 'react';
import { useApp } from '../../hooks/useApp';
import ExerciseTable from './ExerciseTable';
import LoadExerciseModal from './LoadExerciseModal';
import type { Task } from '../../core/types';

export default function ExercisesPage() {
  const { tasks, progress, addTask } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  const handleImport = useCallback((data: unknown): string | null => {
    if (!data || typeof data !== 'object') return 'Invalid JSON structure.';
    const obj = data as Record<string, unknown>;

    // Support both single task and task file formats
    if (obj.tasks && Array.isArray(obj.tasks)) {
      // Task file format
      for (const t of obj.tasks) {
        const err = validateTask(t);
        if (err) return err;
      }
      for (const t of obj.tasks) {
        addTask(t as Task);
      }
      return null;
    }

    // Single task format
    const err = validateTask(data);
    if (err) return err;
    const taskToImport = data as Task;
    addTask(taskToImport);
    return null;
  }, [addTask]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-lexend">Exercises</h1>
          <p className="text-sm text-gray-500 mt-1">Select an exercise to start a resolution proof</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
        >
          Load Exercise
        </button>
      </div>
      <ExerciseTable tasks={tasks} progress={progress} />
      <LoadExerciseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
}

function validateTask(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'Task must be an object.';
  const t = data as Record<string, unknown>;
  if (!t.id || !t.title || !t.logicType || !t.clauses) {
    return 'Task is missing required fields (id, title, logicType, clauses).';
  }
  if (t.logicType !== 'propositional' && t.logicType !== 'predicate') {
    return 'logicType must be "propositional" or "predicate".';
  }
  if (!Array.isArray(t.clauses) || t.clauses.length === 0) {
    return 'clauses must be a non-empty array of strings.';
  }
  return null;
}
