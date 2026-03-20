import chalk from 'chalk';
import type { ResolutionStep, Task } from '../core/types';
import { printClause, printLiteral, printSubstitution } from '../core/printer';
import type { ProofSession } from '../core/session';

export class Display {
  showWelcome(): void {
    console.log('');
    console.log(chalk.bold('=== Resolution Method Learning Tool ==='));
    console.log('Practice propositional and predicate logic resolution.\n');
  }

  showMainMenu(): void {
    console.log('1. Start new task');
    console.log('2. Load saved progress');
    console.log('3. Quit');
    console.log('');
  }

  showTaskList(tasks: readonly Task[]): void {
    console.log(chalk.bold('\nAvailable tasks:\n'));

    const groups: Record<string, Task[]> = {};
    for (const task of tasks) {
      const key = task.logicType;
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }

    for (const [group, groupTasks] of Object.entries(groups)) {
      console.log(chalk.underline(`  ${group}:`));
      for (const task of groupTasks) {
        console.log(`    ${chalk.cyan(`[${task.id}]`)} ${task.title}`);
      }
      console.log('');
    }
  }

  showTaskHeader(task: Task): void {
    console.log('');
    console.log(chalk.bold(`=== ${task.title} ===`));
    console.log('');
  }

  showClauses(session: ProofSession): void {
    const all = session.getAllClauses();
    const state = session.getState();

    console.log(chalk.bold('\nClauses:'));
    for (const { index, clause, isInitial } of all) {
      const clauseStr = printClause(clause);
      const numStr = `  ${String(index).padStart(2)}.`;

      if (!isInitial) {
        // Find the step that derived this clause
        const step = state.steps.find(s => s.resolventIndex === index);
        if (step) {
          const annotation = formatStepAnnotation(step);
          if (clause.literals.length === 0) {
            console.log(chalk.green(`${numStr} ${clauseStr}  ${annotation}  ${chalk.bold('<-- EMPTY CLAUSE')}`));
          } else {
            console.log(`${numStr} ${clauseStr}  ${chalk.dim(annotation)}`);
          }
        } else {
          console.log(`${numStr} ${clauseStr}`);
        }
      } else {
        console.log(`${numStr} ${clauseStr}`);
      }

      // Add separator after initial clauses
      if (isInitial && index === state.initialClauseCount && state.steps.length > 0) {
        console.log('  ' + chalk.dim('─'.repeat(40)));
      }
    }
    console.log('');
  }

  showResolvent(step: ResolutionStep): void {
    const clauseStr = printClause(step.resolvent);
    const annotation = formatStepAnnotation(step);

    if (step.resolvent.literals.length === 0) {
      console.log(chalk.green.bold(`\n  Correct! ${step.resolventIndex}. ${clauseStr}  ${annotation}  <-- EMPTY CLAUSE`));
    } else {
      console.log(chalk.green(`\n  Correct! ${step.resolventIndex}. ${clauseStr}  ${chalk.dim(annotation)}`));
    }
  }

  showError(message: string): void {
    console.log(chalk.red(`\n  Error: ${message}`));
  }

  showSuccess(message: string): void {
    console.log(chalk.green(`\n  ${message}`));
  }

  showHintUnavailable(): void {
    console.log(chalk.yellow('\n  Hints are not yet available.'));
  }

  showCompletion(session: ProofSession): void {
    console.log('');
    console.log(chalk.green.bold('  The empty clause has been derived!'));
    console.log(chalk.green.bold('  The clause set is unsatisfiable. Proof complete.'));
    console.log('');
    this.showDerivation(session);
  }

  showDerivation(session: ProofSession): void {
    const state = session.getState();
    if (state.steps.length === 0) {
      console.log(chalk.dim('  No resolution steps performed yet.'));
      return;
    }

    console.log(chalk.bold('  Derivation:'));
    for (const step of state.steps) {
      const isPropositional = step.literal1.atom.args.length === 0;
      const resolventStr = printClause(step.resolvent);
      const litStr = printLiteral(step.literal1);

      let line = `    ${step.resolventIndex}. ${resolventStr}  [from ${step.clause1Index}, ${step.clause2Index} on ${litStr}`;
      if (!isPropositional) {
        line += `, σ1: ${printSubstitution(step.mgu1)}, σ2: ${printSubstitution(step.mgu2)}`;
      }
      line += ']';

      console.log(line);
    }
    console.log('');
  }

  showHelp(): void {
    console.log(chalk.bold('\nCommands:'));
    console.log('  resolve (r)  - Perform a resolution step');
    console.log('  undo    (u)  - Undo the last step');
    console.log('  hint    (h)  - Get a hint');
    console.log('  list    (l)  - Re-display all clauses');
    console.log('  save    (s)  - Save progress to file');
    console.log('  quit    (q)  - Return to main menu');
    console.log('  help         - Show this help');
    console.log('');
  }

  showSaved(path: string): void {
    console.log(chalk.green(`\n  Progress saved to: ${path}`));
  }

  showLoaded(path: string): void {
    console.log(chalk.green(`\n  Progress loaded from: ${path}`));
  }
}

function formatStepAnnotation(step: ResolutionStep): string {
  const isPropositional = step.literal1.atom.args.length === 0;
  const predicate = step.literal1.atom.predicate;

  if (isPropositional) {
    return `[from ${step.clause1Index}, ${step.clause2Index} on ${predicate}]`;
  }

  return `[from ${step.clause1Index}, ${step.clause2Index} on ${printLiteral(step.literal1)}]`;
}
