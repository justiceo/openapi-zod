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
export declare function diagnostic(code: string, message: string, path: string | undefined, options: DiagnosticOptions): ConversionDiagnostic;
