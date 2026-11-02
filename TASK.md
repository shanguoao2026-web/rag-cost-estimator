# rag-cost-estimator
TypeScript Node CLI (no runtime deps; dev deps typescript + node:test ok) that estimates monthly LLM cost for a RAG / chatbot app (e.g. Dify) so a freelancer can quote clients.
- Inputs from a JSON config: queries per day, avg question tokens, retrieved chunks x tokens per chunk, system prompt tokens, avg answer tokens, embedding tokens for initial KB ingest + monthly re-index, and a price table supplied by the user (per 1M input / output / embedding tokens per model). Ship an example config with clearly labeled EXAMPLE prices (do not claim real current prices).
- Output: per-query tokens and cost, daily/monthly cost per model, one-off ingest cost, and a suggested quote with configurable margin (--margin 0.3). Table and --json output. Optional --compare to rank models by monthly cost.
- CLI: `node dist/cli.js --config examples/example.json [--margin 0.3] [--json]`.
- Validate config with clear errors (stderr, exit 1). README with usage and note that prices must be checked on the provider's pricing page.
- Tests: hand-computable config (100 q/day, 1000 input tokens, 200 output, $1/$2 per 1M, 30 days) -> monthly 6.0 USD input + 1.2 output = 7.2 USD; margin math; invalid config errors.
- .gitignore: node_modules, dist, *.log. package.json scripts build/test.
Run npm install, build, npm test until all pass.
