# RAG cost estimator

A TypeScript Node CLI for estimating monthly RAG/chatbot LLM costs and client quotes. No runtime dependencies. Requires Node.js 18+ and npm.

```sh
npm install
npm run build
node dist/cli.js --config examples/example.json --margin 0.3
node dist/cli.js --config examples/example.json --compare
node dist/cli.js --config examples/example.json --margin 0.3 --compare --json
npm test
```

`--config` is required. `--margin` defaults to 0.3 and accepts a gross margin from 0 inclusive to 1 exclusive. `--compare` sorts models by recurring monthly cost, cheapest first (ties by name); the table includes ranks. `--json` prints the full numeric breakdown instead of a table. `--help` prints usage. Invalid configuration or arguments print an error to stderr and exit with status 1.

Copy [examples/example.json](examples/example.json) and supply your own prices. All shipped prices are **EXAMPLE prices**, not real current prices. Check prices on each provider's pricing page before quoting clients. All costs and prices are USD; prices are per **1 million tokens**.

Configuration fields:

| Field | Meaning |
| --- | --- |
| `queriesPerDay` | Expected daily query count |
| `daysPerMonth` | Number of billed days, e.g. 30; must be positive |
| `avgQuestionTokens` | Average user question length |
| `retrievedChunks` | Number of retrieved chunks per query |
| `tokensPerChunk` | Average tokens in each retrieved chunk |
| `systemPromptTokens` | System instructions sent with each query |
| `avgAnswerTokens` | Average generated response length |
| `initialIngestTokens` | One-off knowledge-base embedding tokens |
| `monthlyReindexTokens` | Monthly embedding tokens for updates |
| `models` | Non-empty list of model price objects |

Each model has a unique non-empty `name`, and non-negative finite `inputPerMillion`, `outputPerMillion`, and `embeddingPerMillion` prices. All count/token fields are required non-negative safe integers. Zero traffic and free prices are supported. Optional metadata such as `_note` is ignored. Each model row represents a complete pricing scenario: its embedding rate can come from a separate embedding model selected for that scenario.

Input tokens per query = question + retrieved chunks × tokens per chunk + system prompt. Output tokens are the average answer length. Each token cost = tokens × price / 1,000,000. Daily query cost includes input and output; monthly cost = daily query cost × days + monthly re-index embedding cost. One-off ingest is shown separately. JSON also includes the per-query input/output cost split; the table displays all three per-query token counts and the total per-query cost. Table costs use six decimal places; JSON retains calculation precision.

Suggested quotes use **gross margin**, not markup: quote = cost / (1 − margin). At 30% margin, a $7 cost produces a $10 quote. Monthly and ingest quotes are separate; the first-month quote combines them. These estimates cover the configured LLM/embedding usage only. Add hosting, vector storage, implementation, support, taxes, and other expenses to your client proposal as appropriate. The estimator assumes one model call per query and the same token usage per scenario; account for retries, chat history, extra calls, caching, and provider billing rules in your inputs if applicable.

The task's numerical example contains an arithmetic discrepancy: 100 queries/day × 1,000 input tokens × 30 days at $1 per million is **$3**, plus $1.20 output = **$4.20**. Tests verify that correct result and also verify **$7.20** using 2,000 input tokens per query ($6 input + $1.20 output).
