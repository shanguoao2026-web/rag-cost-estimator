#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { estimate, validateMargin, type Estimate } from './estimator.js';

const usage = 'Usage: node dist/cli.js --config <file.json> [--margin 0.3] [--json] [--compare]';
function table(result: Estimate): string {
  const money = (value: number) => `$${value.toFixed(6)}`;
  const rows = result.models.map((m, i) => [
    ...(result.compared ? [String(i + 1)] : []), m.model,
    String(m.perQuery.inputTokens), String(m.perQuery.outputTokens), String(m.perQuery.totalTokens),
    money(m.perQuery.totalCost), money(m.dailyQueryCost), money(m.monthlyInputCost), money(m.monthlyOutputCost),
    money(m.monthlyReindexCost), money(m.monthlyCost), money(m.oneOffIngestCost),
    money(m.suggestedMonthlyQuote), money(m.suggestedIngestQuote), money(m.suggestedFirstMonthQuote),
  ]);
  const headers = [...(result.compared ? ['Rank'] : []), 'Model', 'Input/query', 'Output/query', 'Total/query', 'Cost/query', 'Daily queries', 'Monthly input', 'Monthly output', 'Re-index', 'Monthly total', 'One-off ingest', 'Monthly quote', 'Ingest quote', 'First month quote'];
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(row => row[i]!.length)));
  const format = (row: string[]) => row.map((cell, i) => cell.padEnd(widths[i]!)).join(' | ');
  return [`USD · ${result.daysPerMonth} days/month · ${result.queriesPerDay} queries/day · ${(result.margin * 100).toFixed(2)}% gross margin`, format(headers), widths.map(w => '-'.repeat(w)).join('-+-'), ...rows.map(format), 'Monthly total includes re-indexing. Daily cost covers queries only. First month quote includes initial ingest.'].join('\n');
}
export function main(args: string[], io = { out: (text: string) => console.log(text), err: (text: string) => console.error(text) }): number {
try {
  let configPath: string | undefined;
  let margin = 0.3;
  let json = false;
  let compare = false;
  const seen = new Set<string>();
  if (args.includes('--help')) {
    io.out(usage);
  } else {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
      if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
      seen.add(arg);
      if (arg === '--config' || arg === '--margin') {
        const value = args[++i];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
        if (arg === '--config') configPath = value;
        else {
          margin = value.trim() === '' ? NaN : Number(value);
          validateMargin(margin);
        }
      } else if (arg === '--json') json = true;
      else if (arg === '--compare') compare = true;
      else throw new Error(`Unknown option: ${arg}`);
    }
    if (!configPath) throw new Error('--config is required');
    let config: unknown;
    try { config = JSON.parse(readFileSync(configPath, 'utf8')); }
    catch (error) { throw new Error(`Cannot read config ${configPath}: ${(error as Error).message}`); }
    const result = estimate(config, margin, compare);
    io.out(json ? JSON.stringify(result, null, 2) : table(result));
  }
  return 0;
} catch (error) {
  io.err(`Error: ${(error as Error).message}\n${usage}`);
  return 1;
}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
