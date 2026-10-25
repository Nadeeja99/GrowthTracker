// The language model behind the coach, behind a small interface so the route
// doesn't depend on the provider and tests can substitute a fake.
import OpenAI from 'openai';
import type { FunctionTool } from 'openai/resources/responses/responses';
import { env } from '../../config/env';
import { suggestActionsJsonSchema } from './suggestions';

export interface CoachTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachModelRequest {
  instructions: string;
  input: CoachTurn[];
  /** Called with each fragment of the reply as it is generated. */
  onText: (delta: string) => void;
  signal: AbortSignal;
}

export interface CoachModelResult {
  text: string;
  /** Raw JSON arguments of the `suggest_actions` call, if the model made one. */
  suggestionArgs: string | null;
  inputTokens: number;
  outputTokens: number;
  /** The reply stopped early (output token limit). */
  truncated: boolean;
}

export interface CoachModel {
  readonly name: string;
  reply(request: CoachModelRequest): Promise<CoachModelResult>;
}

/** Thrown for provider failures; `status` is the provider's HTTP status, if any. */
export class CoachModelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'CoachModelError';
  }
}

const suggestActionsTool: FunctionTool = {
  type: 'function',
  name: 'suggest_actions',
  description:
    'Propose up to 3 concrete actions the user can add to their plan with one click. ' +
    'Call this only when a specific task, time block or habit would clearly help; never for general advice.',
  parameters: suggestActionsJsonSchema as unknown as Record<string, unknown>,
  strict: true,
};

class OpenAICoachModel implements CoachModel {
  private readonly client: OpenAI;

  constructor(apiKey: string, readonly name: string) {
    this.client = new OpenAI({ apiKey, maxRetries: 1, timeout: 60_000 });
  }

  async reply({ instructions, input, onText, signal }: CoachModelRequest): Promise<CoachModelResult> {
    try {
      const stream = this.client.responses.stream(
        {
          model: this.name,
          instructions,
          input,
          tools: [suggestActionsTool],
          parallel_tool_calls: false,
          reasoning: { effort: env.OPENAI_REASONING_EFFORT },
          max_output_tokens: env.AI_MAX_OUTPUT_TOKENS,
          // Don't keep users' data at the provider beyond the request.
          store: false,
        },
        { signal }
      );
      stream.on('response.output_text.delta', event => onText(event.delta));
      const response = await stream.finalResponse();

      const call = response.output.find(item => item.type === 'function_call' && item.name === 'suggest_actions');
      return {
        text: response.output_text,
        suggestionArgs: call?.type === 'function_call' ? call.arguments : null,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        truncated: response.status === 'incomplete',
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) throw new CoachModelError(error.message, error.status);
      throw error;
    }
  }
}

let override: CoachModel | null | undefined;

/** The configured model, or null when no API key is set. */
export function getCoachModel(): CoachModel | null {
  if (override !== undefined) return override;
  return env.OPENAI_API_KEY ? new OpenAICoachModel(env.OPENAI_API_KEY, env.OPENAI_MODEL) : null;
}

/** Tests only: replace the model (`undefined` restores the real one). */
export function setCoachModelForTests(model: CoachModel | null | undefined): void {
  override = model;
}
