import tasksData from '../tasks/tasks.json';
import type { Task, TaskFile } from './types';

const DISABLE_JSON_TASKS = true;
const taskFile = tasksData as TaskFile;

export function getAllTasks(): Task[] {
  if (DISABLE_JSON_TASKS) return [];
  return taskFile.tasks as Task[];
}

export function getTaskById(id: string): Task | undefined {
  return taskFile.tasks.find(t => t.id === id);
}

export function getTaskConstants(task: Task): ReadonlySet<string> {
  if (task.constants && task.constants.length > 0) {
    return new Set(task.constants);
  }
  return new Set(['a', 'b', 'c', 'd', 'e']);
}
