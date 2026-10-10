type DiagnosticLevel = "warning" | "error";
export interface ConversionDiagnostic {
    level: DiagnosticLevel;
    code: string;
    message: string;
    path?: string;
}
export interface DiagnosticOptions {
    onUnsupported: "warn" | "error";
}
export declare function diagnostic(code: string, message: string, path: string | undefined, options: DiagnosticOptions): ConversionDiagnostic;
export {};
