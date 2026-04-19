import { GitHubIssue } from "./types";

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface ModelsResponse {
  data: Array<{ id: string }>;
}

interface RunningResponse {
  running: Array<{ model: string; state: string }>;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  loaded: boolean;
}

export interface GenerateStats {
  tokens: number;
  durationSec: number;
  tokensPerSec: number;
  model: string;
}

const MAX_INPUT_LENGTH = 1000;
const GENERATE_TIMEOUT_MS = 180_000;

function sanitizeInput(text: string): string {
  if (text.length > MAX_INPUT_LENGTH) {
    text = text.slice(0, MAX_INPUT_LENGTH) + "...";
  }
  return text.replace(/\s+/g, " ").trim();
}

async function fetchReadyModelId(llmUrl: string): Promise<string> {
  const resp = await fetch(`${llmUrl}/running`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!resp?.ok) return "";
  const data = (await resp.json()) as RunningResponse;
  return data.running.find((m) => m.state === "ready")?.model ?? "";
}

/** Fetch all available models and identify which one is currently loaded. */
export async function fetchModels(llmUrl: string): Promise<ModelInfo[]> {
  const [modelsResp, loadedModelId] = await Promise.all([
    fetch(`${llmUrl}/v1/models`, { signal: AbortSignal.timeout(5000) }),
    fetchReadyModelId(llmUrl),
  ]);

  if (!modelsResp.ok) throw new Error(`LLM server returned ${modelsResp.status} on /v1/models`);
  const modelsData = (await modelsResp.json()) as ModelsResponse;

  const models: ModelInfo[] = modelsData.data.map((m) => ({
    id: m.id,
    displayName: m.id.replace(/^mlx-community\//, ""),
    loaded: m.id === loadedModelId,
  }));

  // Sort: loaded model first, rest alphabetically
  models.sort((a, b) => {
    if (a.loaded) return -1;
    if (b.loaded) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return models;
}

/** Resolve the model to use: explicit selection or currently loaded model. */
export async function resolveModel(model: string | undefined, llmUrl: string): Promise<string> {
  if (model) return model;
  const [loadedModelId, modelsResp] = await Promise.all([
    fetchReadyModelId(llmUrl),
    fetch(`${llmUrl}/v1/models`, { signal: AbortSignal.timeout(5000) }).catch(() => null),
  ]);
  if (loadedModelId) return loadedModelId;
  if (modelsResp?.ok) {
    const data = (await modelsResp.json()) as ModelsResponse;
    if (data.data[0]?.id) return data.data[0].id;
  }
  return "";
}

export interface GenerateResult {
  issue: GitHubIssue | null;
  duplicateOf: number | null;
  stats: GenerateStats;
}

export async function generateIssue(
  messages: { system: string; user: string },
  model: string,
  llmUrl: string
): Promise<GenerateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  const startTime = Date.now();
  let raw: ChatCompletionResponse;
  try {
    const resp = await fetch(`${llmUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: messages.system },
          { role: "user", content: messages.user },
        ],
        temperature: 0,
        max_tokens: 4096,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`LLM server returned ${resp.status}: ${text}`);
    }
    raw = (await resp.json()) as ChatCompletionResponse;
  } finally {
    clearTimeout(timer);
  }

  const durationSec = (Date.now() - startTime) / 1000;
  const tokenCount = raw.usage?.completion_tokens ?? 0;
  const stats: GenerateStats = {
    tokens: tokenCount,
    durationSec,
    tokensPerSec: durationSec > 0 ? tokenCount / durationSec : 0,
    model,
  };

  const content = raw.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("LLM server returned empty response");

  // DUPLICATE check — search anywhere in content since models may add preamble
  const dupIdx = content.lastIndexOf("DUPLICATE:#");
  if (dupIdx !== -1) {
    // Make sure this is a standalone DUPLICATE response, not a mention in the body
    const afterDup = content.slice(dupIdx + "DUPLICATE:#".length);
    const num = parseInt(afterDup.trim().split(/\s/)[0] ?? "", 10);
    if (!isNaN(num)) {
      return { issue: null, duplicateOf: num, stats };
    }
  }

  return { issue: parseIssueResponse(content), duplicateOf: null, stats };
}

function parseIssueResponse(content: string): GitHubIssue {
  if (!content.includes("---TITLE---") || !content.includes("---BODY---")) {
    throw new Error(
      `AI response missing required delimiters (---TITLE---, ---BODY---)\n\nActual response: ${content.slice(0, 200)}`
    );
  }

  // Use lastIndexOf: models often echo delimiters in their reasoning before producing the real output
  const titleStart = content.lastIndexOf("---TITLE---") + "---TITLE---".length;
  const titleEnd = content.lastIndexOf("---BODY---");
  const title = content.slice(titleStart, titleEnd).trim();

  const bodyStart = content.lastIndexOf("---BODY---") + "---BODY---".length;
  const endIdx = content.lastIndexOf("---END---");
  const bodyEnd = endIdx !== -1 ? endIdx : content.length;
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

  // Parse labels section — use last occurrence in case model echoed the format
  let typeLabel: string | undefined;
  let priorityLabel: string | undefined;
  let sizeLabel: string | undefined;

  const labelsStart = content.lastIndexOf("---LABELS---");
  const labelsEnd = content.lastIndexOf("---LABELS-END---");
  if (labelsStart !== -1 && labelsEnd !== -1 && labelsEnd > labelsStart) {
    const labelsSection = content.slice(labelsStart + "---LABELS---".length, labelsEnd).trim();
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
