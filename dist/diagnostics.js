export function diagnostic(code, message, path, options) {
    const level = code.startsWith("invalid.")
        ? "error"
        : code.startsWith("unsupported.") && options.onUnsupported === "error"
            ? "error"
            : "warning";
    return { level, code, message, path };
}
