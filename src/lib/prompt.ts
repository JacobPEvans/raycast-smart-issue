import { LabelSet, Repo, SimilarIssue } from "./types";

export interface PromptContext {
  idea: string;
  repo: Repo;
  openIssues: string[];
  similar: SimilarIssue[];
  labelSet: LabelSet;
  priorityHint?: string;
  typeHint?: string;
  sizeHint?: string;
}

export function buildPrompt(ctx: PromptContext): string {
  const similarText = ctx.similar.length > 0 ? ctx.similar.map((s) => `- #${s.number} ${s.title}`).join("\n") : "None";
  const openText = ctx.openIssues.slice(0, 15).join("\n") || "None";
  const repoInfo = `${ctx.repo.name}: ${ctx.repo.description}`;

  let labelGuidance = "";
  if (
    ctx.labelSet.typeLabels.length > 0 ||
    ctx.labelSet.priorityLabels.length > 0 ||
    ctx.labelSet.sizeLabels.length > 0
  ) {
    labelGuidance = "\nAVAILABLE LABELS (choose exactly ONE from each category that has labels):\n";
    if (ctx.labelSet.typeLabels.length > 0) {
      labelGuidance += `  Type: ${ctx.labelSet.typeLabels.join(", ")}\n`;
    }
    if (ctx.labelSet.priorityLabels.length > 0) {
      labelGuidance += `  Priority: ${ctx.labelSet.priorityLabels.join(", ")}\n`;
    }
    if (ctx.labelSet.sizeLabels.length > 0) {
      labelGuidance += `  Size: ${ctx.labelSet.sizeLabels.join(", ")}\n`;
    }
  }

  let preferenceHints = "";
  const hints: string[] = [];
  if (ctx.typeHint) hints.push(`User prefers ${ctx.typeHint} (but override if inappropriate)`);
  if (ctx.priorityHint) hints.push(`User hints at ${ctx.priorityHint} (but override if needed)`);
  if (ctx.sizeHint) hints.push(`User suggests ${ctx.sizeHint} (but override if inaccurate)`);
  if (hints.length > 0) {
    preferenceHints = `\nUSER PREFERENCES (you can override with reasoning):\n${hints.map((h) => `  - ${h}`).join("\n")}\n`;
  }

  const ideaParsingInstructions = `
IDEA TEXT PARSING:
If the user's idea starts with conventional commit prefixes, map them to types:
  - feat: → type:feature, fix: → type:bug, docs: → type:docs
  - chore: → type:chore, refactor: → type:refactor, test: → type:test
  - perf: → type:perf, ci: → type:ci, breaking: → type:breaking

If the idea contains hints like "size:s", "priority:high", extract and use them.

When creating the title/description, strip these prefixes - they're metadata.
`;

  const labelInstruction =
    labelGuidance.length > 0
      ? `
After ---END---, optionally add label suggestions (one per line):
---LABELS---
type:<label>
priority:<label>
size:<label>
---LABELS-END---`
      : "";

  return `You are a GitHub issue writer. Create a well-structured issue from this idea.

IDEA: ${ctx.idea}

REPOSITORY: ${repoInfo}

OPEN ISSUES:
${openText}

SIMILAR ISSUES:
${similarText}
${labelGuidance}${preferenceHints}${ideaParsingInstructions}
Instructions:
1. If a similar issue fully covers this idea, respond ONLY: DUPLICATE:#<number>
2. Otherwise, output EXACTLY this format (no extra text):
---TITLE---
<concise title, max 80 chars>
---BODY---
## Summary
<1-2 sentence description>

## Details
<expanded context and implementation notes>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>
---END---${labelInstruction}`;
}
