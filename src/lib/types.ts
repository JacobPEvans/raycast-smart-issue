export interface GitHubIssue {
  title: string;
  summary: string;
  details: string;
  acceptanceCriteria: string[];
  typeLabel?: string;
  priorityLabel?: string;
  sizeLabel?: string;
}

export function issueToMarkdown(issue: GitHubIssue): string {
  const criteria = issue.acceptanceCriteria.map((c) => `- [ ] ${c}`).join("\n");
  return `## Summary\n${issue.summary}\n\n## Details\n${issue.details}\n\n## Acceptance Criteria\n${criteria}\n`;
}

export function getSuggestedLabels(issue: GitHubIssue): string[] {
  const labels: string[] = [];
  if (issue.typeLabel) labels.push(issue.typeLabel);
  if (issue.priorityLabel) labels.push(issue.priorityLabel);
  if (issue.sizeLabel) labels.push(issue.sizeLabel);
  return labels;
}

export interface LabelSet {
  typeLabels: string[];
  priorityLabels: string[];
  sizeLabels: string[];
  aiLabels: string[];
  otherLabels: string[];
}

export function categorizeLabelSet(labelNames: string[]): LabelSet {
  const typeLabels = labelNames.filter((n) => n.startsWith("type:"));
  const priorityLabels = labelNames.filter((n) => n.startsWith("priority:"));
  const sizeLabels = labelNames.filter((n) => n.startsWith("size:"));
  const aiLabels = labelNames.filter((n) => n.startsWith("ai:"));
  const prefixes = ["type:", "priority:", "size:", "ai:"];
  const otherLabels = labelNames.filter((n) => !prefixes.some((p) => n.startsWith(p)));
  return { typeLabels, priorityLabels, sizeLabels, aiLabels, otherLabels };
}

export interface Repo {
  name: string;
  fullName: string;
  description: string;
}

export interface SimilarIssue {
  number: number;
  title: string;
  url: string;
}

export interface CreateResult {
  success: boolean;
  issueNumber?: number;
  url?: string;
  title?: string;
  summary?: string;
  model?: string;
  similar?: SimilarIssue[];
  duplicateOf?: number;
  error?: string;
}

export interface Preferences {
  githubToken: string;
  githubOrg: string;
  ollamaUrl: string;
  model: string;
  fallbackModel: string;
}
