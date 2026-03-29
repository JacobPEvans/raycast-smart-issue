# raycast-smart-issue

Raycast extension for AI-powered GitHub issue creation using local LLM inference (vllm-mlx).

## Critical Constraints

1. **Worktrees required**: Run `/init-worktree` before any work
2. **No direct main commits**: Always use feature branches
3. **Bun for deps**: Use `bun install` (NOT npm) — bun.lock is the lockfile
4. **Nix devShell**: `direnv allow` activates Node.js 22 + Bun environment
5. **No npm**: npm is forbidden. Use `bun run` for all package.json scripts

## Build & Validation

```bash
bun install          # Install dependencies (uses bun.lock)
bun run build        # ray build — compile extension
bun run lint         # ray lint — ESLint + Prettier
bun run fix-lint     # ray lint --fix — auto-fix
bun run dev          # ray develop — link to Raycast with hot reload
```

## Architecture

TypeScript Raycast extension using `@raycast/api` + `@raycast/utils`.

- `src/create-issue.tsx` — Main form UI (repo/type/priority/size dropdowns + idea text)
- `src/lib/llm.ts` — OpenAI-compatible API client for local LLM (vllm-mlx on :11434)
- `src/lib/github.ts` — GitHub API via @octokit/rest
- `src/lib/core.ts` — Orchestrator: parallel fetches, label resolution, issue creation
- `src/lib/prompt.ts` — AI prompt builder with label/hint context
- `src/lib/types.ts` — Shared types (GitHubIssue, LabelSet, Repo, etc.)

### Key patterns

- **useCachedPromise** from `@raycast/utils` for all async data (repos, labels)
- **Dynamic label dropdowns** populated per-repo via `getRepoLabels`
- **Parallel fetches** via `Promise.all` in `createSmartIssue`
- **OpenAI-compatible API** — `/v1/models` and `/v1/chat/completions`

### LLM integration

vllm-mlx runs as a LaunchAgent on port 11434.
Model defaults to `mlx-community/Qwen3.5-27B-4bit`. Empty fallback = auto-detect from `/v1/models`.

## Dependencies

- `@raycast/api` — Raycast extension framework
- `@raycast/utils` — useCachedPromise, utilities
- `@octokit/rest` — GitHub API client
