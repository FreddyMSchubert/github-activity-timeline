import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const {
  INPUT_GITHUB_TOKEN: TOKEN,
  INPUT_USERNAME: USER,
  INPUT_MAX_ITEMS,
  INPUT_EVENT_TEMPLATES,
  INPUT_README_PATH: README_PATH,
  INPUT_TIMEZONE: RAW_TZ,
} = process.env;

if (!TOKEN || !USER) {
  console.error("❌ Missing github_token or username");
  process.exit(1);
}
const USER_TZ = RAW_TZ && RAW_TZ.trim() !== "" ? RAW_TZ : "UTC";
if (!RAW_TZ) {
  console.warn(`⚠️ No INPUT_TIMEZONE provided; defaulting to '${USER_TZ}'.`);
}

let templateMap = {};
try {
  templateMap = JSON.parse(INPUT_EVENT_TEMPLATES || "{}");
} catch {
  console.error("❌ `event_templates` is not valid JSON");
  process.exit(1);
}

function formatDate(dateString, tz) {
  let eventDate = new Date(dateString);
  let localNow, localEvent;

  try {
    localNow = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    localEvent = new Date(eventDate.toLocaleString("en-US", { timeZone: tz }));
  } catch (err) {
    console.warn(`⚠️ Invalid time zone '${tz}', falling back to UTC.`);
    localNow = new Date();
    localEvent = new Date(dateString);
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor(
    (localNow.setHours(0, 0, 0, 0) - localEvent.setHours(0, 0, 0, 0)) / msPerDay
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`;

  return eventDate.toLocaleDateString("de", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: tz,
  });
}

const MAX = parseInt(INPUT_MAX_ITEMS, 10);
const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const README = path.resolve(workspace, README_PATH);
const START = "<!-- ACTIVITY:START -->";
const END = "<!-- ACTIVITY:END -->";

// Templating function
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
    .map((ev) => ({ ...ev, human_date: formatDate(ev.created_at, USER_TZ) }))
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
      human_date: ev.human_date,
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
