import { useState, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { useProofSession } from '../../hooks/useProofSession';
import { getTaskById } from '../../core/taskLoaderBrowser';
import Header from '../layout/Header';
import KnowledgeBase from './KnowledgeBase';
import WorkbenchPanel from './WorkbenchPanel';

export default function WorkbenchPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { tasks, setProgress } = useApp();

  // Look up in both built-in and imported tasks
  const task = tasks.find(t => t.id === taskId) ?? getTaskById(taskId ?? '');

  if (!task) {
    return <Navigate to="/" replace />;
  }

  return <WorkbenchInner task={task} setProgress={setProgress} />;
}

function WorkbenchInner({ task, setProgress }: {
  task: NonNullable<ReturnType<typeof getTaskById>>;
  setProgress: (taskId: string, status: 'not-started' | 'in-progress' | 'solved') => void;
}) {
  const { state, resolve, undo, redo, canRedo, reset, constants } = useProofSession(task);
  const [selected, setSelected] = useState<[number | null, number | null]>([null, null]);

  const handleSelect = useCallback((index: number) => {
    setSelected(prev => {
      if (prev[0] === index) return [prev[1], null];
      if (prev[1] === index) return [prev[0], null];
      if (prev[0] === null) return [index, prev[1]];
      if (prev[1] === null) return [prev[0], index];
      return [prev[1], index];
    });
  }, []);

  const handleResolve = useCallback((
    idx1: number, idx2: number, sub1: string, sub2: string, resolventStr: string
  ) => {
    setProgress(task.id, 'in-progress');
    const result = resolve(idx1, idx2, sub1, sub2, resolventStr);
    if (result.valid) {
      setSelected([null, null]);
    }
    return result;
  }, [resolve, setProgress, task.id]);

  const handleComplete = useCallback(() => {
    setProgress(task.id, 'solved');
  }, [setProgress, task.id]);

  const handleUndo = useCallback(() => {
    undo();
    setSelected([null, null]);
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
    setSelected([null, null]);
  }, [redo]);

  const handleReset = useCallback(() => {
    reset();
    setSelected([null, null]);
  }, [reset]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-inter">
      <Header
        workbenchMode
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleReset}
        canUndo={state.steps.length > 0}
        canRedo={canRedo}
      />
      <div className="flex-1 flex gap-6 p-6 min-h-0 overflow-hidden">
        {/* Knowledge Base — fixed width left panel */}
        <div className="w-[450px] shrink-0 min-h-0">
          <KnowledgeBase
            state={state}
            selected={selected}
            onSelect={handleSelect}
          />
        </div>
        {/* Workbench — fills remaining space */}
        <div className="flex-1 min-w-0 min-h-0">
          <WorkbenchPanel
            state={state}
            selected={selected}
            isPredicate={task.logicType === 'predicate'}
            constants={constants}
            taskId={task.id}
            onResolve={handleResolve}
            onComplete={handleComplete}
          />
        </div>
      </div>
    </div>
  );
}
