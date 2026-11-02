export interface ModelPrice {
  name: string;
  inputPerMillion: number;
  outputPerMillion: number;
  embeddingPerMillion: number;
}
export interface Config {
  queriesPerDay: number;
  daysPerMonth: number;
  avgQuestionTokens: number;
  retrievedChunks: number;
  tokensPerChunk: number;
  systemPromptTokens: number;
  avgAnswerTokens: number;
  initialIngestTokens: number;
  monthlyReindexTokens: number;
  models: ModelPrice[];
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}
function number(value: unknown, path: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) {
    throw new Error(`${path} must be a finite non-negative ${integer ? 'safe integer' : 'number'}`);
  }
  return value;
}
export function validateConfig(value: unknown): Config {
  const raw = object(value, 'config');
  const tokenFields = ['queriesPerDay', 'daysPerMonth', 'avgQuestionTokens', 'retrievedChunks', 'tokensPerChunk', 'systemPromptTokens', 'avgAnswerTokens', 'initialIngestTokens', 'monthlyReindexTokens'] as const;
  const fields = {} as Omit<Config, 'models'>;
  for (const field of tokenFields) fields[field] = number(raw[field], field, true);
  if (fields.daysPerMonth === 0) throw new Error('daysPerMonth must be greater than zero');
  if (!Array.isArray(raw.models) || raw.models.length === 0) throw new Error('models must be a non-empty array');
  const names = new Set<string>();
  const models = raw.models.map((value, index): ModelPrice => {
    const path = `models[${index}]`;
    const model = object(value, path);
    if (typeof model.name !== 'string' || model.name.trim() === '') throw new Error(`${path}.name must be a non-empty string`);
    const name = model.name.trim();
    if (names.has(name)) throw new Error(`${path}.name must be unique`);
    names.add(name);
    return {
      name,
      inputPerMillion: number(model.inputPerMillion, `${path}.inputPerMillion`),
      outputPerMillion: number(model.outputPerMillion, `${path}.outputPerMillion`),
      embeddingPerMillion: number(model.embeddingPerMillion, `${path}.embeddingPerMillion`),
    };
  });
  return { ...fields, models };
}
export function validateMargin(margin: number): void {
  if (!Number.isFinite(margin) || margin < 0 || margin >= 1) throw new Error('margin must be a number from 0 (inclusive) to 1 (exclusive)');
}
export function estimate(value: unknown, margin = 0.3, compare = false) {
  const config = validateConfig(value);
  validateMargin(margin);
  const inputTokens = config.avgQuestionTokens + config.retrievedChunks * config.tokensPerChunk + config.systemPromptTokens;
  const outputTokens = config.avgAnswerTokens;
  const monthlyQueries = config.queriesPerDay * config.daysPerMonth;
  const models = config.models.map(model => {
    const inputCost = inputTokens * model.inputPerMillion / 1e6;
    const outputCost = outputTokens * model.outputPerMillion / 1e6;
    const perQueryCost = inputCost + outputCost;
    const dailyQueryCost = perQueryCost * config.queriesPerDay;
    const monthlyInputCost = inputCost * monthlyQueries;
    const monthlyOutputCost = outputCost * monthlyQueries;
    const monthlyReindexCost = config.monthlyReindexTokens * model.embeddingPerMillion / 1e6;
    const monthlyCost = monthlyInputCost + monthlyOutputCost + monthlyReindexCost;
    const oneOffIngestCost = config.initialIngestTokens * model.embeddingPerMillion / 1e6;
    return {
      model: model.name,
      perQuery: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, inputCost, outputCost, totalCost: perQueryCost },
      dailyQueryCost,
      monthlyInputCost,
      monthlyOutputCost,
      monthlyReindexCost,
      monthlyCost,
      oneOffIngestCost,
      suggestedMonthlyQuote: monthlyCost / (1 - margin),
      suggestedIngestQuote: oneOffIngestCost / (1 - margin),
      suggestedFirstMonthQuote: (monthlyCost + oneOffIngestCost) / (1 - margin),
    };
  });
  // Reject overflowing arithmetic instead of silently producing Infinity/null in JSON.
  for (const model of models) {
    for (const value of [...Object.values(model.perQuery), ...Object.values(model).filter(v => typeof v === 'number')]) {
      if (!Number.isFinite(value)) throw new Error('Calculated values exceed the supported numeric range');
    }
  }
  if (compare) models.sort((a, b) => a.monthlyCost - b.monthlyCost || a.model.localeCompare(b.model));
  return { currency: 'USD', margin, daysPerMonth: config.daysPerMonth, queriesPerDay: config.queriesPerDay, monthlyQueries, compared: compare, models };
}
export type Estimate = ReturnType<typeof estimate>;
