import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const {
  INPUT_GITHUB_TOKEN: TOKEN,
  INPUT_USERNAME: USER,
  INPUT_MAX_ITEMS,
  INPUT_EVENT_TEMPLATES,
  INPUT_README_PATH: README_PATH,
} = process.env;

if (!TOKEN || !USER) {
  console.error("❌ Missing github_token or username");
  process.exit(1);
}

let templateMap = {};
try {
  templateMap = JSON.parse(INPUT_EVENT_TEMPLATES || "{}");
} catch {
  console.error("❌ `event_templates` is not valid JSON");
  process.exit(1);
}

const MAX = parseInt(INPUT_MAX_ITEMS, 10);
const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const README = path.resolve(workspace, README_PATH);
const START = "<!-- ACTIVITY:START -->";
const END = "<!-- ACTIVITY:END -->";

function render(tpl, vars) {
  tpl = tpl.replace(/`/g, "\\`");
  const expr = tpl.replace(
    /\{\{\s*([\s\S]+?)\s*\}\}/g,
    (_, code) => `\${${code}}`
  );
  const fn = new Function(...Object.keys(vars), `return \`${expr}\`;`);
  return fn(...Object.values(vars));
}

function normalize(e) {
  const { type, payload, repo, created_at, actor, org } = e;
  const [owner, name] = repo.name.split("/");

  let num, url;
  if (payload.issue) {
    num = payload.issue.number;
    url = payload.issue.html_url;
  }
  if (payload.pull_request) {
    num = payload.pull_request.number;
    url = payload.pull_request.html_url;
  }
  if (payload.comment) {
    url = payload.comment.html_url;
  }
  return {
    raw_type: type, // e.g. "IssuesEvent", "PushEvent"
    event_type:
      // normalized basics: issues_opened, pr_merged, push, release, create, delete…
      type === "IssuesEvent"
        ? `issues_${payload.action}`
        : type === "PullRequestEvent"
        ? payload.action === "closed" && payload.pull_request.merged
          ? "pr_merged"
          : `pr_${payload.action}`
        : type === "IssueCommentEvent"
        ? "issue_commented"
        : type === "PullRequestReviewEvent"
        ? `pr_review_${payload.review.state.toLowerCase()}`
        : type === "PullRequestReviewCommentEvent"
        ? "pr_review_comment"
        : // fallback to raw
          type.replace(/Event$/, "").toLowerCase(),
    created_at,
    repo_owner: owner,
    repo_name: name,
    repo: repo.name,
    actor: actor.login,
    org: org?.login,
    number: num,
    url,
    payload, // entire payload for deep use
    raw_event: e,
  };
}

(async () => {
  const resp = await fetch(
    `https://api.github.com/users/${USER}/events?per_page=100`,
    { headers: { Authorization: `token ${TOKEN}` } }
  );
  const rawEvents = await resp.json();
  if (!Array.isArray(rawEvents)) {
    console.error(rawEvents);
    process.exit(1);
  }

  const normalized = rawEvents
    .map(normalize)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const filtered = normalized.filter((ev) => {
    const hasTpl = templateMap[ev.event_type] ?? templateMap[ev.raw_type];
    return hasTpl && hasTpl.trim() !== "";
  });

  const selected = filtered.slice(0, MAX);

  const lines = selected.map((ev, i) => {
    const key = ev.event_type in templateMap ? ev.event_type : ev.raw_type;
    const tpl = templateMap[key];
    const vars = {
      index: i + 1,
      total_count: selected.length,
      ...ev,
    };
    return render(tpl, vars);
  });

  const block = [START, ...lines, END].join("\n");
  const md = fs.readFileSync(README, "utf8");
  const out = md.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);

  if (out !== md) {
    fs.writeFileSync(README, out, "utf8");
    console.log("✅ README updated");
  } else {
    console.log("ℹ️ No changes");
  }
})();
