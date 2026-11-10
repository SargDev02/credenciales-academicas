import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function findSecretKinds(text) {
  const kinds = [];
  if (/(?:sbp_[a-zA-Z0-9]{35,}|sb_secret_[a-zA-Z0-9_-]{24,}|gh[pousr]_[a-zA-Z0-9]{35,}|github_pat_[a-zA-Z0-9_]{40,})/.test(text)) kinds.push("private-api-token");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) kinds.push("private-key");
  for (const candidate of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(candidate[1], "base64url").toString()).role === "service_role") kinds.push("service-role-jwt"); }
    catch { /* Not a JWT payload. */ }
  }
  for (const match of text.matchAll(/postgres(?:ql)?:\/\/[^\s/:]+:([^\s@]+)@([^\s/:]+)/g)) {
    if (!/^(?:localhost|127\.0\.0\.1)$/.test(match[2]) &&
        !/^(?:\[[^\]]+\]|<[^>]+>|(?:your|replace|example|password)[^@\s]*)$/i.test(match[1])) kinds.push("database-password-url");
  }
  return [...new Set(kinds)];
}
export function forbiddenIndexedPath(path) {
  return /(^|\/)\.env($|\.(?!example$))|\.(?:traineddata(?:\.gz)?|pem|key|har)$|(^|\/)(?:node_modules|\.next|coverage|playwright-report|test-results)\//.test(path);
}
function scan() {
  const git = (args, options = {}) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024, ...options });
  const files = [...new Set(git(["ls-files", "-co", "--exclude-standard", "-z"]).split("\0").filter(Boolean))];
  const indexed = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const violations = indexed.filter(forbiddenIndexedPath).map(path => ({ path, kind: "forbidden-tracked-file" }));
  for (const path of files) if (existsSync(path)) for (const kind of findSecretKinds(readFileSync(path).toString())) violations.push({ path, kind });
  const objects = git(["rev-list", "--objects", "--max-count=25", "HEAD"]).trim().split("\n");
  const names = new Map(objects.map(line => { const offset = line.indexOf(" "); return [line.slice(0, offset < 0 ? undefined : offset), line.slice(offset + 1)]; }));
  const data = git(["cat-file", "--batch"], { input: [...names.keys()].join("\n") + "\n", encoding: null });
  let cursor = 0, blobs = 0;
  while (cursor < data.length) {
    const end = data.indexOf(10, cursor), [id, type, sizeText] = data.subarray(cursor, end).toString().split(" ");
    const size = Number(sizeText), start = end + 1;
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("Unable to inspect history object");
    if (type === "blob") { blobs++; for (const kind of findSecretKinds(data.subarray(start, start + size).toString())) violations.push({ path: names.get(id), kind, scope: "recent-history" }); }
    cursor = start + size + 1;
  }
  // Never include a match, line, secret fingerprint or raw git object content.
  console.log(JSON.stringify({ versionableFiles: files.length, recentHistoryBlobs: blobs, violations }, null, 2));
  if (violations.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) scan();
