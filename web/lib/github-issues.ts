// Thin GitHub REST wrapper for filing feedback issues on behalf of users.
// Players hit a form on /me; the server uses a bot-owned PAT to create the
// issue, so players don't need GitHub accounts.
//
// Required env vars:
//   GITHUB_FEEDBACK_OWNER  - GitHub user or org (e.g. "ChronoFinale")
//   GITHUB_FEEDBACK_REPO   - repo name (e.g. "balatro-league-feedback")
//   GITHUB_FEEDBACK_TOKEN  - PAT with repo scope on that repo (use a fine-
//                            grained token limited to just that repo with
//                            'Issues: read+write')

export interface CreateIssueInput {
  title: string;
  body: string;
  labels?: string[];
}

export interface CreateIssueResult {
  ok: true;
  url: string;
  number: number;
}
export interface CreateIssueError {
  ok: false;
  reason: string;
}

export async function createFeedbackIssue(input: CreateIssueInput): Promise<CreateIssueResult | CreateIssueError> {
  const owner = process.env.GITHUB_FEEDBACK_OWNER;
  const repo = process.env.GITHUB_FEEDBACK_REPO;
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!owner || !repo || !token) {
    return { ok: false, reason: "Feedback isn't configured (missing GITHUB_FEEDBACK_* env vars). Ping the league admin." };
  }
  if (!input.title.trim()) return { ok: false, reason: "Title is required." };
  if (!input.body.trim()) return { ok: false, reason: "Description is required." };

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title.slice(0, 200),
      body: input.body,
      labels: input.labels,
    }),
  });
  if (!res.ok) {
    return { ok: false, reason: `GitHub ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }
  const data = (await res.json()) as { html_url?: string; number?: number };
  if (!data.html_url || data.number === undefined) {
    return { ok: false, reason: "GitHub returned an unexpected response." };
  }
  return { ok: true, url: data.html_url, number: data.number };
}
