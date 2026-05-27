import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { loadOpenApiDocument } from "../src/loader.js";
import { convertOpenApiToZod } from "../src/index.js";

const execFileAsync = promisify(execFile);
const fixtures = ["empty", "primitives", "objects", "refs", "composition", "operations"] as const;

async function readFixture(name: string, file: string): Promise<string> {
  return readFile(join("test", "fixtures", name, file), "utf8");
}

describe("fixture conversion", () => {
  for (const fixture of fixtures) {
    it(`matches ${fixture}`, async () => {
      const document = await loadOpenApiDocument(
        join("test", "fixtures", fixture, "openapi.yaml"),
      );
      const expected = (await readFixture(fixture, "expected.ts")).trimEnd() + "\n";
      const diagnostics = JSON.parse(await readFixture(fixture, "diagnostics.json"));

      const result = convertOpenApiToZod(document);

      expect(result.outputs).toEqual([{ path: "schemas.ts", contents: expected }]);
      expect(result.diagnostics).toEqual(diagnostics);
    });
  }

  it("promotes unsupported diagnostics when requested", async () => {
    const document = await loadOpenApiDocument(
      join("test", "fixtures", "composition", "openapi.yaml"),
    );

    const result = convertOpenApiToZod(document, { onUnsupported: "error" });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      level: "error",
      code: "unsupported.uniqueItems",
    }));
  });

  it("matches library output from the CLI", async () => {
    const fixture = "primitives";
    const document = await loadOpenApiDocument(
      join("test", "fixtures", fixture, "openapi.yaml"),
    );
    const expected = convertOpenApiToZod(document);
    const dir = await mkdtemp(join(tmpdir(), "openapi-zod-"));

    try {
      await execFileAsync("npx", [
        "tsx",
        "src/cli.ts",
        "--input",
        join("test", "fixtures", fixture, "openapi.yaml"),
        "--output",
        dir,
      ]);
      const contents = await readFile(join(dir, "schemas.ts"), "utf8");
      expect(contents).toBe(expected.outputs[0].contents);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
