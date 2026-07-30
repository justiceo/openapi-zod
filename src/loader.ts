import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import YAML from "yaml";

export async function loadOpenApiDocument(path: string): Promise<unknown> {
  const contents = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();

  try {
    return extension === ".json" ? JSON.parse(contents) : YAML.parse(contents);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${path}: ${reason}`);
  }
}
