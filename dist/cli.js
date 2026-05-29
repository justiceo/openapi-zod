#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { convertOpenApiToZod } from "./index.js";
import { loadOpenApiDocument } from "./loader.js";
const usage = `Usage: openapi-zod --input <path> --output <dir> [options]

Convert an OpenAPI 3.0.x or 3.1.x YAML/JSON document into Zod 4 validators.

Required:
  --input <path>              OpenAPI YAML or JSON file.
  --output <dir>              Directory for generated files.

Options:
  --output-file <name>        Generated file name. Default: schemas.ts.
  --name-prefix <value>       Prefix for component schema exports.
  --name-suffix <value>       Suffix for component schema exports. Default: Schema.
  --operation-prefix <value>  Prefix for operation exports.
  --operation-suffix <value>  Suffix for operation exports. Default: Operation.
  --no-types                  Skip inferred schema type exports.
  --no-route-map              Skip the aggregate routes export.
  --no-operation-types        Skip inferred operation request and response types.
  --no-security-validators    Skip security credential validators.
  --no-metadata               Skip document metadata export.
  --strict-objects            Generate strict object schemas where possible.
  --media-type <value>        Include an additional request/response media type. Repeatable.
  --exclude-deprecated        Skip deprecated operations and reusable components where possible.
  --include-default-values    Emit generated default values in operation metadata.
  --fail-on-warning           Exit non-zero when warnings are emitted.
  --help, -h                  Print this help text.
  --version, -v               Print the package version.
`;
function readPackageVersion() {
    const packageJsonUrl = new URL("../package.json", import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8"));
    return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
}
function isFlag(value) {
    return value === undefined || value.startsWith("-");
}
function requireValue(arg, value) {
    if (value === undefined || isFlag(value)) {
        throw new Error(`${arg} requires a value`);
    }
    return value;
}
function parseArgs(argv) {
    if (argv.includes("--help") || argv.includes("-h"))
        return { action: "help" };
    if (argv.includes("--version") || argv.includes("-v"))
        return { action: "version" };
    const options = {
        action: "convert",
        noTypes: false,
        noRouteMap: false,
        noOperationTypes: false,
        noSecurityValidators: false,
        noMetadata: false,
        strictObjects: false,
        mediaTypes: [],
        excludeDeprecated: false,
        includeDefaultValues: false,
        failOnWarning: false,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const value = argv[index + 1];
        switch (arg) {
            case "--input":
                options.input = requireValue(arg, value);
                index += 1;
                break;
            case "--output":
                options.output = requireValue(arg, value);
                index += 1;
                break;
            case "--output-file":
                options.outputFile = requireValue(arg, value);
                index += 1;
                break;
            case "--name-prefix":
                options.namePrefix = requireValue(arg, value);
                index += 1;
                break;
            case "--name-suffix":
                options.nameSuffix = requireValue(arg, value);
                index += 1;
                break;
            case "--operation-prefix":
                options.operationPrefix = requireValue(arg, value);
                index += 1;
                break;
            case "--operation-suffix":
                options.operationSuffix = requireValue(arg, value);
                index += 1;
                break;
            case "--no-types":
                options.noTypes = true;
                break;
            case "--no-route-map":
                options.noRouteMap = true;
                break;
            case "--no-operation-types":
                options.noOperationTypes = true;
                break;
            case "--no-security-validators":
                options.noSecurityValidators = true;
                break;
            case "--no-metadata":
                options.noMetadata = true;
                break;
            case "--strict-objects":
                options.strictObjects = true;
                break;
            case "--media-type":
                options.mediaTypes.push(requireValue(arg, value));
                index += 1;
                break;
            case "--exclude-deprecated":
                options.excludeDeprecated = true;
                break;
            case "--include-default-values":
                options.includeDefaultValues = true;
                break;
            case "--fail-on-warning":
                options.failOnWarning = true;
                break;
            default:
                if (arg.startsWith("-")) {
                    throw new Error(`Unknown argument: ${arg}`);
                }
                throw new Error(`Unknown argument: ${arg}`);
        }
    }
    if (!options.input)
        throw new Error("--input is required");
    if (!options.output)
        throw new Error("--output is required");
    return options;
}
async function main() {
    const cliOptions = parseArgs(process.argv.slice(2));
    if (cliOptions.action === "help") {
        process.stdout.write(usage);
        return;
    }
    if (cliOptions.action === "version") {
        process.stdout.write(`${readPackageVersion()}\n`);
        return;
    }
    const document = await loadOpenApiDocument(cliOptions.input);
    const result = convertOpenApiToZod(document, {
        outputFileName: cliOptions.outputFile,
        schemaNamePrefix: cliOptions.namePrefix,
        schemaNameSuffix: cliOptions.nameSuffix,
        operationNamePrefix: cliOptions.operationPrefix,
        operationNameSuffix: cliOptions.operationSuffix,
        includeInferredTypes: !cliOptions.noTypes,
        includeRouteMap: !cliOptions.noRouteMap,
        includeOperationTypes: !cliOptions.noOperationTypes,
        includeSecurityValidators: !cliOptions.noSecurityValidators,
        includeDocumentMetadata: !cliOptions.noMetadata,
        strictObjects: cliOptions.strictObjects,
        mediaTypes: cliOptions.mediaTypes.length > 0 ? cliOptions.mediaTypes : undefined,
        includeDeprecated: !cliOptions.excludeDeprecated,
        includeDefaultValues: cliOptions.includeDefaultValues,
    });
    await mkdir(cliOptions.output, { recursive: true });
    await Promise.all(result.outputs.map((file) => writeFile(join(cliOptions.output, file.path), file.contents, "utf8")));
    for (const item of result.diagnostics) {
        process.stderr.write(`${item.level} ${item.code} ${item.path ?? "-"} ${item.message}\n`);
    }
    const hasErrors = result.diagnostics.some((item) => item.level === "error");
    const hasWarnings = result.diagnostics.some((item) => item.level === "warning");
    process.exitCode = hasErrors || (cliOptions.failOnWarning && hasWarnings) ? 1 : 0;
}
main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});
