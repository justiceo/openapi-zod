import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { loadOpenApiDocument } from "../src/loader.js";
import { convertOpenApiToZod } from "../src/index.js";

type GeneratedClientModule = {
  getUser: (
    config: { baseUrl: string; fetch: typeof fetch },
    input?: unknown,
    options?: unknown,
  ) => Promise<{ success: boolean; status: number; data: unknown; issues?: unknown }>;
  updateUser: (
    config: { baseUrl: string; fetch: typeof fetch },
    input?: unknown,
  ) => Promise<{ success: boolean; status: number; data: unknown; issues?: unknown }>;
};

async function loadGeneratedClient(): Promise<GeneratedClientModule> {
  const document = await loadOpenApiDocument(
    join("test", "fixtures", "operations", "openapi.yaml"),
  );
  const result = convertOpenApiToZod(document, { outputMode: "singleFile", includeClient: true });
  const dir = await mkdtemp(join(tmpdir(), "openapi-zod-client-"));
  const file = join(dir, "generated-client.mts");
  await writeFile(file, result.outputs[0].contents, "utf8");
  return import(pathToFileURL(file).href) as Promise<GeneratedClientModule>;
}

describe("generated client SDK (runtime)", () => {
  it("builds the URL/query/headers and validates a successful response", async () => {
    const { getUser } = await loadGeneratedClient();
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(
        "https://api.example.test/users/3fa85f64-5717-4562-b3fc-2c963f66afa6?includePosts=true",
      );
      expect((init.headers as Record<string, string>)["x-request-id"]).toBe("abc");
      return new Response(
        JSON.stringify({ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", email: "a@example.com" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await getUser(
      { baseUrl: "https://api.example.test", fetch: fetchMock as unknown as typeof fetch },
      {
        params: { userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
        query: { includePosts: true },
        headers: { "x-request-id": "abc" },
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", email: "a@example.com" });
  });

  it("serializes the JSON request body and parses a no-content response", async () => {
    const { updateUser } = await loadGeneratedClient();
    let capturedBody: string | undefined;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
      return new Response(null, { status: 204 });
    });

    const result = await updateUser(
      { baseUrl: "https://api.example.test", fetch: fetchMock as unknown as typeof fetch },
      {
        params: { userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
        body: { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", email: "a@example.com" },
      },
    );

    expect(JSON.parse(capturedBody!)).toEqual({
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      email: "a@example.com",
    });
    expect(result.success).toBe(true);
    expect(result.status).toBe(204);
  });

  it("reports a validation failure when the response does not match its schema", async () => {
    const { getUser } = await loadGeneratedClient();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "not-a-uuid" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await getUser(
      { baseUrl: "https://api.example.test", fetch: fetchMock as unknown as typeof fetch },
      { params: { userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6" } },
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(200);
    expect(result.issues).toBeDefined();
    expect((result.issues as unknown[]).length).toBeGreaterThan(0);
  });

  it("falls back to the default response schema for unmatched statuses", async () => {
    const { getUser } = await loadGeneratedClient();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await getUser(
      { baseUrl: "https://api.example.test", fetch: fetchMock as unknown as typeof fetch },
      { params: { userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6" } },
    );

    expect(result.status).toBe(500);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ message: "boom" });
  });

  it("reports failure when no response status matches", async () => {
    const { updateUser } = await loadGeneratedClient();
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));

    const result = await updateUser(
      { baseUrl: "https://api.example.test", fetch: fetchMock as unknown as typeof fetch },
      { params: { userId: "3fa85f64-5717-4562-b3fc-2c963f66afa6" }, body: { id: "x", email: "a@example.com" } },
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(result.issues).toBeUndefined();
  });
});
