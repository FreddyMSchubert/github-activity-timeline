import fs from "fs";
import path from "path";
import { request } from "@octokit/graphql";

(async () => {
  const { GITHUB_TOKEN, INPUT_USERNAME, INPUT_MAX_ITEMS, INPUT_README_PATH } =
    process.env;
  if (!GITHUB_TOKEN || !INPUT_USERNAME) {
    console.error("❌ Missing required inputs: github_token or username");
    process.exit(1);
  }
  const MAX = parseInt(INPUT_MAX_ITEMS, 10) || 5;
  const README = path.resolve(process.cwd(), INPUT_README_PATH);
  const START = "<!-- ACTIVITY:START -->";
  const END = "<!-- ACTIVITY:END -->";

  const graphql = request.defaults({
    headers: { authorization: `token ${GITHUB_TOKEN}` },
  });

  const QUERY = `
		query($login: String!, $n: Int!) {
			user(login: $login) {
				contributionsCollection {
					issueContributions(last: $n) {
						nodes { occurredAt issue { number url repository { nameWithOwner } } }
					}
					issueCommentContributions(last: $n) {
						nodes { occurredAt comment { url issue { number repository { nameWithOwner } } } }
					}
					pullRequestContributions(last: $n) {
						nodes { occurredAt pullRequest { number url merged repository { nameWithOwner } } }
					}
					pullRequestReviewContributions(last: $n) {
						nodes { occurredAt pullRequestReview { state url pullRequest { number repository { nameWithOwner } } } }
					}
					pullRequestReviewCommentContributions(last: $n) {
						nodes { occurredAt comment { url pullRequest { number repository { nameWithOwner } } } }
					}
				}
			}
		}`;

  const data = await graphql(QUERY, {
    login: INPUT_USERNAME,
    n: MAX,
  });

  const events = [
    ...data.user.contributionsCollection.issueContributions.nodes.map((n) => ({
      date: new Date(n.occurredAt),
      text: `✨ Created issue [#${n.issue.number}](${n.issue.url}) in **${n.issue.repository.nameWithOwner}**`,
    })),
    ...data.user.contributionsCollection.issueCommentContributions.nodes.map(
      (n) => ({
        date: new Date(n.occurredAt),
        text: `💬 Commented on issue [#${n.comment.issue.number}](${n.comment.url}) in **${n.comment.issue.repository.nameWithOwner}**`,
      })
    ),
    ...data.user.contributionsCollection.pullRequestContributions.nodes.map(
      (n) => ({
        date: new Date(n.occurredAt),
        text: n.pullRequest.merged
          ? `🎉 Merged PR [#${n.pullRequest.number}](${n.pullRequest.url}) in **${n.pullRequest.repository.nameWithOwner}**`
          : `🚀 Opened PR [#${n.pullRequest.number}](${n.pullRequest.url}) in **${n.pullRequest.repository.nameWithOwner}**`,
      })
    ),
    ...data.user.contributionsCollection.pullRequestReviewContributions.nodes.map(
      (n) => ({
        date: new Date(n.occurredAt),
        text:
          n.pullRequestReview.state === "APPROVED"
            ? `✅ Approved review [#${n.pullRequestReview.pullRequest.number}](${n.pullRequestReview.url}) in **${n.pullRequestReview.pullRequest.repository.nameWithOwner}**`
            : `❌ Requested changes [#${n.pullRequestReview.pullRequest.number}](${n.pullRequestReview.url}) in **${n.pullRequestReview.pullRequest.repository.nameWithOwner}**`,
      })
    ),
    ...data.user.contributionsCollection.pullRequestReviewCommentContributions.nodes.map(
      (n) => ({
        date: new Date(n.occurredAt),
        text: `🗣️ Commented on PR review [#${n.comment.pullRequest.number}](${n.comment.url}) in **${n.comment.pullRequest.repository.nameWithOwner}**`,
      })
    ),
  ];

  const uniq = Array.from(
    new Map(
      events.sort((a, b) => b.date - a.date).map((e) => [e.text, e])
    ).values()
  ).slice(0, MAX);

  const lines = uniq.map((e, i) => `${i + 1}. ${e.text}`);
  const block = [START, "", ...lines, "", END].join("\n");

  const md = fs.readFileSync(README, "utf8");
  const updated = md.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);

  if (updated !== md) {
    fs.writeFileSync(README, updated, "utf8");
    console.log("✅ README updated");
  } else {
    console.log("ℹ️ No new activity");
  }
})();
