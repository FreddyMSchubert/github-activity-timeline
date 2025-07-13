# 🛠️ GitHub Activity Timeline Action

Live-inject recent GitHub events into your README with a highly customizable JSON mapping.

> Here's how the setup looks like in action: [My Readme](https://github.com/FreddyMSchubert)

## 🚀 Quick Setup

### 1. Create workflow at `.github/workflows/activity-timeline.yml`:

```yml
name: Update Activity Timeline

on:
  workflow_dispatch:
    schedule:
      - cron: '0 \* \* \* \*' # Customize CRON run timing - like this it runs hourly

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Fetch & Render Activity
        uses: FreddyMSchubert/github-activity-timeline@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          username: "YourUser" # Insert your username here
          max_items: "5"
          event_templates: > # Customize what to display here
            { /* see "Configuration" below */ }

      - name: Commit & Push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add README.md && git diff --cached --quiet || git commit -m "chore: update activity"
      - uses: ad-m/github-push-action@v0.6.0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          branch: "main"
```

> If you don't want to dive deep into the customization opportunities, you can copy [my config](https://github.com/FreddyMSchubert/FreddyMSchubert/blob/main/.github/workflows/activity.yml).

### 2. Annotate your README where updates belong:

```
<!-- ACTIVITY:START -->
<!-- ACTIVITY:END -->
```

Don't put anything else between these markers as all of it will be replaced with the generated events list upon workflow run.

## ⚙️ Configuration: `event_templates`

> Provide a JSON object mapping event keys ↔ JS template strings.\
> Format: `{ "event_key": "Your string with {{placeholders}}", … }`.\
> Missing keys or empty strings ("") skip that event.

Example skeleton

```json
{
  "issues_opened": "...",
  "pr_merged": "...",
  "push": "..."
}
```

## 🗂️ Available Event Keys & Payload Properties

Use event_templates to map each event key to a JS template string.
Placeholders inside `{{…}}` (e.g. `{{payload.issue.number}}`) are replaced with real values from the GitHub event when the workflow runs.

Here are some usage examples for useful event keys:

---

#### `issues_opened`

- **Description**: New issue created.
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#issues](https://docs.github.com/en/webhooks/event-payloads#issues) 📑
- **Top Variables**:

  - `payload.issue.number` – Issue number 🔢
  - `payload.issue.title` – Issue title 🏷️
  - `payload.issue.html_url` – Link to the issue 🌐
  - `actor` – Who opened it 👤
  - ...

- **Example Template**:

  ```json
  "issues_opened": "{{index}}. 🐛 Opened [{{repo}}#{{payload.issue.number}}]({{payload.issue.html_url}}): “{{payload.issue.title.slice(0,50)}}…”"
  ```

- **Rendered Output**:

> 1. 🐛 Opened [octocat/Hello-World#42](https://github.com/octocat/Hello-World/issues/42): “Improve README examples…”

---

#### `issues_closed`

- **Description**: Issue closed (anyone).
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#issues](https://docs.github.com/en/webhooks/event-payloads#issues) 📑
- **Top Variables**:

  - `payload.issue.number` – Issue number 🔢
  - `payload.issue.html_url` – Link to the issue 🌐
  - `actor` – Who closed it 👤
  - ...

- **Example Template**:

  ```json
  "issues_closed": "{{index}}. ✅ Closed [{{repo}}#{{payload.issue.number}}]({{payload.issue.html_url}}) by {{actor}}"
  ```

- **Rendered Output**:

> 2. ✅ Closed [octocat/Hello-World#42](https://github.com/octocat/Hello-World/issues/42) by octocat

---

#### `issue_commented`

- **Description**: Comment added to an issue.
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#issue_comment](https://docs.github.com/en/webhooks/event-payloads#issue_comment) 📑
- **Top Variables**:

  - `payload.comment.body` – Comment text 💬
  - `payload.comment.html_url` – Link to the comment 🔗
  - `payload.issue.number` – Issue number 🔢
  - `actor` – Who commented 👤
  - ...

- **Example Template**:

  ```json
  "issue_commented": "{{index}}. 💬 {{actor}} commented on [{{repo}}#{{payload.issue.number}}]({{payload.comment.html_url}}): “{{payload.comment.body.slice(0,50)}}…”"
  ```

- **Rendered Output**:

> 3. 💬 octocat commented on [octocat/Hello-World#42](https://github.com/octocat/Hello-World/issues/42): “Looks good to me, but…”

---

#### `pr_opened`

- **Description**: Pull request opened.
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#pull_request](https://docs.github.com/en/webhooks/event-payloads#pull_request) 📑
- **Top Variables**:

  - `payload.pull_request.number` – PR number 🔢
  - `payload.pull_request.title` – PR title 🏷️
  - `payload.pull_request.html_url` – Link to the PR 🔗
  - `actor` – Who opened it 👤
  - ...

- **Example Template**:

  ```json
  "pr_opened": "{{index}}. 🆕 PR [{{repo}}#{{payload.pull_request.number}}]({{payload.pull_request.html_url}}) opened: “{{payload.pull_request.title.slice(0,50)}}…”"
  ```

- **Rendered Output**:

> 4. 🆕 PR [octocat/Hello-World#56](https://github.com/octocat/Hello-World/pull/56) opened: “Add CONTRIBUTING guide…”

---

#### `pr_closed` & `pr_merged`

- **Description**: PR closed, with or without merge.
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#pull_request](https://docs.github.com/en/webhooks/event-payloads#pull_request) 📑
- **Top Variables**:

  - `payload.pull_request.number` – PR number 🔢
  - `payload.pull_request.html_url` – Link to the PR 🔗
  - `actor` – Who performed the action 👤
  - `payload.pull_request.merged` – `true` if merged; `false` if just closed 🔄
  - ...

- **Example Template**:

  ```json
  "pr_closed": "{{index}}. {{payload.pull_request.merged ? '🎯 Merged' : '❌ Closed'}} PR [{{repo}}#{{payload.pull_request.number}}]({{payload.pull_request.html_url}}) by {{actor}}"
  ```

- **Rendered Output**:

> 5. 🎯 Merged PR [octocat/Hello-World#56](https://github.com/octocat/Hello-World/pull/56) by octocat

---

#### `pr_review_approved` & `pr_review_changes_requested`

- **Description**: Review approval or change request.
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#pull_request_review](https://docs.github.com/en/webhooks/event-payloads#pull_request_review) 📑
- **Top Variables**:

  - `payload.review.state` – `approved` or `changes_requested` 🔍
  - `payload.pull_request.number` – PR number 🔢
  - `actor` – Who reviewed 👤
  - ...

- **Example Template**:

  ```json
  "pr_review_approved": "{{index}}. 👍 {{actor}} approved PR [{{repo}}#{{payload.pull_request.number}}]({{payload.pull_request.html_url}})",
  "pr_review_changes_requested": "{{index}}. 🚩 {{actor}} requested changes on PR [{{repo}}#{{payload.pull_request.number}}]({{payload.pull_request.html_url}})"
  ```

- **Rendered Output**:

> 6. 👍 octocat approved PR [octocat/Hello-World#56](https://github.com/octocat/Hello-World/pull/56)
> 7. 🚩 octocat requested changes on PR [octocat/Hello-World#56](https://github.com/octocat/Hello-World/pull/56)

---

#### `pr_review_comment`

- **Description**: Comment on a PR review.
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#pull_request_review_comment](https://docs.github.com/en/webhooks/event-payloads#pull_request_review_comment) 📑
- **Top Variables**:

  - `payload.comment.body` – Comment text 💬
  - `payload.comment.html_url` – Link to the comment 🔗
  - `payload.pull_request.number` – PR number 🔢
  - `actor` – Who commented 👤
  - ...

- **Example Template**:

  ```json
  "pr_review_comment": "{{index}}. 🗣 {{actor}} commented on review for PR [{{repo}}#{{payload.pull_request.number}}]({{payload.comment.html_url}}): “{{payload.comment.body.slice(0,50)}}…”"
  ```

- **Rendered Output**:

> 8. 🗣 octocat commented on review for PR [octocat/Hello-World#56](https://github.com/octocat/Hello-World/pull/56): “Nit: rename this variable…”

---

#### `push`

**Description**: One or more commits pushed.

**Docs**: https://docs.github.com/en/webhooks/event-payloads#push 📑

**Top Variables**:

- `payload.commits.length` – Number of commits 📦
- `payload.ref` – Branch ref (e.g. `refs/heads/main`) 🌿
- `payload.compare` – Comparison URL 🔗
- `payload.commits[payload.commits.length-1].message` _or_ `payload.head_commit.message` – Latest commit message 📝
- `actor` – Who pushed 👤
- ...

**Example Template**:

```json
"push": "{{index}}. 🚀 {{actor}} pushed {{payload.commits.length}} commits to [{{repo_owner}}/{{repo_name}}@{{payload.ref.replace('refs/heads/','')}}]({{payload.compare}}): “{{payload.commits[payload.commits.length-1].message.slice(0,50)}}…”"
```

**Rendered Output**:

> 9. 🚀 octocat pushed 3 commits to [octocat/Hello-World@main](https://github.com/octocat/Hello-World/compare/abc...def): “Fix typo in docs…”

---

#### `release`

- **Description**: Release published or updated.
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#release](https://docs.github.com/en/webhooks/event-payloads#release) 📑
- **Top Variables**:

  - `payload.release.tag_name` – Tag (e.g. `v1.2.3`) 🔖
  - `payload.release.html_url` – Link to release 🔗
  - `payload.release.prerelease` – `true` if prerelease 🅿️
  - `actor` – Who released 👤
  - ...

- **Example Template**:

  ```json
  "release": "{{index}}. 📡 Released [{{repo}}@{{payload.release.tag_name}}]({{payload.release.html_url}})"
  ```

- **Rendered Output**:

> 10. 📡 Released [octocat/Hello-World@v1.2.3](https://github.com/octocat/Hello-World/releases/tag/v1.2.3)

---

#### `fork`

- **Description**: Repository forked.
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#fork](https://docs.github.com/en/webhooks/event-payloads#fork) 📑
- **Top Variables**:

  - `payload.forkee.full_name` – New fork name 🔱
  - `payload.forkee.html_url` – Link to fork 🔗
  - `repo` – Original repo name 🏺
  - `actor` – Who forked 👤
  - ...

- **Example Template**:

  ```json
  "fork": "{{index}}. 🍴 Forked [{{repo}}]({{`https://github.com/${repo}`}}) to [{{payload.forkee.full_name}}]({{payload.forkee.html_url}})"
  ```

- **Rendered Output**:

> 11. 🍴 Forked [octocat/Hello-World](https://github.com/octocat/Hello-World) to [octocat/Hello-World-Fork](https://github.com/octocat/Hello-World-Fork)

---

#### `public`

- **Description**: Private repo made public.
- **Docs**: [https://docs.github.com/en/webhooks/event-payloads#public](https://docs.github.com/en/webhooks/event-payloads#public) 📑
- **Top Variables**:

  - `repo` – Repo name 🏛️
  - `actor` – Who changed visibility 👤
  - ...

- **Example Template**:

  ```json
  "public": "{{index}}. 🎸 Made [{{repo}}]({{`https://github.com/${repo}`}}) public"
  ```

- **Rendered Output**:

> 12. 🎸 Made [octocat/Hello-World](https://github.com/octocat/Hello-World) public
