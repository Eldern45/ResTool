import type { Interface as ReadlineInterface } from 'node:readline/promises';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import type { Substitution, Clause, SaveData } from '../core/types';
import { EMPTY_SUBSTITUTION } from '../core/types';
import { parseClause, parseSubstitution, ParseError } from '../core/parser';
import { ProofSession } from '../core/session';
import { getTaskConstants, getTaskById } from '../core/taskLoader';
import { Display } from './display';

const DEFAULT_SAVE_PATH = 'restool-save.json';

export async function handleResolve(
  session: ProofSession,
  rl: ReadlineInterface,
  display: Display,
): Promise<void> {
  const task = session.getTask();
  const constants = session.getConstants();
  const isPropositional = task.logicType === 'propositional';

  // Get clause indices
  const idx1Str = await rl.question('  First clause: ');
  const idx1 = parseInt(idx1Str.trim(), 10);
  if (isNaN(idx1)) {
    display.showError('Please enter a valid clause number.');
    return;
  }

  const idx2Str = await rl.question('  Second clause: ');
  const idx2 = parseInt(idx2Str.trim(), 10);
  if (isNaN(idx2)) {
    display.showError('Please enter a valid clause number.');
    return;
  }

  // Get substitutions (predicate logic only)
  let studentSub1: Substitution;
  let studentSub2: Substitution;

  if (isPropositional) {
    studentSub1 = EMPTY_SUBSTITUTION;
    studentSub2 = EMPTY_SUBSTITUTION;
  } else {
    const mgu1Str = await rl.question(`  MGU for clause ${idx1}: `);
    try {
      studentSub1 = parseSubstitution(mgu1Str.trim(), constants);
    } catch (e) {
      if (e instanceof ParseError) {
        display.showError(`Parse error in MGU for clause ${idx1}:\n    ${e.formatError()}`);
      } else {
        display.showError(`Invalid substitution: ${(e as Error).message}`);
      }
      return;
    }

    const mgu2Str = await rl.question(`  MGU for clause ${idx2}: `);
    try {
      studentSub2 = parseSubstitution(mgu2Str.trim(), constants);
    } catch (e) {
      if (e instanceof ParseError) {
        display.showError(`Parse error in MGU for clause ${idx2}:\n    ${e.formatError()}`);
      } else {
        display.showError(`Invalid substitution: ${(e as Error).message}`);
      }
      return;
    }
  }

  // Get expected resolvent
  const resolventStr = await rl.question('  Resolvent: ');
  let expectedResolvent: Clause;
  try {
    expectedResolvent = parseClause(resolventStr.trim(), constants);
  } catch (e) {
    if (e instanceof ParseError) {
      display.showError(`Parse error in resolvent:\n    ${e.formatError()}`);
    } else {
      display.showError(`Invalid clause: ${(e as Error).message}`);
    }
    return;
  }

  // Perform resolution
  const result = session.resolveByAnswer(idx1, idx2, studentSub1, studentSub2, expectedResolvent);

  if (!result.valid) {
    display.showError(result.message);
    return;
  }

  // Show confirmation
  const state = session.getState();
  const lastStep = state.steps[state.steps.length - 1];
  display.showResolvent(lastStep);

  // Check completion
  if (session.isComplete()) {
    display.showCompletion(session);
  }
}

export function handleUndo(session: ProofSession, display: Display): void {
  if (session.undo()) {
    display.showSuccess('Last step undone.');
    display.showClauses(session);
  } else {
    display.showError('Nothing to undo.');
  }
}

export function handleHint(_session: ProofSession, display: Display): void {
  display.showHintUnavailable();
}

export async function handleSave(
  session: ProofSession,
  rl: ReadlineInterface,
  display: Display,
): Promise<void> {
  const pathStr = await rl.question(`  Save path [${DEFAULT_SAVE_PATH}]: `);
  const path = pathStr.trim() || DEFAULT_SAVE_PATH;

  try {
    const data = session.toSaveData();
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
    display.showSaved(path);
  } catch (e) {
    display.showError(`Failed to save: ${(e as Error).message}`);
  }
}

export async function handleLoad(
  rl: ReadlineInterface,
  display: Display,
): Promise<ProofSession | null> {
  const pathStr = await rl.question(`  Load path [${DEFAULT_SAVE_PATH}]: `);
  const path = pathStr.trim() || DEFAULT_SAVE_PATH;

  if (!existsSync(path)) {
    display.showError(`File not found: ${path}`);
    return null;
  }

  try {
    const raw = readFileSync(path, 'utf-8');
    const data: SaveData = JSON.parse(raw);

    const task = getTaskById(data.taskId);
    if (!task) {
      display.showError(`Task "${data.taskId}" not found. Cannot restore session.`);
      return null;
    }

    const constants = getTaskConstants(task);
    const session = ProofSession.fromSaveData(data, task, constants);
    display.showLoaded(path);
    return session;
  } catch (e) {
    display.showError(`Failed to load: ${(e as Error).message}`);
    return null;
  }
}

export function handleList(session: ProofSession, display: Display): void {
  display.showClauses(session);
}
