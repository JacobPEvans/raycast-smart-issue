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

export function buildPrompt(ctx: PromptContext): { system: string; user: string } {
  const system = `You are a GitHub issue writer. Create well-structured issues from brief ideas. Respond directly with the specified format — no preamble, reasoning, or thinking.`;

  const similarText = ctx.similar.length > 0 ? ctx.similar.map((s) => `- #${s.number} ${s.title}`).join("\n") : "None";
  const openText = ctx.openIssues.slice(0, 15).join("\n") || "None";

  let labelsBlock = "";
  if (
    ctx.labelSet.typeLabels.length > 0 ||
    ctx.labelSet.priorityLabels.length > 0 ||
    ctx.labelSet.sizeLabels.length > 0
  ) {
    const lines: string[] = ["Choose exactly ONE from each category that applies:"];
    if (ctx.labelSet.typeLabels.length > 0) lines.push(`  Type: ${ctx.labelSet.typeLabels.join(", ")}`);
    if (ctx.labelSet.priorityLabels.length > 0) lines.push(`  Priority: ${ctx.labelSet.priorityLabels.join(", ")}`);
    if (ctx.labelSet.sizeLabels.length > 0) lines.push(`  Size: ${ctx.labelSet.sizeLabels.join(", ")}`);
    labelsBlock = `<labels>\n${lines.join("\n")}\n</labels>\n\n`;
  }

  const hints: string[] = [];
  if (ctx.typeHint) hints.push(`User prefers ${ctx.typeHint} (override if inappropriate)`);
  if (ctx.priorityHint) hints.push(`User hints at ${ctx.priorityHint} (override if needed)`);
  if (ctx.sizeHint) hints.push(`User suggests ${ctx.sizeHint} (override if inaccurate)`);
  const prefsBlock =
    hints.length > 0 ? `<preferences>\n${hints.map((h) => `- ${h}`).join("\n")}\n</preferences>\n\n` : "";

  const labelInstructions =
    labelsBlock.length > 0
      ? `\nAfter ---END---, add label suggestions:\n---LABELS---\ntype:<label>\npriority:<label>\nsize:<label>\n---LABELS-END---`
      : "";

  const user = `<context>
<repository>${ctx.repo.name}: ${ctx.repo.description}</repository>
<open_issues>
${openText}
</open_issues>
<similar_issues>
${similarText}
</similar_issues>
</context>

${labelsBlock}${prefsBlock}<format>
If a similar issue fully covers this idea, respond ONLY: DUPLICATE:#<number>
Otherwise output EXACTLY:
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
---END---${labelInstructions}
</format>

<example>
---TITLE---
Add retry logic for failed webhook deliveries
---BODY---
## Summary
Webhook deliveries currently fail silently with no retry, causing missed events when downstream services are temporarily unavailable.

## Details
Implement exponential backoff retry with configurable max attempts. Failed deliveries should be logged and eventually dead-lettered for manual inspection.

## Acceptance Criteria
- [ ] Failed webhooks retry up to 3 times with exponential backoff (1s, 2s, 4s)
- [ ] All retry attempts are logged with attempt number and error
- [ ] Permanently failed deliveries are written to a dead letter queue
---END---
---LABELS---
type:feature
priority:medium
size:m
---LABELS-END---
</example>

<idea_parsing>
Map conventional commit prefixes to types: feat: → type:feature, fix: → type:bug, docs: → type:docs, chore: → type:chore, refactor: → type:refactor, test: → type:test, perf: → type:perf, ci: → type:ci
Extract inline hints like "size:s", "priority:high" from the idea text.
Strip these prefixes from the title — they are metadata only.
</idea_parsing>

IDEA: ${ctx.idea}`;

  return { system, user };
}
