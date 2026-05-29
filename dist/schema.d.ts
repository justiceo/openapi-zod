import type { ConvertContext, SchemaMap } from "./core.js";
export declare function convertSchema(schema: unknown, context: ConvertContext): string;
export declare function findCycleEdges(schemas: SchemaMap): Set<string>;
export declare function componentHasCycle(componentName: string, cycles: Set<string>): boolean;
