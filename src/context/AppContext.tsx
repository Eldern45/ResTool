import { useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Task } from '../core/types';
import { getAllTasks } from '../core/taskLoaderBrowser';
import { AppContext, type ExerciseStatus } from './appTypes';

const PROGRESS_KEY = 'restool-progress';
const IMPORTED_TASKS_KEY = 'restool-imported-tasks';

function loadProgress(): Record<string, ExerciseStatus> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadImportedTasks(): Task[] {
  try {
    const raw = localStorage.getItem(IMPORTED_TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => [
    ...getAllTasks(),
    ...loadImportedTasks(),
  ]);
  const [progress, setProgressState] = useState<Record<string, ExerciseStatus>>(loadProgress);

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => {
      if (prev.some(t => t.id === task.id)) return prev;
      const next = [...prev, task];
      const imported = loadImportedTasks();
      imported.push(task);
      localStorage.setItem(IMPORTED_TASKS_KEY, JSON.stringify(imported));
      return next;
    });
  }, []);

  const setProgress = useCallback((taskId: string, status: ExerciseStatus) => {
    setProgressState(prev => ({ ...prev, [taskId]: status }));
  }, []);

  return (
    <AppContext.Provider value={{ tasks, progress, addTask, setProgress }}>
      {children}
    </AppContext.Provider>
  );
}
