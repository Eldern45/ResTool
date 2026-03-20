import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Task, TaskFile, TaskLogicType } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TASKS_PATH = join(__dirname, '..', 'tasks', 'tasks.json');

let cachedTasks: TaskFile | null = null;

export function loadTasks(): TaskFile {
  if (cachedTasks) return cachedTasks;

  const raw = readFileSync(TASKS_PATH, 'utf-8');
  const data = JSON.parse(raw);
  cachedTasks = validateTaskFile(data);
  return cachedTasks;
}

export function getTaskById(id: string): Task | undefined {
  const file = loadTasks();
  return file.tasks.find(t => t.id === id);
}

export function getTasksByLogicType(logicType: TaskLogicType): Task[] {
  const file = loadTasks();
  return file.tasks.filter(t => t.logicType === logicType);
}

export function getAllTasks(): Task[] {
  return loadTasks().tasks as Task[];
}

function validateTaskFile(data: unknown): TaskFile {
  if (!data || typeof data !== 'object') {
    throw new Error('Task file must be a JSON object');
  }

  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.tasks)) {
    throw new Error('Task file must have a "tasks" array');
  }

  for (let i = 0; i < obj.tasks.length; i++) {
    validateTask(obj.tasks[i], i);
  }

  return data as TaskFile;
}

function validateTask(data: unknown, index: number): void {
  if (!data || typeof data !== 'object') {
    throw new Error(`Task at index ${index} must be an object`);
  }

  const t = data as Record<string, unknown>;
  const required = ['id', 'title', 'logicType', 'clauses'];
  for (const field of required) {
    if (!(field in t)) {
      throw new Error(`Task at index ${index} is missing required field "${field}"`);
    }
  }

  if (typeof t.id !== 'string' || typeof t.title !== 'string') {
    throw new Error(`Task at index ${index}: id, title must be strings`);
  }

  if (t.logicType !== 'propositional' && t.logicType !== 'predicate') {
    throw new Error(`Task at index ${index}: logicType must be "propositional" or "predicate"`);
  }

  if (!Array.isArray(t.clauses) || t.clauses.length === 0) {
    throw new Error(`Task at index ${index}: clauses must be a non-empty array`);
  }

  for (const c of t.clauses) {
    if (typeof c !== 'string') {
      throw new Error(`Task at index ${index}: each clause must be a string`);
    }
  }
}

export function getTaskConstants(task: Task): ReadonlySet<string> {
  if (task.constants && task.constants.length > 0) {
    return new Set(task.constants);
  }
  // Default constants
  return new Set(['a', 'b', 'c', 'd', 'e']);
}
