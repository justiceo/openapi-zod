export type DiagnosticLevel = "warning" | "error";

export type ConversionDiagnostic = {
  level: DiagnosticLevel;
  code: string;
  message: string;
  path?: string;
};

export type DiagnosticOptions = {
  onUnsupported: "warn" | "error";
};

export function diagnostic(
  code: string,
  message: string,
  path: string | undefined,
  options: DiagnosticOptions,
): ConversionDiagnostic {
  const level = code.startsWith("invalid.")
    ? "error"
    : code.startsWith("unsupported.") && options.onUnsupported === "error"
      ? "error"
      : "warning";

  return { level, code, message, path };
}
