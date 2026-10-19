import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function evaluateAudit(report, exceptions, now = Date.now()) {
  if (!report?.advisories || !report.metadata?.vulnerabilities || report.error)
    throw new Error("Dependency audit is unavailable; gate fails closed");
  const findings = [];
  for (const advisory of Object.values(report.advisories)) {
    const ghsa = advisory.github_advisory_id ?? advisory.url?.split("/").at(-1);
    const relevant = ["moderate", "high", "critical"].includes(
      advisory.severity,
    );
    const instances = advisory.findings?.length
      ? advisory.findings
      : [{ version: null, paths: [null] }];
    for (const instance of instances) {
      const paths = instance.paths?.length ? instance.paths : [null];
      for (const path of paths) {
        const exception = exceptions.find(
          (e) =>
            e.ghsa === ghsa &&
            e.module === advisory.module_name &&
            e.version === instance.version &&
            e.path === path &&
            Date.parse(e.expiresAt) > now,
        );
        findings.push({
          ghsa,
          module: advisory.module_name,
          severity: advisory.severity,
          version: instance.version,
          path,
          exceptionExpiresAt: exception?.expiresAt ?? null,
          blocked: relevant && !exception,
        });
      }
    }
  }
  const expected = Object.values(report.metadata.vulnerabilities).reduce(
    (sum, count) => sum + Number(count),
    0,
  );
  if (expected > 0 && findings.length === 0)
    throw new Error("Incomplete dependency audit; gate fails closed");
  return {
    status: findings.some((f) => f.blocked)
      ? "BLOCKED"
      : findings.some((f) => f.exceptionExpiresAt)
        ? "PASS_WITH_DOCUMENTED_LIMIT"
        : "PASS",
    findings,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  let output;
  try {
    output = execFileSync("pnpm", ["audit", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    output = error.stdout?.toString();
  }
  try {
    const report = JSON.parse(output);
    const exceptions = JSON.parse(
      readFileSync(
        new URL("./security/audit-exceptions.json", import.meta.url),
      ),
    );
    const result = evaluateAudit(report, exceptions);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "BLOCKED") process.exitCode = 1;
  } catch {
    console.error(
      "Dependency audit unavailable or invalid; gate fails closed.",
    );
    process.exitCode = 1;
  }
}
