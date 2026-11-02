import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../dist/cli.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { estimate, validateConfig } from '../dist/estimator.js';

const fixture = () => ({ queriesPerDay: 100, daysPerMonth: 30, avgQuestionTokens: 100, retrievedChunks: 3, tokensPerChunk: 250, systemPromptTokens: 150, avgAnswerTokens: 200, initialIngestTokens: 0, monthlyReindexTokens: 0, models: [{ name: 'Test', inputPerMillion: 1, outputPerMillion: 2, embeddingPerMillion: 0.1 }] });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
test('hand-calculable 1000 input and 200 output tokens, 100 queries/day, 30 days', () => {
  const m = estimate(fixture(), 0).models[0];
  assert.equal(m.perQuery.inputTokens, 1000);
  assert.equal(m.perQuery.totalTokens, 1200);
  close(m.perQuery.totalCost, 0.0014);
  close(m.dailyQueryCost, 0.14);
  close(m.monthlyInputCost, 3);
  close(m.monthlyOutputCost, 1.2);
  close(m.monthlyCost, 4.2);
});
test('2000 input tokens yields the task’s stated $6 input + $1.20 output', () => {
  const c = fixture(); c.systemPromptTokens += 1000;
  const m = estimate(c).models[0];
  close(m.monthlyInputCost, 6); close(m.monthlyOutputCost, 1.2); close(m.monthlyCost, 7.2);
});
test('embedding costs and gross-margin quotes', () => {
  const c = fixture(); c.initialIngestTokens = 1e6; c.monthlyReindexTokens = 2e6;
  const m = estimate(c, 0.3).models[0];
  close(m.oneOffIngestCost, 0.1); close(m.monthlyReindexCost, 0.2);
  close(m.monthlyCost, 4.4); close(m.suggestedMonthlyQuote, 4.4 / 0.7);
  close(m.suggestedIngestQuote, 0.1 / 0.7); close(m.suggestedFirstMonthQuote, 4.5 / 0.7);
});
test('compare ranks by total monthly cost and preserves default ordering', () => {
  const c = fixture(); c.models.push({ name: 'Cheap', inputPerMillion: 0, outputPerMillion: 0, embeddingPerMillion: 0 });
  assert.equal(estimate(c).models[0].model, 'Test');
  assert.equal(estimate(c, 0, true).models[0].model, 'Cheap');
});
test('invalid configuration errors identify the field', () => {
  for (const [field, value] of [['queriesPerDay', -1], ['avgAnswerTokens', '200'], ['daysPerMonth', 0], ['retrievedChunks', 1.5], ['models', []]]) {
    assert.throws(() => validateConfig({ ...fixture(), [field]: value }), new RegExp(field));
  }
  assert.throws(() => validateConfig(null), /config must be an object/);
  const c = fixture(); delete c.systemPromptTokens;
  assert.throws(() => validateConfig(c), /systemPromptTokens/);
  const bad = fixture(); bad.models[0].inputPerMillion = Infinity;
  assert.throws(() => validateConfig(bad), /inputPerMillion/);
  for (const margin of [-0.1, 1, NaN, Infinity]) assert.throws(() => estimate(fixture(), margin), /margin/);
});
test('CLI emits JSON and tables, and clear errors on stderr with exit 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rag-cost-'));
  const path = join(dir, 'config.json');
  const run = (...args) => {
    let stdout = '', stderr = '';
    const status = main(args, { out: text => { stdout += text + '\n'; }, err: text => { stderr += text + '\n'; } });
    return { status, stdout, stderr };
  };
  try {
    writeFileSync(path, JSON.stringify(fixture()));
    const json = run('--config', path, '--json', '--compare', '--margin', '0');
    assert.equal(json.status, 0, json.stderr);
    close(JSON.parse(json.stdout).models[0].monthlyCost, 4.2);
    const table = run('--config', path);
    assert.equal(table.status, 0); assert.match(table.stdout, /Monthly total/);
    for (const args of [[], ['--unknown'], ['--config'], ['--config', path, '--margin', 'oops'], ['--config', path, '--margin', '1'], ['--config', join(dir, 'missing')]]) {
      const result = run(...args); assert.equal(result.status, 1); assert.match(result.stderr, /Error:/); assert.equal(result.stdout, '');
    }
    writeFileSync(path, '{');
    assert.match(run('--config', path).stderr, /Cannot read config/);
    writeFileSync(path, '{}');
    const invalid = run('--config', path); assert.equal(invalid.status, 1); assert.match(invalid.stderr, /queriesPerDay/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
