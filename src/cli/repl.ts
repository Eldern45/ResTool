import type { Interface as ReadlineInterface } from 'node:readline/promises';
import type { Task } from '../core/types';
import { parseClause } from '../core/parser';
import { ProofSession } from '../core/session';
import { getAllTasks, getTaskById, getTaskConstants } from '../core/taskLoader';
import { Display } from './display';
import {
  handleResolve,
  handleUndo,
  handleHint,
  handleSave,
  handleLoad,
  handleList,
} from './commands';

type ReplState = 'main_menu' | 'task_select' | 'solving' | 'completed';

export class Repl {
  private rl: ReadlineInterface;
  private display: Display;
  private state: ReplState = 'main_menu';
  private session: ProofSession | null = null;
  private running = true;

  constructor(rl: ReadlineInterface) {
    this.rl = rl;
    this.display = new Display();
  }

  async run(): Promise<void> {
    this.display.showWelcome();

    while (this.running) {
      switch (this.state) {
        case 'main_menu':
          await this.mainMenu();
          break;
        case 'task_select':
          await this.taskSelect();
          break;
        case 'solving':
          await this.solving();
          break;
        case 'completed':
          await this.completed();
          break;
      }
    }
  }

  private async mainMenu(): Promise<void> {
    this.display.showMainMenu();
    const choice = await this.rl.question('> ');

    switch (choice.trim()) {
      case '1':
        this.state = 'task_select';
        break;
      case '2': {
        const session = await handleLoad(this.rl, this.display);
        if (session) {
          this.session = session;
          const task = session.getTask();
          this.display.showTaskHeader(task);
          this.display.showClauses(session);
          this.state = session.isComplete() ? 'completed' : 'solving';
        }
        break;
      }
      case '3':
        this.running = false;
        console.log('\nGoodbye!\n');
        break;
      default:
        this.display.showError('Please enter 1, 2, or 3.');
        break;
    }
  }

  private async taskSelect(): Promise<void> {
    const tasks = getAllTasks();
    this.display.showTaskList(tasks);

    const id = await this.rl.question('Enter task ID (or "back"): ');
    const trimmed = id.trim();

    if (trimmed === 'back' || trimmed === 'b') {
      this.state = 'main_menu';
      return;
    }

    const task = getTaskById(trimmed);
    if (!task) {
      this.display.showError(`Task "${trimmed}" not found. Try again.`);
      return;
    }

    this.startTask(task);
  }

  private startTask(task: Task): void {
    const constants = getTaskConstants(task);

    // Parse all clauses
    const parsedClauses = task.clauses.map((clauseStr, i) => {
      try {
        return parseClause(clauseStr, constants);
      } catch (e) {
        throw new Error(`Failed to parse clause ${i + 1} ("${clauseStr}"): ${(e as Error).message}`);
      }
    });

    this.session = new ProofSession(task, parsedClauses, constants);
    this.display.showTaskHeader(task);
    this.display.showClauses(this.session);
    this.display.showHelp();
    this.state = 'solving';
  }

  private async solving(): Promise<void> {
    if (!this.session) {
      this.state = 'main_menu';
      return;
    }

    const input = await this.rl.question('> ');
    const cmd = input.trim().toLowerCase();

    switch (cmd) {
      case 'resolve':
      case 'r':
        await handleResolve(this.session, this.rl, this.display);
        if (this.session.isComplete()) {
          this.state = 'completed';
        }
        break;
      case 'undo':
      case 'u':
        handleUndo(this.session, this.display);
        break;
      case 'hint':
      case 'h':
        handleHint(this.session, this.display);
        break;
      case 'list':
      case 'l':
        handleList(this.session, this.display);
        break;
      case 'save':
      case 's':
        await handleSave(this.session, this.rl, this.display);
        break;
      case 'quit':
      case 'q': {
        if (this.session.getState().steps.length > 0) {
          const answer = await this.rl.question('  Save progress before quitting? (y/n): ');
          if (answer.trim().toLowerCase() === 'y') {
            await handleSave(this.session, this.rl, this.display);
          }
        }
        this.session = null;
        this.state = 'main_menu';
        console.log('');
        break;
      }
      case 'help':
        this.display.showHelp();
        break;
      case '':
        break;
      default:
        this.display.showError(`Unknown command: "${cmd}". Type "help" for available commands.`);
        break;
    }
  }

  private async completed(): Promise<void> {
    console.log('  1. Return to main menu');
    console.log('  2. View derivation');
    console.log('  3. Quit');
    console.log('');

    const choice = await this.rl.question('> ');

    switch (choice.trim()) {
      case '1':
        this.session = null;
        this.state = 'main_menu';
        break;
      case '2':
        if (this.session) {
          this.display.showDerivation(this.session);
        }
        break;
      case '3':
        this.running = false;
        console.log('\nGoodbye!\n');
        break;
      default:
        this.display.showError('Please enter 1, 2, or 3.');
        break;
    }
  }
}
