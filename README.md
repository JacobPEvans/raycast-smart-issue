# Smart Issue Creator

AI-powered GitHub issue creation using local Ollama models. Describe your idea briefly and get a well-structured GitHub issue with proper labels.

## Features

- 🤖 AI-generated issue titles, summaries, details, and acceptance criteria
- 🏷️ Automatic label assignment based on your repo's existing labels
- 🔍 Duplicate detection — won't create issues that already exist
- ⚡ Local AI via Ollama — no cloud AI costs, full privacy
- 📋 Priority selection to hint the AI

## Setup

### 1. Install Ollama

Download and install [Ollama](https://ollama.ai), then pull a model:

```bash
ollama pull llama4
```

Start Ollama (if not already running):

```bash
ollama serve
```

### 2. Create a GitHub Token

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. Create a **Classic token** with the `repo` scope
3. Copy the token

### 3. Configure the Extension

Open Raycast preferences for Smart Issue Creator and set:

| Preference | Description | Example |
|-----------|-------------|---------|
| GitHub Token | Your PAT with `repo` scope | `ghp_...` |
| GitHub Organization/User | Your GitHub username or org | `JacobPEvans` |
| Ollama URL | Ollama API endpoint | `http://localhost:11434` |
| AI Model | Primary model | `llama4:latest` |
| Fallback Model | Used if primary unavailable | `llama3.2:latest` |

## Usage

1. Open Raycast and search for "Create Smart Issue"
2. Select a repository from the dropdown
3. Choose a priority hint (optional)
4. Type a brief description of your idea
5. Press Enter — the AI generates and creates the issue

## Tips

- Start your idea with conventional commit prefixes: `feat:`, `fix:`, `docs:`, etc. — the AI will map them to labels
- Include hints like `size:s` or `priority:high` in your idea text
- The last selected repo is remembered for next time
