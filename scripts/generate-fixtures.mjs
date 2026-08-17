import { readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { convertOpenApiToZod } from "../src/index.ts";
import { loadOpenApiDocument } from "../src/loader.ts";

const fixturesDir = join("test", "fixtures");

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  const fixtures = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const fixture of fixtures) {
    const dir = join(fixturesDir, fixture);
    const openapiPath = join(dir, "openapi.yaml");
    if (!(await fileExists(openapiPath))) {
      continue;
    }

    const document = await loadOpenApiDocument(openapiPath);

    const multiFile = convertOpenApiToZod(document);
    const byPath = new Map(multiFile.outputs.map((output) => [output.path, output.contents]));
    await writeFile(join(dir, "expected-schema.ts"), byPath.get("api/schema.ts") ?? "", "utf8");
    await writeFile(join(dir, "expected-operations.ts"), byPath.get("api/operations.ts") ?? "", "utf8");
    if (byPath.has("api/router.ts")) {
      await writeFile(join(dir, "expected-router.ts"), byPath.get("api/router.ts"), "utf8");
    }

    const singleFile = convertOpenApiToZod(document, { outputMode: "singleFile" });
    await writeFile(join(dir, "expected.ts"), singleFile.outputs[0].contents, "utf8");

    const withClient = convertOpenApiToZod(document, { includeClient: true });
    const clientOutput = withClient.outputs.find((output) => output.path === "api/client.ts");
    if (clientOutput) {
      await writeFile(join(dir, "expected-client.ts"), clientOutput.contents, "utf8");
    }

    await writeFile(join(dir, "diagnostics.json"), `${JSON.stringify(multiFile.diagnostics, null, 2)}\n`, "utf8");

    console.log(`regenerated ${fixture}`);
  }
}

main();
