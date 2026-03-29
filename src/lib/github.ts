import { Octokit } from "@octokit/rest";
import { categorizeLabelSet, LabelSet, Repo, SimilarIssue } from "./types";

function makeOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function getRepos(token: string, org: string): Promise<Repo[]> {
  const octokit = makeOctokit(token);

  // Try as org first, fall back to user
  let items: Array<{ name: string; full_name: string; description: string | null }> = [];
  try {
    const resp = await octokit.repos.listForOrg({ org, per_page: 100, sort: "updated" });
    items = resp.data;
  } catch {
    const resp = await octokit.repos.listForUser({ username: org, per_page: 100, sort: "updated" });
    items = resp.data;
  }

  return items.map((r) => ({
    name: r.name,
    fullName: r.full_name,
    description: r.description ?? "No description",
  }));
}

export async function getRepo(token: string, fullName: string): Promise<Repo> {
  const octokit = makeOctokit(token);
  const [owner, repo] = fullName.split("/");
  const resp = await octokit.repos.get({ owner, repo });
  return {
    name: resp.data.name,
    fullName: resp.data.full_name,
    description: resp.data.description ?? "No description",
  };
}

export async function getRepoLabels(token: string, repoFullName: string): Promise<LabelSet> {
  const octokit = makeOctokit(token);
  const [owner, repoName] = repoFullName.split("/");
  const resp = await octokit.issues.listLabelsForRepo({ owner, repo: repoName, per_page: 100 });
  return categorizeLabelSet(resp.data.map((l) => l.name));
}

export async function getOpenIssues(token: string, repo: Repo, limit = 20): Promise<string[]> {
  const octokit = makeOctokit(token);
  const [owner, repoName] = repo.fullName.split("/");
  const resp = await octokit.issues.listForRepo({
    owner,
    repo: repoName,
    state: "open",
    per_page: limit,
  });
  return resp.data.map((i) => `#${i.number} ${i.title}`);
}

export async function searchSimilar(token: string, repo: Repo, keywords: string, limit = 5): Promise<SimilarIssue[]> {
  const octokit = makeOctokit(token);
  const q = `${keywords} repo:${repo.fullName} is:issue`;
  try {
    const resp = await octokit.search.issuesAndPullRequests({ q, per_page: limit });
    return resp.data.items.map((i) => ({
      number: i.number,
      title: i.title,
      url: i.html_url,
    }));
  } catch {
    return [];
  }
}

export interface CreatedIssue {
  number: number;
  url: string;
}

export async function createIssue(
  token: string,
  repo: Repo,
  title: string,
  body: string,
  labels: string[]
): Promise<CreatedIssue> {
  const octokit = makeOctokit(token);
  const [owner, repoName] = repo.fullName.split("/");
  const resp = await octokit.issues.create({
    owner,
    repo: repoName,
    title,
    body,
    labels,
  });
  return { number: resp.data.number, url: resp.data.html_url };
}
