import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parser } from "typescript-eslint";

// Exercise the real typescript-estree caller of minimatch, rather than a mock.
// Default-project glob matching must include dotfiles but not nested paths.
test("typed parser default-project matching remains bounded with patched minimatch", () => {
  const root = mkdtempSync(join(tmpdir(), "parser-minimatch-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "nested"));
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", strict: true }, include: ["src/**/*.ts"],
  }));
  writeFileSync(join(root, "src", "member.ts"), "export const member = 1;");
  const code = "const value: number = 1;";
  const options = {
    tsconfigRootDir: root,
    projectService: { allowDefaultProject: ["*.ts"], defaultProject: "tsconfig.json" },
  };
  try {
    for (const name of ["outside.ts", ".hidden.ts"]) {
      const filePath = join(root, name);
      writeFileSync(filePath, code);
      const result = parser.parseForESLint(code, { ...options, filePath });
      assert.ok(result.services.program, "default-project files retain type information");
    }
    const filePath = join(root, "nested", "outside.ts");
    writeFileSync(filePath, code);
    assert.throws(() => parser.parseForESLint(code, { ...options, filePath }), /allowDefaultProject/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
