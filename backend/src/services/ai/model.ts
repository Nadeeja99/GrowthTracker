// The language model behind the AI features, behind a small interface so
// routes don't depend on the provider and tests can substitute a fake.
import OpenAI from 'openai';
import { env } from '../../config/env';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** A function the model may call; its arguments come back as raw JSON. */
export interface ToolDefinition {
  name: string;
  description: string;
  /** Strict JSON Schema (every property required, no extra properties). */
  parameters: Record<string, unknown>;
}

export interface ReplyRequest {
  instructions: string;
  input: ChatTurn[];
  tool?: ToolDefinition;
  /** Called with each fragment of the reply as it is generated. */
  onText: (delta: string) => void;
  signal: AbortSignal;
}

export interface ReplyResult {
  text: string;
  /** Raw JSON arguments of the tool call, if the model made one. */
  toolArgs: string | null;
  inputTokens: number;
  outputTokens: number;
  /** The reply stopped early (output token limit). */
  truncated: boolean;
}

export interface GenerateRequest {
  instructions: string;
  input: string;
  /** Name and strict JSON Schema the output must follow. */
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface GenerateResult {
  /** The JSON document the model produced (unvalidated). */
  json: string;
  inputTokens: number;
  outputTokens: number;
  truncated: boolean;
}

export interface AiModel {
  readonly name: string;
  /** A streamed chat reply, optionally with a tool call. */
  reply(request: ReplyRequest): Promise<ReplyResult>;
  /** A single JSON document matching a schema (structured output). */
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

/** Thrown for provider failures; `status` is the provider's HTTP status, if any. */
export class AiModelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AiModelError';
  }
}

class OpenAIModel implements AiModel {
  private readonly client: OpenAI;

  constructor(apiKey: string, readonly name: string) {
    this.client = new OpenAI({ apiKey, maxRetries: 1, timeout: 90_000 });
  }

  // Shared request settings. `store: false` keeps users' data out of the
  // provider's response storage.
  private get common() {
    return { model: this.name, reasoning: { effort: env.OPENAI_REASONING_EFFORT }, store: false } as const;
  }

  async reply({ instructions, input, tool, onText, signal }: ReplyRequest): Promise<ReplyResult> {
    return this.call(async () => {
      const stream = this.client.responses.stream(
        {
          ...this.common,
          instructions,
          input,
          tools: tool ? [{ type: 'function', strict: true, ...tool }] : undefined,
          parallel_tool_calls: tool ? false : undefined,
          max_output_tokens: env.AI_MAX_OUTPUT_TOKENS,
        },
        { signal }
      );
      stream.on('response.output_text.delta', event => onText(event.delta));
      const response = await stream.finalResponse();

      const call = response.output.find(item => item.type === 'function_call' && item.name === tool?.name);
      return {
        text: response.output_text,
        toolArgs: call?.type === 'function_call' ? call.arguments : null,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        truncated: response.status === 'incomplete',
      };
    });
  }

  async generate({ instructions, input, schemaName, schema, maxOutputTokens, signal }: GenerateRequest): Promise<GenerateResult> {
    return this.call(async () => {
      const response = await this.client.responses.create(
        {
          ...this.common,
          instructions,
          input,
          text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
          max_output_tokens: maxOutputTokens,
        },
        { signal }
      );
      return {
        json: response.output_text,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        truncated: response.status === 'incomplete',
      };
    });
  }

  private async call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof OpenAI.APIError) throw new AiModelError(error.message, error.status);
      throw error;
    }
  }
}

let override: AiModel | null | undefined;

/** The configured model, or null when no API key is set. */
export function getAiModel(): AiModel | null {
  if (override !== undefined) return override;
  return env.OPENAI_API_KEY ? new OpenAIModel(env.OPENAI_API_KEY, env.OPENAI_MODEL) : null;
}

/** Tests only: replace the model (`undefined` restores the real one). */
export function setAiModelForTests(model: AiModel | null | undefined): void {
  override = model;
}

/** A message that is safe to show users for a failed AI call. */
export function friendlyAiError(error: unknown): string {
  if (error instanceof AiModelError) {
    if (error.status === 429) return 'The AI service is busy right now. Please try again in a minute.';
    if (error.status === 401 || error.status === 403) return 'AI features are temporarily unavailable.';
  }
  return 'The AI couldn’t answer just now. Please try again.';
}
