import { GitHubIssue } from "./types";

interface OllamaGenerateResponse {
  response: string;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaTagsResponse {
  models: Array<{ name: string }>;
}

export interface GenerateStats {
  tokens: number;
  durationSec: number;
  tokensPerSec: number;
  model: string;
}

const MAX_INPUT_LENGTH = 1000;
const GENERATE_TIMEOUT_MS = 120_000;

function sanitizeInput(text: string): string {
  if (text.length > MAX_INPUT_LENGTH) {
    text = text.slice(0, MAX_INPUT_LENGTH) + "...";
  }
  return text.replace(/\s+/g, " ").trim();
}

export async function getAvailableModel(
  primaryModel: string,
  fallbackModel: string,
  ollamaUrl: string
): Promise<string> {
  try {
    const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return primaryModel;
    const data = (await resp.json()) as OllamaTagsResponse;
    const names = data.models.map((m) => m.name);

    for (const preferred of [primaryModel, fallbackModel]) {
      const base = preferred.split(":")[0];
      if (names.includes(preferred) || names.some((n) => n.startsWith(base))) {
        return preferred;
      }
    }
    return names[0] ?? primaryModel;
  } catch {
    return primaryModel;
  }
}

export interface GenerateResult {
  issue: GitHubIssue | null;
  duplicateOf: number | null;
  stats: GenerateStats;
}

export async function generateIssue(prompt: string, model: string, ollamaUrl: string): Promise<GenerateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  let raw: OllamaGenerateResponse;
  try {
    const resp = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0, num_predict: 2048 },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Ollama returned ${resp.status}: ${text}`);
    }
    raw = (await resp.json()) as OllamaGenerateResponse;
  } finally {
    clearTimeout(timer);
  }

  const evalCount = raw.eval_count ?? 0;
  const evalDurationSec = (raw.eval_duration ?? 0) / 1e9;
  const stats: GenerateStats = {
    tokens: evalCount,
    durationSec: evalDurationSec,
    tokensPerSec: evalDurationSec > 0 ? evalCount / evalDurationSec : 0,
    model,
  };

  const content = raw.response?.trim();
  if (!content) throw new Error("Ollama returned empty response");

  // Check for duplicate
  if (content.startsWith("DUPLICATE:#")) {
    const num = parseInt(content.split("#")[1]?.trim() ?? "", 10);
    if (isNaN(num)) throw new Error(`Invalid duplicate format: ${content}`);
    return { issue: null, duplicateOf: num, stats };
  }

  return { issue: parseIssueResponse(content), duplicateOf: null, stats };
}

function parseIssueResponse(content: string): GitHubIssue {
  if (!content.includes("---TITLE---") || !content.includes("---BODY---")) {
    throw new Error(
      `AI response missing required delimiters (---TITLE---, ---BODY---)\n\nActual response: ${content.slice(0, 200)}`
    );
  }

  const titleStart = content.indexOf("---TITLE---") + "---TITLE---".length;
  const titleEnd = content.indexOf("---BODY---");
  const title = content.slice(titleStart, titleEnd).trim();

  const bodyStart = content.indexOf("---BODY---") + "---BODY---".length;
  const bodyEnd = content.includes("---END---") ? content.indexOf("---END---") : content.length;
  const body = content.slice(bodyStart, bodyEnd).trim();

  // Parse body sections
  let summary = "";
  let details = "";
  const acceptanceCriteria: string[] = [];

  if (body.includes("## Summary")) {
    const start = body.indexOf("## Summary") + "## Summary".length;
    const end = body.includes("## Details") ? body.indexOf("## Details") : body.length;
    summary = body.slice(start, end).trim();
  }

  if (body.includes("## Details")) {
    const start = body.indexOf("## Details") + "## Details".length;
    const end = body.includes("## Acceptance Criteria") ? body.indexOf("## Acceptance Criteria") : body.length;
    details = body.slice(start, end).trim();
  }

  if (body.includes("## Acceptance Criteria")) {
    const start = body.indexOf("## Acceptance Criteria") + "## Acceptance Criteria".length;
    const section = body.slice(start).trim();
    for (const line of section.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- [ ]") || trimmed.startsWith("-[ ]")) {
        const criterion = trimmed.replace(/^-\s*\[\s*\]\s*/, "").trim();
        if (criterion) acceptanceCriteria.push(criterion);
      }
    }
  }

  // Parse labels section
  let typeLabel: string | undefined;
  let priorityLabel: string | undefined;
  let sizeLabel: string | undefined;

  if (content.includes("---LABELS---") && content.includes("---LABELS-END---")) {
    const lStart = content.indexOf("---LABELS---") + "---LABELS---".length;
    const lEnd = content.indexOf("---LABELS-END---");
    const labelsSection = content.slice(lStart, lEnd).trim();
    for (const line of labelsSection.split("\n")) {
      const t = line.trim();
      if (t.startsWith("type:")) typeLabel = t.slice("type:".length).trim();
      else if (t.startsWith("priority:")) priorityLabel = t.slice("priority:".length).trim();
      else if (t.startsWith("size:")) sizeLabel = t.slice("size:".length).trim();
    }
  }

  if (!title) throw new Error("AI response missing title");
  if (!summary) throw new Error("AI response missing summary");

  return {
    title,
    summary,
    details: details || summary,
    acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : ["Implementation complete"],
    typeLabel,
    priorityLabel,
    sizeLabel,
  };
}

export { sanitizeInput };
