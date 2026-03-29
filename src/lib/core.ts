import { generateIssue, GenerateStats, getAvailableModel, sanitizeInput } from "./llm";
import { createIssue, getOpenIssues, getRepo, getRepoLabels, searchSimilar } from "./github";
import { buildPrompt } from "./prompt";
import { CreateResult, getSuggestedLabels, issueToMarkdown, LabelSet, Repo } from "./types";

export interface CorePreferences {
  githubToken: string;
  llmUrl: string;
  model: string;
  fallbackModel: string;
}

export interface CoreInput {
  repoFullName: string;
  idea: string;
  priorityHint?: string;
  typeHint?: string;
  sizeHint?: string;
  cachedLabelSet?: LabelSet;
  onStatus?: (message: string) => void;
}

export async function createSmartIssue(input: CoreInput, prefs: CorePreferences): Promise<CreateResult> {
  const status = input.onStatus ?? (() => undefined);

  status(`Connecting to ${input.repoFullName}...`);
  let repo: Repo;
  try {
    repo = await getRepo(prefs.githubToken, input.repoFullName);
  } catch (err) {
    return { success: false, error: formatError(err, "github") };
  }

  // Fetch context in parallel — these are independent
  status("Fetching context...");
  const keywords = input.idea.replace(/\W+/g, " ").trim().slice(0, 100);
  const emptyLabelSet: LabelSet = { typeLabels: [], priorityLabels: [], sizeLabels: [], aiLabels: [], otherLabels: [] };

  const [openIssues, labelSet, similar, model] = await Promise.all([
    getOpenIssues(prefs.githubToken, repo).catch(() => [] as string[]),
    input.cachedLabelSet
      ? Promise.resolve(input.cachedLabelSet)
      : getRepoLabels(prefs.githubToken, repo.fullName).catch(() => emptyLabelSet),
    searchSimilar(prefs.githubToken, repo, keywords).catch(() => []),
    getAvailableModel(prefs.model, prefs.fallbackModel, prefs.llmUrl),
  ]);

  status("Generating issue with AI...");
  const idea = sanitizeInput(input.idea);
  const prompt = buildPrompt({
    idea,
    repo,
    openIssues,
    similar,
    labelSet,
    priorityHint: input.priorityHint,
    typeHint: input.typeHint,
    sizeHint: input.sizeHint,
  });

  let result: Awaited<ReturnType<typeof generateIssue>>;
  try {
    result = await generateIssue(prompt, model, prefs.llmUrl);
  } catch (err) {
    return { success: false, error: formatError(err, "llm") };
  }

  if (result.duplicateOf !== null) {
    return { success: false, duplicateOf: result.duplicateOf, error: `Duplicate of #${result.duplicateOf}` };
  }

  if (!result.issue) {
    return { success: false, error: "AI did not return an issue" };
  }

  const issue = result.issue;
  const stats: GenerateStats = result.stats;

  // Resolve final labels
  const allValid = [
    ...labelSet.typeLabels,
    ...labelSet.priorityLabels,
    ...labelSet.sizeLabels,
    ...labelSet.aiLabels,
    ...labelSet.otherLabels,
  ];
  const suggested = getSuggestedLabels(issue).filter((l) => allValid.includes(l));

  // Always add ai:ready if available
  if (labelSet.aiLabels.includes("ai:ready") && !suggested.includes("ai:ready")) {
    suggested.push("ai:ready");
  } else if (allValid.includes("human reviewed") && !suggested.includes("human reviewed")) {
    suggested.push("human reviewed");
  }

  status(`Creating issue with labels: ${suggested.join(", ") || "none"}...`);
  let created: Awaited<ReturnType<typeof createIssue>>;
  try {
    created = await createIssue(prefs.githubToken, repo, issue.title, issueToMarkdown(issue), suggested);
  } catch (err) {
    return { success: false, error: formatError(err, "github") };
  }

  return {
    success: true,
    issueNumber: created.number,
    url: created.url,
    title: issue.title,
    summary: issue.summary,
    model: `${model} (${stats.tokensPerSec.toFixed(1)} tok/s)`,
    similar,
  };
}

function formatError(err: unknown, context: "github" | "llm"): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (context === "llm") {
    return `${msg}\n\nTip: Ensure vllm-mlx is running (check: launchctl list | grep vllm-mlx)`;
  }
  if (context === "github") {
    if (msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("401")) {
      return `${msg}\n\nTip: Check your GitHub token in Raycast preferences`;
    }
    return msg;
  }
  return msg;
}
