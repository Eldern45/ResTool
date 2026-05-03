import { createContext } from 'react';
import type { Task } from '../core/types';

export type ExerciseStatus = 'not-started' | 'in-progress' | 'solved';

export interface AppState {
  tasks: Task[];
  progress: Record<string, ExerciseStatus>;
  addTask: (task: Task) => void;
  setProgress: (taskId: string, status: ExerciseStatus) => void;
  activeTaskId: string | null;
  setActiveTaskId: (taskId: string | null) => void;
}

export const AppContext = createContext<AppState | null>(null);
