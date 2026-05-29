import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import YAML from "yaml";
export async function loadOpenApiDocument(path) {
    const contents = await readFile(path, "utf8");
    const extension = extname(path).toLowerCase();
    if (extension === ".json") {
        return JSON.parse(contents);
    }
    return YAML.parse(contents);
}
