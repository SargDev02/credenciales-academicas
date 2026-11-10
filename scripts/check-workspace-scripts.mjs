import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const criticalWorkspaces = [
  "@raes/contracts",
  "@raes/connector-core",
  "@raes/connector-poli",
  "@raes/connector-udea",
  "@raes/api",
  "@credenly/api",
  "@raes/web",
  "@credenly/web",
  "@raes/ui",
  "@raes/web-core",
];
export function validateWorkspaces(manifests) {
  const failures = [];
  for (const name of criticalWorkspaces) {
    const matches = manifests.filter((p) => p.name === name);
    if (matches.length !== 1) {
      failures.push(`${name}: expected exactly one manifest`);
      continue;
    }
    for (const script of ["lint", "typecheck", "test"]) {
      const command = matches[0].scripts?.[script];
      if (
        typeof command !== "string" ||
        !command.trim() ||
        /--if-present|^echo\b/.test(command)
      )
        failures.push(`${name}: missing executable ${script}`);
    }
  }
  return failures;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const manifests = [];
  for (const group of ["apps", "services", "packages"])
    for (const entry of readdirSync(group, { withFileTypes: true }).filter(
      (item) => item.isDirectory(),
    )) {
      const name = entry.name;
      let content;
      try {
        content = readFileSync(`${group}/${name}/package.json`, "utf8");
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
      manifests.push(JSON.parse(content));
    }
  const failures = validateWorkspaces(manifests);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      `Quality scripts present in all ${criticalWorkspaces.length} critical workspaces.`,
    );
}
