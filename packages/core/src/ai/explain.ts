import type { CheckResult } from '../types.js';

export interface ExplainOptions {
  apiKey?: string;
  model?: string;
}

export interface ExplainedFinding extends CheckResult {
  explanation?: string;
  explanationError?: string;
}

const DEFAULT_MODEL = 'anthropic/claude-haiku-4-5';

export async function explainFinding(
  result: CheckResult,
  opts: ExplainOptions = {},
): Promise<ExplainedFinding> {
  const apiKey = opts.apiKey ?? process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    return {
      ...result,
      explanationError:
        'AI explanations require AI_GATEWAY_API_KEY env var (Vercel AI Gateway). Skipped.',
    };
  }

  try {
    const explanation = await callGateway({
      apiKey,
      model: opts.model ?? DEFAULT_MODEL,
      prompt: buildPrompt(result),
    });
    return { ...result, explanation };
  } catch (err) {
    return {
      ...result,
      explanationError: `AI explanation failed: ${(err as Error).message}`,
    };
  }
}

export async function explainFindings(
  results: CheckResult[],
  opts: ExplainOptions = {},
): Promise<ExplainedFinding[]> {
  const explained: ExplainedFinding[] = [];
  for (const r of results) {
    explained.push(await explainFinding(r, opts));
  }
  return explained;
}

function buildPrompt(result: CheckResult): string {
  const target =
    result.route ?? result.form ?? result.event ?? '(global)';
  return [
    `You are explaining a pre-merge regression finding to a frontend engineer reviewing a PR.`,
    `Be concise (2-3 sentences). Focus on business impact and likely fix.`,
    ``,
    `Check: ${result.checkId}`,
    `Severity: ${result.severity}`,
    `Target: ${target}`,
    result.locale ? `Locale: ${result.locale}` : '',
    `Message: ${result.message}`,
  ]
    .filter(Boolean)
    .join('\n');
}

interface GatewayParams {
  apiKey: string;
  model: string;
  prompt: string;
}

async function callGateway({
  apiKey,
  model,
  prompt,
}: GatewayParams): Promise<string> {
  const response = await fetch(
    'https://ai-gateway.vercel.sh/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.2,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI Gateway returned no content');
  }
  return content.trim();
}
