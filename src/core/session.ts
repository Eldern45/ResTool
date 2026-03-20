import type {
  Clause, Substitution, Task, SessionState, ResolutionStep,
  SaveData, AnswerValidationResult,
} from './types';
import { parseClause, parseLiteral, parseSubstitution } from './parser';
import { printClause, printLiteral, printSubstitution } from './printer';
import { validateResolutionByAnswer } from './resolution';

export class ProofSession {
  private stateStack: SessionState[] = [];
  private redoStack: SessionState[] = [];
  private currentState: SessionState;
  private constants: ReadonlySet<string>;
  private task: Task;

  constructor(task: Task, parsedClauses: Clause[], constants: ReadonlySet<string>) {
    this.task = task;
    this.constants = constants;
    this.currentState = {
      taskId: task.id,
      clauses: [...parsedClauses],
      initialClauseCount: parsedClauses.length,
      steps: [],
      isComplete: false,
      hintCounts: new Map(),
    };
  }

  getState(): SessionState {
    return this.currentState;
  }

  getTask(): Task {
    return this.task;
  }

  getConstants(): ReadonlySet<string> {
    return this.constants;
  }

  getClause(index: number): Clause | undefined {
    if (index < 1 || index > this.currentState.clauses.length) return undefined;
    return this.currentState.clauses[index - 1];
  }

  getAllClauses(): Array<{ index: number; clause: Clause; isInitial: boolean }> {
    return this.currentState.clauses.map((clause, i) => ({
      index: i + 1,
      clause,
      isInitial: i < this.currentState.initialClauseCount,
    }));
  }

  resolveByAnswer(
    clause1Idx: number,
    clause2Idx: number,
    studentSub1: Substitution,
    studentSub2: Substitution,
    expectedResolvent: Clause,
  ): AnswerValidationResult {
    const result = validateResolutionByAnswer(
      this.currentState.clauses,
      clause1Idx,
      clause2Idx,
      studentSub1,
      studentSub2,
      expectedResolvent,
    );

    if (!result.valid) return result;

    // Save current state for undo, clear redo history (new branch)
    this.stateStack.push(this.currentState);
    this.redoStack = [];

    const resolventIndex = this.currentState.clauses.length + 1;
    const step: ResolutionStep = {
      clause1Index: clause1Idx,
      clause2Index: clause2Idx,
      literal1: result.literal1,
      literal2: result.literal2,
      mgu1: result.mgu1,
      mgu2: result.mgu2,
      resolvent: result.resolvent,
      resolventIndex,
    };

    const isEmpty = result.resolvent.literals.length === 0;

    this.currentState = {
      taskId: this.currentState.taskId,
      clauses: [...this.currentState.clauses, result.resolvent],
      initialClauseCount: this.currentState.initialClauseCount,
      steps: [...this.currentState.steps, step],
      isComplete: isEmpty,
      hintCounts: new Map(this.currentState.hintCounts),
    };

    return result;
  }

  undo(): boolean {
    if (this.stateStack.length === 0) return false;
    this.redoStack.push(this.currentState);
    this.currentState = this.stateStack.pop()!;
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.stateStack.push(this.currentState);
    this.currentState = this.redoStack.pop()!;
    return true;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  isComplete(): boolean {
    return this.currentState.isComplete;
  }

  toSaveData(): SaveData {
    return {
      version: '1.0.0',
      taskId: this.currentState.taskId,
      timestamp: new Date().toISOString(),
      clauseStrings: this.currentState.clauses.map(printClause),
      initialClauseCount: this.currentState.initialClauseCount,
      steps: this.currentState.steps.map(step => ({
        clause1Index: step.clause1Index,
        clause2Index: step.clause2Index,
        literal1String: printLiteral(step.literal1),
        literal2String: printLiteral(step.literal2),
        mgu1String: printSubstitution(step.mgu1),
        mgu2String: printSubstitution(step.mgu2),
        resolventString: printClause(step.resolvent),
        resolventIndex: step.resolventIndex,
      })),
      isComplete: this.currentState.isComplete,
    };
  }

  static fromSaveData(
    data: SaveData,
    task: Task,
    constants: ReadonlySet<string>,
  ): ProofSession {
    const allClauses = data.clauseStrings.map(s => parseClause(s, constants));
    const initialClauses = allClauses.slice(0, data.initialClauseCount);

    const session = new ProofSession(task, initialClauses, constants);

    // Rebuild steps from serialized data
    const steps: ResolutionStep[] = data.steps.map(s => ({
      clause1Index: s.clause1Index,
      clause2Index: s.clause2Index,
      literal1: parseLiteral(s.literal1String, constants),
      literal2: parseLiteral(s.literal2String, constants),
      mgu1: parseSubstitution(s.mgu1String, constants),
      mgu2: parseSubstitution(s.mgu2String, constants),
      resolvent: parseClause(s.resolventString, constants),
      resolventIndex: s.resolventIndex,
    }));

    // Rebuild undo stack: push one state per step so undo works correctly
    for (let i = 0; i < steps.length; i++) {
      session.stateStack.push({
        taskId: data.taskId,
        clauses: allClauses.slice(0, data.initialClauseCount + i),
        initialClauseCount: data.initialClauseCount,
        steps: steps.slice(0, i),
        isComplete: false,
        hintCounts: new Map(),
      });
    }

    session.currentState = {
      taskId: data.taskId,
      clauses: allClauses,
      initialClauseCount: data.initialClauseCount,
      steps,
      isComplete: data.isComplete,
      hintCounts: new Map(),
    };

    return session;
  }
}
