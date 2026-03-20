import {useCallback, useRef, useState} from 'react';
import {ProofSession} from '../core/session';
import {parseClause, parseSubstitution} from '../core/parser';
import {getTaskConstants} from '../core/taskLoaderBrowser';
import type {AnswerValidationResult, SessionState, Task} from '../core/types';
import {EMPTY_SUBSTITUTION} from '../core/types';

const SESSION_KEY_PREFIX = 'restool-session-';

function loadSession(task: Task, parsedClauses: ReturnType<typeof parseClause>[], constants: ReadonlySet<string>): ProofSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY_PREFIX + task.id);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.taskId === task.id) {
        return ProofSession.fromSaveData(data, task, constants);
      }
    }
  } catch {
    // Corrupted data — ignore and start fresh
  }
  return new ProofSession(task, parsedClauses, constants);
}

export function useProofSession(task: Task) {
  const constants = getTaskConstants(task);
  const parsedClauses = task.clauses.map(s => parseClause(s, constants));

  const sessionRef = useRef<ProofSession>(loadSession(task, parsedClauses, constants));
  // eslint-disable-next-line react-hooks/refs
  const [state, setState] = useState<SessionState>(sessionRef.current.getState());
  // eslint-disable-next-line react-hooks/refs
  const [canRedo, setCanRedo] = useState(sessionRef.current.canRedo());

  const sync = () => {
    setState(sessionRef.current.getState());
    setCanRedo(sessionRef.current.canRedo());
    try {
      localStorage.setItem(SESSION_KEY_PREFIX + task.id, JSON.stringify(sessionRef.current.toSaveData()));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  };

  const resolve = useCallback((
    idx1: number,
    idx2: number,
    sub1Str: string,
    sub2Str: string,
    resolventStr: string,
  ): AnswerValidationResult | { valid: false; errorKind: 'parse_error'; message: string } => {
    try {
      const sub1 = task.logicType === 'propositional'
        ? EMPTY_SUBSTITUTION
        : parseSubstitution(sub1Str || '{}', constants);
      const sub2 = task.logicType === 'propositional'
        ? EMPTY_SUBSTITUTION
        : parseSubstitution(sub2Str || '{}', constants);
      const resolvent = parseClause(resolventStr, constants);

      const result = sessionRef.current.resolveByAnswer(idx1, idx2, sub1, sub2, resolvent);
      sync();
      return result;
    } catch (e) {
      return {
        valid: false,
        errorKind: 'parse_error',
        message: e instanceof Error ? e.message : 'Parse error',
      };
    }
  }, [task, constants]);

  const undo = useCallback(() => {
    const ok = sessionRef.current.undo();
    if (ok) sync();
    return ok;
  }, []);

  const redo = useCallback(() => {
    const ok = sessionRef.current.redo();
    if (ok) sync();
    return ok;
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(SESSION_KEY_PREFIX + task.id);
    sessionRef.current = new ProofSession(task, parsedClauses, constants);
    sync();
  }, [task, parsedClauses, constants]);

  return { state, resolve, undo, redo, canRedo, reset, constants };
}
