import {
  Action,
  ActionPanel,
  Detail,
  Form,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { createSmartIssue } from "./lib/core";
import { getRepoLabels, getRepos } from "./lib/github";
import { CreateResult, LabelSet, Repo } from "./lib/types";

interface Prefs {
  githubToken: string;
  githubOrg: string;
  ollamaUrl: string;
  model: string;
  fallbackModel: string;
}

const PRIORITIES = [
  { value: "", label: "Auto (AI decides)" },
  { value: "priority:critical", label: "Critical" },
  { value: "priority:high", label: "High" },
  { value: "priority:medium", label: "Medium" },
  { value: "priority:low", label: "Low" },
];

export default function CreateIssueCommand() {
  const prefs = getPreferenceValues<Prefs>();
  const { push } = useNavigation();

  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);
  const [labelSet, setLabelSet] = useState<LabelSet | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const fetched = await getRepos(prefs.githubToken, prefs.githubOrg);
        setRepos(fetched);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setReposError(msg);
      } finally {
        setReposLoading(false);
      }
    }
    load();
  }, [prefs.githubToken, prefs.githubOrg]);

  async function handleRepoChange(repoFullName: string) {
    if (!repoFullName) {
      setLabelSet(null);
      return;
    }
    const repoName = repoFullName.split("/")[1];
    try {
      const labels = await getRepoLabels(prefs.githubToken, {
        name: repoName,
        fullName: repoFullName,
        description: "",
      });
      setLabelSet(labels);
    } catch {
      setLabelSet(null);
    }
  }

  async function handleSubmit(values: { repo: string; type: string; priority: string; size: string; idea: string }) {
    if (!values.repo) {
      await showToast({ style: Toast.Style.Failure, title: "Select a repository" });
      return;
    }
    if (!values.idea.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Enter an idea" });
      return;
    }

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Creating Smart Issue",
      message: "Connecting to GitHub...",
    });

    const result = await createSmartIssue(
      {
        repoFullName: values.repo,
        idea: values.idea,
        priorityHint: values.priority || undefined,
        typeHint: values.type || undefined,
        sizeHint: values.size || undefined,
        onStatus: (msg) => {
          toast.message = msg;
        },
      },
      {
        githubToken: prefs.githubToken,
        ollamaUrl: prefs.ollamaUrl || "http://localhost:11434",
        model: prefs.model || "mlx-community/Qwen3.5-27B-4bit",
        fallbackModel: prefs.fallbackModel || "",
      }
    );

    if (result.success) {
      await toast.hide();
      push(<IssueSuccessDetail result={result} repoFullName={values.repo} />);
    } else if (result.duplicateOf) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Duplicate Issue Detected",
        message: `This appears to be a duplicate of #${result.duplicateOf}`,
      });
    } else {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Create Issue",
        message: result.error ?? "Unknown error",
      });
    }
  }

  if (reposError) {
    return (
      <Detail
        markdown={`## Failed to Load Repositories\n\n${reposError}\n\nCheck your GitHub token and organization in preferences.`}
        actions={
          <ActionPanel>
            <Action title="Open Preferences" onAction={openExtensionPreferences} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Form
      isLoading={reposLoading}
      enableDrafts
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Issue" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="repo" title="Repository" storeValue onChange={handleRepoChange}>
        {repos.map((r) => (
          <Form.Dropdown.Item key={r.fullName} value={r.fullName} title={r.name} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="type" title="Type" storeValue>
        <Form.Dropdown.Item key="" value="" title="Auto (AI decides)" />
        {(labelSet?.typeLabels ?? []).map((l) => (
          <Form.Dropdown.Item key={l} value={l} title={l} />
        ))}
      </Form.Dropdown>

      <Form.Dropdown id="priority" title="Priority" storeValue>
        <Form.Dropdown.Item key="" value="" title="Auto (AI decides)" />
        {(labelSet?.priorityLabels ?? PRIORITIES.slice(1)).map((p) => {
          const val = typeof p === "string" ? p : p.value;
          const label = typeof p === "string" ? p : p.label;
          return <Form.Dropdown.Item key={val} value={val} title={label} />;
        })}
      </Form.Dropdown>

      <Form.Dropdown id="size" title="Size" storeValue>
        <Form.Dropdown.Item key="" value="" title="Auto (AI decides)" />
        {(labelSet?.sizeLabels ?? []).map((l) => (
          <Form.Dropdown.Item key={l} value={l} title={l} />
        ))}
      </Form.Dropdown>

      <Form.TextArea
        id="idea"
        title="Idea"
        placeholder="Brief description of the issue (supports feat:, fix:, docs: prefixes)"
        enableMarkdown={false}
      />
    </Form>
  );
}

function IssueSuccessDetail({ result, repoFullName }: { result: CreateResult; repoFullName: string }) {
  const similarSection =
    result.similar && result.similar.length > 0
      ? `\n## Similar Issues\n${result.similar.map((s) => `- [#${s.number} ${s.title}](${s.url})`).join("\n")}`
      : "";

  const markdown = `# Issue #${result.issueNumber} Created

**${result.title}**

${result.summary ?? ""}
${similarSection}`;

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Repository" text={repoFullName} />
          <Detail.Metadata.Label title="Issue" text={`#${result.issueNumber}`} />
          {result.model && <Detail.Metadata.Label title="Model" text={result.model} />}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Link title="Open Issue" target={result.url ?? ""} text="GitHub" />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open in Browser" url={result.url ?? ""} />
          <Action.CopyToClipboard title="Copy URL" content={result.url ?? ""} />
        </ActionPanel>
      }
    />
  );
}
