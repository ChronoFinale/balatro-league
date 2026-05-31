# Wire up the in-app feedback form

The `/me` page has a "Report a bug / suggest a feature" form. Submissions create issues on a public GitHub repo via a bot-owned token, so players don't need GitHub accounts.

## One-time setup

### 1. Create the public feedback repo

Anywhere on GitHub:

- New repo → public → name it something like `balatro-league-feedback`
- No README needed; the Issues tab is the whole point
- (Optional) Add issue templates under `.github/ISSUE_TEMPLATE/` for "Bug" and "Feature request"

### 2. Generate a fine-grained PAT scoped to that repo

GitHub → Settings (your account, not the repo) → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token

- **Token name**: `balatro-league-website-feedback`
- **Expiration**: 1 year (set a calendar reminder to rotate)
- **Repository access**: "Only select repositories" → pick the feedback repo
- **Permissions** → Repository permissions → **Issues: Read and write** (that's the only one needed; everything else stays at "no access")
- Generate, **copy the token immediately** (you can't view it again)

### 3. Set Railway env vars on the **web service**

| Variable | Value |
|---|---|
| `GITHUB_FEEDBACK_OWNER` | Your GitHub username or org name (the part before `/` in the repo URL) |
| `GITHUB_FEEDBACK_REPO`  | The repo name (e.g. `balatro-league-feedback`) |
| `GITHUB_FEEDBACK_TOKEN` | The fine-grained PAT you just generated |

Save. Railway redeploys.

### 4. Test

Open `https://www.balatroleague.com/me` → fill the form → submit. You should:
- See a green "✓ Filed — view on GitHub" link in the form
- See the issue appear on your feedback repo with a `from-website` label, signed with your Discord username

If you get a red error message, the env vars are misconfigured. The exact GitHub API error is shown so you can debug.

## Rotating the token

When the PAT expires (or if it leaks), generate a fresh one, update `GITHUB_FEEDBACK_TOKEN` on Railway, redeploy. No code change needed.
