#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { convertOpenApiToZod } from "./index.js";
import { loadOpenApiDocument } from "./loader.js";

type CliOptions = {
  input?: string;
  output?: string;
  outputFile?: string;
  namePrefix?: string;
  nameSuffix?: string;
  operationPrefix?: string;
  operationSuffix?: string;
  noTypes: boolean;
  noRouteMap: boolean;
  noOperationTypes: boolean;
  noSecurityValidators: boolean;
  noMetadata: boolean;
  strictObjects: boolean;
  mediaTypes: string[];
  excludeDeprecated: boolean;
  failOnWarning: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    noTypes: false,
    noRouteMap: false,
    noOperationTypes: false,
    noSecurityValidators: false,
    noMetadata: false,
    strictObjects: false,
    mediaTypes: [],
    excludeDeprecated: false,
    failOnWarning: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    switch (arg) {
      case "--input":
        options.input = value;
        index += 1;
        break;
      case "--output":
        options.output = value;
        index += 1;
        break;
      case "--output-file":
        options.outputFile = value;
        index += 1;
        break;
      case "--name-prefix":
        options.namePrefix = value;
        index += 1;
        break;
      case "--name-suffix":
        options.nameSuffix = value;
        index += 1;
        break;
      case "--operation-prefix":
        options.operationPrefix = value;
        index += 1;
        break;
      case "--operation-suffix":
        options.operationSuffix = value;
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
        options.mediaTypes.push(value);
        index += 1;
        break;
      case "--exclude-deprecated":
        options.excludeDeprecated = true;
        break;
      case "--fail-on-warning":
        options.failOnWarning = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.input) throw new Error("--input is required");
  if (!options.output) throw new Error("--output is required");

  return options;
}

async function main(): Promise<void> {
  const cliOptions = parseArgs(process.argv.slice(2));
  const document = await loadOpenApiDocument(cliOptions.input!);
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
  });

  await mkdir(cliOptions.output!, { recursive: true });
  await Promise.all(
    result.outputs.map((file) =>
      writeFile(join(cliOptions.output!, file.path), file.contents, "utf8"),
    ),
  );

  for (const item of result.diagnostics) {
    process.stderr.write(
      `${item.level} ${item.code} ${item.path ?? "-"} ${item.message}\n`,
    );
  }

  const hasErrors = result.diagnostics.some((item) => item.level === "error");
  const hasWarnings = result.diagnostics.some((item) => item.level === "warning");
  process.exitCode = hasErrors || (cliOptions.failOnWarning && hasWarnings) ? 1 : 0;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
