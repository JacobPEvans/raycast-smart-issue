# Smart Issue Creator

AI-powered GitHub issue creation using local LLM inference. Describe your idea briefly and get a well-structured GitHub issue with proper labels.

## Features

- 🤖 AI-generated issue titles, summaries, details, and acceptance criteria
- 🏷️ Dynamic label dropdowns (type, priority, size) populated per-repo
- 🔍 Duplicate detection — won't create issues that already exist
- ⚡ Local AI via vllm-mlx — no cloud AI costs, full privacy
- 📋 Cached data across command runs via `useCachedPromise`

## Installation

```bash
cd ~/git/raycast-smart-issue
direnv allow          # Activates Nix devShell (Node.js 22 + Bun)
bun install           # Install dependencies
bun run dev           # Link extension to Raycast with hot reload
```

## Setup

### 1. Local LLM Server

Ensure vllm-mlx is running on port 11434 (managed via LaunchAgent on this system):

```bash
# Verify the server is up
curl -s http://localhost:11434/v1/models | jq '.data[].id'
```

### 2. Create a GitHub Token

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. Create a **Classic token** with the `repo` scope
3. Copy the token

### 3. Configure the Extension

Open Raycast preferences for Smart Issue Creator and set:

| Preference | Description | Default |
|-----------|-------------|---------|
| GitHub Token | Your PAT with `repo` scope | _(required)_ |
| GitHub Organization/User | Your GitHub username or org | _(required)_ |
| LLM Server URL | OpenAI-compatible inference endpoint | `http://localhost:11434` |
| AI Model | Primary model for issue generation | `mlx-community/Qwen3.5-27B-4bit` |
| Fallback Model | Used if primary unavailable (empty = auto-detect) | _(empty)_ |

## Usage

1. Open Raycast and search for "Create Smart Issue"
2. Select a repository from the dropdown
3. Choose type, priority, and size hints (optional — dropdowns populate from repo labels)
4. Type a brief description of your idea
5. Press Enter — the AI generates and creates the issue

## Tips

- Start your idea with conventional commit prefixes: `feat:`, `fix:`, `docs:`, etc. — the AI will map them to labels
- Include hints like `size:s` or `priority:high` in your idea text
- The last selected repo and label choices are remembered across runs
