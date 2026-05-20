---
name: notion
description: "Use Notion through the official ntn CLI: search, read/write pages, data sources, Markdown, files, and Workers."
tools: [Bash]
---

# Notion

Use the official **`ntn` CLI** for all Notion operations.

Do **not** use a curl/HTTP fallback for normal work. If `ntn` is unavailable, ask the user to install it or confirm an alternate approach.

## Prerequisites

Required environment variable, usually stored in the project `.env`:

```bash
NOTION_API_KEY=ntn_your_key_here
```

Before running `ntn` commands from this project, load `.env` and map the token variable that `ntn` expects:

```bash
set -a
source .env
set +a
export NOTION_API_TOKEN="$NOTION_API_KEY"
export NOTION_KEYRING=0
```

If `.env` is missing or does not contain `NOTION_API_KEY`, ask the user to add it before continuing.

Optional `.env` entry:

```bash
NOTION_WORKSPACE_ID=<workspace_id>
```

## Installation

macOS/Linux:

```bash
curl -fsSL https://ntn.dev | bash
```

Or with npm:

```bash
npm install --global ntn
```

Requires Node 22+ and npm 10+.

Verify:

```bash
ntn --version
```

Skip `ntn login` for agent workflows. Use the integration token via `NOTION_API_TOKEN`.

## Access Setup

Before reading or writing Notion content, the target page or database must be shared with the integration:

1. Open the page/database in Notion
2. Click `...`
3. Select `Connect to`
4. Choose the integration

If this is missing, Notion may return `404` even when the page exists.

## Workflow Rules

- Before using Notion, check whether `ntn` is installed with `command -v ntn`.
- If `ntn` is missing, refer the user to the Installation section and stop unless they ask you to install it.
- Start Notion command sessions by loading the project `.env` and exporting `NOTION_API_TOKEN="$NOTION_API_KEY"`.
- Prefer `/markdown` endpoints when reading or editing page content for summarization or agent-friendly processing.
- Use block endpoints only when exact Notion block structure matters.
- For data sources/databases, use `/data_sources` query endpoints.
- Use `database_id` when creating a page inside a database.
- Use `data_source_id` when querying a database/data source.
- Pipe JSON output through `jq` for inspection.
- Respect the Notion API rate limit, roughly 3 requests/second average.

## `ntn api` Syntax

```bash
ntn api v1/users
```

Inline body:

```bash
ntn api v1/pages \
  parent[page_id]=abc123 \
  properties[title][0][text][content]="Notes"
```

PATCH:

```bash
ntn api v1/pages/abc123 -X PATCH archived:=true
```

Syntax reference:

| Syntax | Meaning |
|---|---|
| `key=value` | String value |
| `key[nested]=value` | Nested object |
| `key:=value` | Typed value: boolean, number, null, array |
| `--json -` | Read JSON request body from stdin |

## Search

```bash
ntn api v1/search query="page title"
```

Inspect first result:

```bash
ntn api v1/search query="roadmap" | jq '.results[0]'
```

## Pages

### Read Page Metadata

```bash
ntn api v1/pages/{page_id}
```

### Read Page as Markdown

Use this by default for content reading:

```bash
ntn api v1/pages/{page_id}/markdown
```

### Read Page Blocks

```bash
ntn api v1/blocks/{page_id}/children
```

### Create Page from Markdown

```bash
ntn api v1/pages \
  parent[page_id]=xxx \
  properties[title][0][text][content]="Notes from meeting" \
  markdown="# Agenda

- Q3 roadmap
- Hiring"
```

### Patch Page Markdown

```bash
ntn api v1/pages/{page_id}/markdown -X PATCH \
  markdown="## Update

Shipped the prototype."
```

### Update Page Properties

```bash
ntn api v1/pages/{page_id} -X PATCH \
  properties[Status][select][name]="Done"
```

### Archive Page

```bash
ntn api v1/pages/{page_id} -X PATCH archived:=true
```

## Data Sources / Databases

In Notion API version `2025-09-03`, databases are represented as **data sources** for query/retrieval.

### Query a Data Source

```bash
ntn api v1/data_sources/{data_source_id}/query -X POST \
  filter[property]=Status \
  filter[select][equals]=Active
```

### Query with JSON

Use JSON for compound filters, sorts, or complex request bodies:

```bash
cat <<'JSON' | ntn api v1/data_sources/{data_source_id}/query -X POST --json -
{
  "filter": {
    "property": "Status",
    "select": {
      "equals": "Active"
    }
  },
  "sorts": [
    {
      "property": "Date",
      "direction": "descending"
    }
  ]
}
JSON
```

### Create Page in a Database

```bash
ntn api v1/pages \
  parent[database_id]=xxx \
  properties[Name][title][0][text][content]="New Item" \
  properties[Status][select][name]="Todo"
```

### Create a Data Source

Prefer JSON for schemas:

```bash
cat <<'JSON' | ntn api v1/data_sources -X POST --json -
{
  "parent": {
    "page_id": "xxx"
  },
  "title": [
    {
      "text": {
        "content": "My Database"
      }
    }
  ],
  "properties": {
    "Name": {
      "title": {}
    },
    "Status": {
      "select": {
        "options": [
          { "name": "Todo" },
          { "name": "Done" }
        ]
      }
    },
    "Date": {
      "date": {}
    }
  }
}
JSON
```

For inline data sources, include:

```bash
is_inline:=true
```

## Common Property Examples

| Type | `ntn` example |
|---|---|
| Title | `properties[Name][title][0][text][content]="Title"` |
| Rich text | `properties[Notes][rich_text][0][text][content]="Text"` |
| Select | `properties[Status][select][name]="Todo"` |
| Multi-select | `properties[Tags][multi_select][0][name]="A"` |
| Date | `properties[Date][date][start]="2026-01-15"` |
| Checkbox | `properties[Done][checkbox]:=true` |
| Number | `properties[Score][number]:=42` |
| URL | `properties[Website][url]="https://example.com"` |
| Email | `properties[Email][email]="user@example.com"` |
| Relation | `properties[Related][relation][0][id]="page_id"` |

## Blocks

Append blocks to a page:

```bash
cat <<'JSON' | ntn api v1/blocks/{page_id}/children -X PATCH --json -
{
  "children": [
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [
          {
            "text": {
              "content": "Hello from ntn!"
            }
          }
        ]
      }
    }
  ]
}
JSON
```

## Files

Upload a local file:

```bash
ntn files create < photo.png
```

Upload an external URL:

```bash
ntn files create --external-url https://example.com/photo.png
```

List files:

```bash
ntn files list
```

## Notion-Flavored Markdown

The `/markdown` endpoints support CommonMark plus Notion-specific XML-like tags.

Use tabs for indentation inside Notion-specific block tags.

### Callout

```markdown
<callout icon="🎯" color="blue_bg">
	Ship the MVP by **Friday**.
</callout>
```

### Toggle

```markdown
<details color="gray">
<summary>Toggle title</summary>
	Children indented one tab
</details>
```

### Columns

```markdown
<columns>
	<column>Left side</column>
	<column>Right side</column>
</columns>
```

### Table of Contents

```markdown
<table_of_contents color="gray"/>
```

### Inline Features

```markdown
<mention-page url="...">Page Title</mention-page>
<mention-date start="2026-05-15"/>
<span underline="true">underlined text</span>
<span color="blue">blue text</span>
Inline math: $x^2$
```

Block math:

```markdown
$$
E = mc^2
$$
```

Colors:

```text
gray brown orange yellow green blue purple pink red
gray_bg brown_bg orange_bg yellow_bg green_bg blue_bg purple_bg pink_bg red_bg
```

## Workers

Notion Workers are TypeScript programs hosted by Notion. They can expose:

- Syncs: pull external data into Notion on a schedule
- Tools: callable inside Notion Custom Agents
- Webhooks: receive HTTP events from external services

Deployment requires a Business or Enterprise Notion plan.

### Create a Worker

```bash
ntn workers new my-worker
cd my-worker
```

Edit `src/index.ts`:

```typescript
import { Worker } from "@notionhq/workers";

const worker = new Worker();
export default worker;

worker.tool("greet", {
  title: "Greet a User",
  description: "Returns a friendly greeting",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string"
      }
    },
    required: ["name"]
  },
  execute: async ({ name }) => `Hello, ${name}!`,
});
```

Deploy:

```bash
ntn workers deploy --name my-worker
```

### Webhook Example

```typescript
worker.webhook("onGithubPush", {
  title: "GitHub Push Handler",
  execute: async (events, { notion }) => {
    for (const event of events) {
      console.log("got delivery", event.deliveryId);
      // event.body, event.rawBody, event.headers
    }
  },
});
```

List webhook URLs:

```bash
ntn workers webhooks list
```

Treat webhook URLs as secrets. Anyone with the URL can send events unless signature verification is implemented.

### Worker Commands

```bash
ntn workers deploy
ntn workers list
ntn workers exec <capability-key> -d '{"name": "world"}'

ntn workers sync trigger <key>
ntn workers sync pause <key>

ntn workers env set GITHUB_WEBHOOK_SECRET=...

ntn workers runs list
ntn workers runs logs <run-id>

ntn workers webhooks list
```

## Troubleshooting

- If Notion returns `404`, verify the target page/database is shared with the integration.
- If authentication fails, verify project `.env` contains `NOTION_API_KEY`, then export `NOTION_API_TOKEN="$NOTION_API_KEY"`.
- If `ntn` prompts for keychain access, set `NOTION_KEYRING=0`.
- If workspace selection prompts block automation, set `NOTION_WORKSPACE_ID`.
