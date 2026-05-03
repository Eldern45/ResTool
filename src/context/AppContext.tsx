import { useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Task } from '../core/types';
import { getAllTasks } from '../core/taskLoaderBrowser';
import { AppContext, type ExerciseStatus } from './appTypes';

const PROGRESS_KEY = 'restool-progress';
const IMPORTED_TASKS_KEY = 'restool-imported-tasks';
const ACTIVE_TASK_KEY = 'restool-active-task';

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

function loadActiveTaskId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TASK_KEY);
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => [
    ...getAllTasks(),
    ...loadImportedTasks(),
  ]);
  const [progress, setProgressState] = useState<Record<string, ExerciseStatus>>(loadProgress);
  const [activeTaskId, setActiveTaskIdState] = useState<string | null>(loadActiveTaskId);

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    if (activeTaskId === null) {
      localStorage.removeItem(ACTIVE_TASK_KEY);
    } else {
      localStorage.setItem(ACTIVE_TASK_KEY, activeTaskId);
    }
  }, [activeTaskId]);

  const setActiveTaskId = useCallback((taskId: string | null) => {
    setActiveTaskIdState(taskId);
  }, []);

  const addTask = useCallback((task: Task) => {
    // Persist to localStorage first (with duplicate check), outside the state updater
    // so StrictMode's double-invocation of updaters doesn't cause duplicate writes.
    const imported = loadImportedTasks();
    if (!imported.some(t => t.id === task.id)) {
      imported.push(task);
      localStorage.setItem(IMPORTED_TASKS_KEY, JSON.stringify(imported));
    }
    setTasks(prev => {
      if (prev.some(t => t.id === task.id)) return prev;
      return [...prev, task];
    });
  }, []);

  const setProgress = useCallback((taskId: string, status: ExerciseStatus) => {
    setProgressState(prev => ({ ...prev, [taskId]: status }));
  }, []);

  return (
    <AppContext.Provider value={{ tasks, progress, addTask, setProgress, activeTaskId, setActiveTaskId }}>
      {children}
    </AppContext.Provider>
  );
}
