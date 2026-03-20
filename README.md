# Restool — Resolution Proof Tool

Educational tool for practicing resolution proofs in propositional and predicate logic.
Students select tasks, resolve clause pairs, provide MGUs, and derive the empty clause.

## Commands

- `npm run dev` — Start Vite dev server (React frontend)
- `npm run cli` — Run CLI REPL (`tsx src/cli/index.ts`)
- `npm run test` — Run Vitest test suite
- `npm run test:watch` — Run Vitest in watch mode
- `npm run build` — TypeScript check + Vite build
- `npm run lint` — ESLint

## Architecture

```
src/
  core/           — Domain logic (pure TS, no React)
  cli/            — CLI REPL interface
  tests/          — Vitest tests + test data
  tasks/          — Built-in task definitions
  hooks/          — React hooks
  context/        — React context (global app state)
  components/
    layout/       — Header
    exercises/    — Task list page
    workbench/    — Resolution workbench page
    common/       — Shared UI (Modal)
```

## Core Files (`src/core/`)

| File | Purpose |
|------|---------|
| `types.ts` | All domain types: `Term`, `Literal`, `Clause`, `Substitution`, `ResolutionStep`, `SessionState`, `Task`, `SaveData`, `ValidationError` |
| `parser.ts` | Parses string → domain types. Uses `const` object for `TokenType` (not `enum` — see TS gotcha). Entry points: `parseClause`, `parseLiteral`, `parseSubstitution` |
| `printer.ts` | Domain types → string. `printClause`, `printLiteral`, `printSubstitution`, `printAtom` |
| `substitution.ts` | Apply/compose substitutions, variable ops: `applyToClause`, `applyToAtom`, `variablesInClause`, `renameVariables`, `removeDuplicateLiterals` |
| `unifier.ts` | Robinson unification: `unifyAtoms(a1, a2): { success, mgu? }` |
| `resolution.ts` | Answer-based validation: `validateResolutionByAnswer()`. Validates per-clause σ1/σ2 and infers which complementary pair was resolved |
| `session.ts` | `ProofSession` class — stateful proof manager with undo/redo stacks, `resolveByAnswer()`, `toSaveData()`, `fromSaveData()` |
| `solver.ts` | Hint engine: `findNextStep()`, `findStepsForPair()`, `diagnoseStep()`. Renames c2 variables before unifying to compute per-clause σ1/σ2 |
| `taskLoader.ts` | Node.js task loader (CLI only — uses `fs`/`path`) |
| `taskLoaderBrowser.ts` | Browser task loader (Vite JSON import). `getAllTasks()`, `getTaskById()`, `getTaskConstants()` |

## Frontend Files

### `src/App.tsx`
Root component. Sets up `BrowserRouter` + `AppProvider`. Two routes:
- `/` → `ExercisesPage`
- `/workbench/:taskId` → `WorkbenchPage`

### `src/context/appTypes.ts`
Shared types and context object: `ExerciseStatus`, `AppState`, `AppContext` (createContext).
Separated from `AppContext.tsx` so non-component exports don't break React Fast Refresh.

### `src/context/AppContext.tsx`
`AppProvider` component — global state provider. Manages:
- `tasks` — built-in + imported tasks
- `progress` — `Record<taskId, 'not-started' | 'in-progress' | 'solved'>` (persisted to `restool-progress` in localStorage)
- `addTask(task)` — adds imported task, persists to `restool-imported-tasks` in localStorage
- `setProgress(id, status)` — updates progress

### `src/hooks/useApp.ts`
Convenience hook wrapping `useContext(AppContext)` with null check.

### `src/hooks/useProofSession.ts`
Main session hook. Wraps mutable `ProofSession` ref with React state.
- Loads session from localStorage on mount (`restool-session-{taskId}`)
- Saves to localStorage on every mutation via `sync()`
- Exposes: `{ state, resolve, undo, redo, canRedo, reset, constants }`
- `canRedo` is tracked as separate `useState` (not derived from session) for reactivity

### `src/components/layout/Header.tsx`
Top navigation bar. In workbench mode (`workbenchMode` prop) shows Undo/Redo/Reset buttons.
Props: `workbenchMode?`, `onUndo?`, `onRedo?`, `onReset?`, `canUndo?`, `canRedo?`

### `src/components/exercises/`
- `ExercisesPage.tsx` — task list page with "Load Exercise" button
- `ExerciseTable.tsx` — renders task rows, status badges, links to workbench
- `StatusBadge.tsx` — colored badge for `not-started` / `in-progress` / `solved`
- `LoadExerciseModal.tsx` — drag-and-drop JSON import modal; validates + calls `addTask`

### `src/components/workbench/`
- `WorkbenchPage.tsx` — route component. Resolves `taskId` param, wires up `useProofSession`, renders fixed-width KB panel (450px) + flex workbench
- `WorkbenchPanel.tsx` — main resolution form. Manages MGU bindings, resolvent input, error/hint state. Calls `diagnoseStep` on failed submit
- `KnowledgeBase.tsx` — left panel showing all clauses (initial + derived); click to select for resolution
- `ClauseCard.tsx` — single clause card with selection state
- `ParentSlot.tsx` — placeholder card showing selected parent clause
- `MguInput.tsx` — multi-binding MGU input with + button and comma shortcut
- `SmartInput.tsx` — smart text input: auto-`()` on uppercase (predicate mode), auto-close `(`, `-` → `~`
- `HintPopover.tsx` — amber hint panel shown below error when user clicks `?`. Progressive 2–3 level reveal with "Fill MGUs" / "Fill Resolvent" buttons

## Key Concepts

- **Term**: Variable | Constant | FunctionApp
- **Clause**: list of Literals (each = Atom + negated flag)
- **Substitution**: list of Bindings (variable → term)
- **ResolutionStep**: clause pair + σ1/σ2 + resolved literals + resolvent
- **ProofSession** (`session.ts`): stateful proof manager tracking clauses, steps, undo/redo stacks, completion

## Answer-Based Resolution Flow

Students provide the **expected resolvent**; system infers which complementary pair was resolved:
- **Predicate**: clause indices → σ1 → σ2 → resolvent
- **Propositional**: clause indices → resolvent (no MGUs needed)
- Core functions: `validateResolutionByAnswer()` (resolution.ts), `resolveByAnswer()` (session.ts)
- Empty clause: `∅ Empty` button bypasses resolvent input and submits `{}`

## Hints System

`?` button appears only after a failed non-parse-error submit. Progressive reveal:

| Level | Content |
|-------|---------|
| 1 | Guidance message + contextual details |
| 2 | Correct MGUs + "Fill MGUs" button (auto-populates inputs) |
| 3 | Correct resolvent + "Fill Resolvent" button (only for `incorrect_resolvent`) |

Error kinds with 2 levels: `no_complementary_literals`, `incorrect_mgu`, `unification_fails`, `mgu_not_most_general`
Error kinds with 3 levels: `incorrect_resolvent`

`diagnoseStep()` in `solver.ts` dispatches to per-error handlers. The solver renames c2's
variables before unifying (avoids name collisions), then un-renames to produce split σ1/σ2.

## localStorage Keys

| Key | Content |
|-----|---------|
| `restool-progress` | `Record<taskId, ExerciseStatus>` |
| `restool-imported-tasks` | `Task[]` (user-imported via JSON) |
| `restool-session-{taskId}` | `SaveData` (in-progress proof steps) |

`fromSaveData` rebuilds the undo stack so that undo works correctly after page reload.

## Naming Conventions (Parser Rules)

- **Predicates**: `UPPERCASE` first letter — `P`, `Q`, `Likes`, `V`
- **Variables**: `lowercase`, not in task's `constants` list — `x`, `y`, `z`
- **Constants**: `lowercase`, declared in task's `constants` field — `a`, `b`
- **Functions**: `lowercase` name with args — `f(x)`, `g(a, y)`
- **Default constants** (when task omits `constants`): `a`, `b`, `c`, `d`, `e`

## Adding Tasks

Built-in tasks live in `src/tasks/tasks.json`. Users can also import tasks at runtime via the UI.

```json
{
  "id": "unique-id",
  "title": "Display title",
  "logicType": "propositional" | "predicate",
  "clauses": ["{P(x)}", "{~P(a)}"],
  "constants": ["a"]   // optional; overrides default a-e
}
```

For importing: wrap in `{ "tasks": [...] }` or provide a single task object — both formats accepted.
