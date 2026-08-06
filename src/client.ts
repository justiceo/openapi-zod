import type { ConversionDiagnostic } from "./diagnostics.js";
import type { ResolvedOptions } from "./core.js";
import { uniqueName } from "./emit.js";
import type { OperationsResult } from "./operations.js";

export type ClientFunctionsResult = { lines: string[] };

export function convertClientFunctions(
  operations: OperationsResult,
  shared: { options: ResolvedOptions; diagnostics: ConversionDiagnostic[] },
): ClientFunctionsResult {
  const suffix = shared.options.operationNameSuffix;
  const usedNames = new Map<string, number>();
  const entries = operations.exportNames.map((exportName) => {
    const stripped = suffix && exportName.endsWith(suffix) ? exportName.slice(0, -suffix.length) : exportName;
    const base = stripped !== exportName ? stripped : `${stripped}Client`;
    const fnName = uniqueName(base, usedNames, `client/${exportName}`, shared.diagnostics);
    return { fnName, exportName };
  });

  const lines: string[] = [];
  for (const { fnName, exportName } of entries) {
    lines.push("");
    lines.push(`export async function ${fnName}(config: ClientConfig, input: ClientOperationInput<typeof ${exportName}.request> = {}, options?: ClientOptions): Promise<ClientResult<ClientResponseData<typeof ${exportName}.responses>>> {`);
    lines.push(`  return clientRequest(config, ${exportName}, input, options);`);
    lines.push("}");
  }

  lines.push("");
  lines.push("export function createClient(config: ClientConfig) {");
  lines.push("  return {");
  for (const { fnName, exportName } of entries) {
    lines.push(`    ${fnName}: (input?: ClientOperationInput<typeof ${exportName}.request>, options?: ClientOptions) => ${fnName}(config, input, options),`);
  }
  lines.push("  };");
  lines.push("}");

  return { lines };
}
