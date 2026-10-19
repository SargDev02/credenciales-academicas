import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
// One canonical suite: only local Auth/DB/RAES fixtures, never remote accounts.
const child = spawn(
  "pnpm",
  ["test:frontend:browser", "--project=credenly-admin"],
  {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    stdio: "inherit",
  },
);
const [code] = await once(child, "exit");
process.exitCode = typeof code === "number" ? code : 1;
