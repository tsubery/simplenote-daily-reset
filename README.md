# Simplenote daily checklist reset

This tiny scheduled job finds the **one active Simplenote note tagged `daily-reset`** and changes checked Markdown tasks to unchecked tasks inside every `Daily` section.

It uses Automattic's official [`@automattic/simplenote-mcp`](https://github.com/Automattic/simplenote-mcp) package for authentication and networking. The token is stored as a GitHub Actions secret, never in the repository.

## What gets reset

```markdown
# Daily
- [x] Exercise       <!-- becomes - [ ] Exercise -->
- [X] Vitamins       <!-- becomes - [ ] Vitamins -->
- [ ] Read           <!-- unchanged -->

## Morning
- [x] Review inbox   <!-- also reset: nested under Daily -->

# Other
- [x] Renew passport <!-- unchanged -->
```

A `Daily` section begins at a Markdown heading named `Daily` (case-insensitive) and ends at the next heading of the same or higher level. Nested subsections remain part of it. Other sections are untouched.

For safety, the job fails without changing anything if zero or more than one active note has the `daily-reset` tag.

## 1. Prepare the note

1. Add the tag `daily-reset` to the note.
2. Put recurring tasks under a Markdown heading such as `# Daily` or `## Daily`.
3. Make sure no other active note has that tag.

## 2. Obtain a Simplenote token

You need Node.js 22 or newer locally for this one-time step:

```bash
npx -y @automattic/simplenote-mcp setup
```

Choose the API provider, complete the email-code login, and enable write mode. The setup stores the token locally:

- Linux: `~/.config/simplenote-mcp/auth.json`
- macOS: `~/Library/Application Support/simplenote-mcp/auth.json`
- Windows: `%APPDATA%\simplenote-mcp\auth.json`

Open `auth.json` and copy only the token value. Treat it like a password. Do not commit the file or token.

## 3. Add the GitHub secret

Create a GitHub repository containing these files. In its settings, go to **Secrets and variables → Actions → New repository secret** and create:

- Name: `SIMPLENOTE_TOKEN`
- Value: the token copied from `auth.json`

The workflow creates the non-secret Simplenote MCP configuration on each run.

## 4. Choose the reset time

The included workflow runs daily at **05:00 UTC**:

```yaml
- cron: '0 5 * * *'
```

GitHub schedules use UTC. Change that expression in `.github/workflows/daily-reset.yml` to your preferred time. Panama and Colombia use UTC−5 year-round, so `0 5 * * *` is midnight there.

GitHub may start scheduled workflows a few minutes late, especially around the top of the hour. If exact timing is unimportant, changing the minute to a less busy value such as `17 5 * * *` can reduce delays.

## 5. Test it

Run **Actions → Reset Simplenote daily checklist → Run workflow**. Check the workflow log and then the note. A successful run says how many tasks were reset. If no checked tasks exist under `Daily`, the job exits successfully without updating the note.

Run the unit tests locally with:

```bash
npm install
npm test
```

To run the real reset locally after completing Simplenote MCP setup:

```bash
export SIMPLENOTE_TOKEN='your-token'
npm run reset
```

Set `SIMPLENOTE_TAG` if you want a different tag:

```bash
SIMPLENOTE_TAG='another-tag' npm run reset
```

The GitHub workflow intentionally leaves the default as `daily-reset`.

## Security and maintenance

- The workflow has read-only repository permissions.
- Simplenote MCP telemetry is disabled in the scheduled run.
- `update_note` sends the complete note body, as required by Simplenote MCP.
- The dependency is pinned to version `2.0.1`; Dependabot or occasional manual updates can keep it current.
- If Simplenote rejects the token, repeat setup and replace the GitHub secret.
