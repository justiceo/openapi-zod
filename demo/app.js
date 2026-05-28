import { parse } from "https://esm.sh/yaml@2.8.0";
import { convertOpenApiToZod } from "./dist/index.js";

const examples = [
  {
    id: "inline-checkout",
    name: "Inline Checkout API",
    source: `openapi: 3.1.0
info:
  title: Inline Checkout API
  version: 1.0.0
paths:
  /orders:
    post:
      operationId: createOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - customer
                - items
              properties:
                customer:
                  type: object
                  required:
                    - email
                  properties:
                    email:
                      type: string
                      format: email
                    metadata:
                      type: object
                      additionalProperties:
                        type: string
                items:
                  type: array
                  minItems: 1
                  items:
                    type: object
                    required:
                      - sku
                      - quantity
                    properties:
                      sku:
                        type: string
                      quantity:
                        type: integer
                        minimum: 1
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                type: object
                required:
                  - id
                  - status
                properties:
                  id:
                    type: string
                  status:
                    enum:
                      - accepted
                      - queued
components:
  schemas:
    Error:
      type: object
      required:
        - message
      properties:
        message:
          type: string
`,
  },
  {
    id: "recursive-catalog",
    name: "Recursive Catalog API",
    source: `openapi: 3.1.0
info:
  title: Recursive Catalog API
  version: 1.0.0
paths:
  /categories/{id}:
    get:
      operationId: getCategory
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Category
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Category"
components:
  schemas:
    Category:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: string
        name:
          type: string
        parent:
          anyOf:
            - $ref: "#/components/schemas/Category"
            - type: "null"
        children:
          type: array
          items:
            $ref: "#/components/schemas/Category"
    CategoryEnvelope:
      type: object
      required:
        - data
      properties:
        data:
          $ref: "#/components/schemas/Category"
`,
  },
  {
    id: "media-types",
    name: "Media API",
    source: `openapi: 3.1.0
info:
  title: Media API
  version: 1.0.0
paths:
  /imports:
    post:
      operationId: importDocument
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/JsonImport"
          application/vnd.api+json:
            schema:
              $ref: "#/components/schemas/VendorImport"
          text/csv:
            schema:
              type: string
      responses:
        "200":
          description: Imported
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ImportResult"
            application/vnd.api+json:
              schema:
                $ref: "#/components/schemas/ImportResult"
components:
  schemas:
    JsonImport:
      type: object
      required:
        - records
      properties:
        records:
          type: array
          items:
            type: object
            additionalProperties: true
    VendorImport:
      type: object
      required:
        - data
      properties:
        data:
          type: array
          items:
            type: object
            additionalProperties: true
    ImportResult:
      type: object
      required:
        - count
      properties:
        count:
          type: integer
`,
  },
  {
    id: "polymorphic-events",
    name: "Polymorphic Events API",
    source: `openapi: 3.1.0
info:
  title: Polymorphic Events API
  version: 1.0.0
paths:
  /events:
    post:
      operationId: ingestEvent
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Event"
      responses:
        "202":
          description: Accepted
components:
  schemas:
    Event:
      oneOf:
        - $ref: "#/components/schemas/UserCreatedEvent"
        - $ref: "#/components/schemas/UserDeletedEvent"
      discriminator:
        propertyName: type
    UserCreatedEvent:
      type: object
      required:
        - type
        - user
      properties:
        type:
          const: user.created
        user:
          $ref: "#/components/schemas/User"
    UserDeletedEvent:
      type: object
      required:
        - type
        - id
      properties:
        type:
          const: user.deleted
        id:
          type: string
    User:
      allOf:
        - type: object
          required:
            - id
          properties:
            id:
              type: string
        - type: object
          properties:
            email:
              type: string
              format: email
    SearchResult:
      anyOf:
        - $ref: "#/components/schemas/UserCreatedEvent"
        - type: object
          required:
            - cursor
          properties:
            cursor:
              type: string
`,
  },
  {
    id: "nullable-profile",
    name: "Nullable Profile API",
    source: `openapi: 3.0.3
info:
  title: Nullable Profile API
  version: 1.0.0
paths:
  /profiles/{id}:
    patch:
      operationId: updateProfile
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ProfilePatch"
      responses:
        "200":
          description: Profile
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Profile"
components:
  schemas:
    Profile:
      type: object
      required:
        - id
        - displayName
      properties:
        id:
          type: string
        displayName:
          type: string
        avatarUrl:
          type: string
          format: uri
          nullable: true
    ProfilePatch:
      type: object
      properties:
        displayName:
          type: string
          nullable: true
        tags:
          type: array
          nullable: true
          items:
            type: string
`,
  },
  {
    id: "naming-edge",
    name: "Naming Edge API",
    source: `openapi: 3.1.0
info:
  title: Naming Edge API
  version: 1.0.0
paths:
  /reports/{report-id}:
    get:
      operationId: 2024-report.lookup
      parameters:
        - name: report-id
          in: path
          required: true
          schema:
            type: string
        - name: include totals
          in: query
          schema:
            type: boolean
      responses:
        "200":
          description: Report
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/2024 report"
components:
  schemas:
    2024 report:
      type: object
      required:
        - report-id
      properties:
        report-id:
          type: string
        class:
          type: string
        total dollars:
          type: number
`,
  },
];

const select = document.querySelector("#example-select");
const sourceInput = document.querySelector("#source-input");
const sourceHighlight = document.querySelector("#source-highlight");
const resultOutput = document.querySelector("#result-output");
const convertButton = document.querySelector("#convert-button");
const status = document.querySelector("#status");

let lastConvertedSource = "";
let lastGoodOutput = "";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function span(className, value) {
  return `<span class="${className}">${value}</span>`;
}

function highlightCode(source, rules) {
  let output = "";
  let index = 0;

  while (index < source.length) {
    let nextMatch = null;
    let nextRule = null;

    for (const rule of rules) {
      rule.pattern.lastIndex = index;
      const match = rule.pattern.exec(source);
      if (!match) continue;
      if (!nextMatch || match.index < nextMatch.index) {
        nextMatch = match;
        nextRule = rule;
      }
    }

    if (!nextMatch || !nextRule) {
      output += escapeHtml(source.slice(index));
      break;
    }

    if (nextMatch.index > index) {
      output += escapeHtml(source.slice(index, nextMatch.index));
    }

    output += nextRule.render
      ? nextRule.render(nextMatch)
      : span(nextRule.className, escapeHtml(nextMatch[0]));
    index = nextMatch.index + nextMatch[0].length;
  }

  return output;
}

function highlightYaml(source) {
  return highlightCode(source, [
    { pattern: /#[^\n]*/g, className: "token-comment" },
    { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, className: "token-string" },
    {
      pattern: /^(\s*)([^:\n]+)(:)/gm,
      render: (match) =>
        `${escapeHtml(match[1])}${span("token-key", escapeHtml(match[2]))}${escapeHtml(match[3])}`,
    },
    { pattern: /\b(true|false|null)\b/g, className: "token-keyword" },
    { pattern: /\b-?\d+(?:\.\d+)?\b/g, className: "token-number" },
  ]);
}

function highlightTypeScript(source) {
  return highlightCode(source, [
    { pattern: /\/\/[^\n]*/g, className: "token-comment" },
    { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, className: "token-string" },
    {
      pattern:
        /\b(import|from|export|const|type|as|return|function|if|else|true|false|null|undefined)\b/g,
      className: "token-keyword",
    },
    {
      pattern: /\b(z|object|string|number|boolean|array|union|literal|record|unknown|infer)\b/g,
      className: "token-function",
    },
    { pattern: /\b-?\d+(?:\.\d+)?\b/g, className: "token-number" },
  ]);
}

function renderSourceHighlight() {
  const highlighted = highlightYaml(sourceInput.value);
  sourceHighlight.innerHTML = `${highlighted}\n`;
}

function renderResult(value) {
  resultOutput.innerHTML = highlightTypeScript(value);
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function setDirtyState() {
  const dirty = sourceInput.value !== lastConvertedSource;
  convertButton.classList.toggle("is-active", dirty);
  convertButton.setAttribute("aria-pressed", String(dirty));
}

function diagnosticSummary(diagnostics) {
  if (diagnostics.length === 0) return "Converted successfully.";

  const errors = diagnostics.filter((item) => item.level === "error").length;
  const warnings = diagnostics.filter((item) => item.level === "warning").length;
  const parts = [];
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
  return `Converted with ${parts.join(" and ")}.`;
}

function convertSource() {
  try {
    const document = parse(sourceInput.value);
    const result = convertOpenApiToZod(document);
    const output = result.outputs.map((item) => item.contents).join("\n");

    lastConvertedSource = sourceInput.value;
    lastGoodOutput = output;
    renderResult(output);
    setStatus(diagnosticSummary(result.diagnostics), result.diagnostics.some((item) => item.level === "error"));
    setDirtyState();
  } catch (error) {
    renderResult(lastGoodOutput);
    setStatus(error instanceof Error ? error.message : String(error), true);
    setDirtyState();
  }
}

function selectExample(exampleId) {
  const example = examples.find((item) => item.id === exampleId) ?? examples[0];
  sourceInput.value = example.source;
  renderSourceHighlight();
  convertSource();
}

for (const example of examples) {
  const option = document.createElement("option");
  option.value = example.id;
  option.textContent = example.name;
  select.append(option);
}

sourceInput.addEventListener("input", () => {
  renderSourceHighlight();
  setDirtyState();
});

sourceInput.addEventListener("scroll", () => {
  sourceHighlight.parentElement.scrollTop = sourceInput.scrollTop;
  sourceHighlight.parentElement.scrollLeft = sourceInput.scrollLeft;
});

convertButton.addEventListener("click", convertSource);
select.addEventListener("change", () => selectExample(select.value));

selectExample(examples[0].id);
