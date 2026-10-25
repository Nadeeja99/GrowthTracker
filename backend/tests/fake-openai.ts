// A local stand-in for the OpenAI Responses API that streams a scripted reply
// in the real event format. It lets the tests run the actual SDK code path
// without a network connection or an API key.
import http from 'http';
import { AddressInfo } from 'net';

export interface Script {
  /** Text fragments streamed as output_text deltas. */
  text?: string[];
  /** JSON arguments for a suggest_actions call. */
  toolArgs?: string;
  status?: 'completed' | 'incomplete';
  /** Respond with this HTTP error instead of a stream. */
  httpError?: number;
  /** Pause between text deltas, to make streaming visible. */
  delayMs?: number;
}

export interface FakeOpenAI {
  url: string;
  requests: Array<{ headers: http.IncomingHttpHeaders; body: Record<string, unknown> }>;
  /** A fixed script, or one computed from each request body. */
  script: Script | ((body: Record<string, unknown>) => Script);
  close: () => Promise<void>;
}

export async function startFakeOpenAI(port = 0): Promise<FakeOpenAI> {
  const fake = { requests: [], script: {} } as unknown as FakeOpenAI;

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      fake.requests.push({ headers: req.headers, body });
      const script = typeof fake.script === 'function' ? fake.script(body) : fake.script;
      const { text = [], toolArgs, status = 'completed', httpError, delayMs = 0 } = script;

      if (httpError) {
        res.writeHead(httpError, { 'Content-Type': 'application/json', 'retry-after-ms': '1' });
        res.end(JSON.stringify({ error: { message: 'Simulated provider error', type: 'error', code: null } }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      let seq = 0;
      const frames: Array<{ frame: string; pause: boolean }> = [];
      const send = (type: string, data: object) => frames.push({
        frame: `event: ${type}\ndata: ${JSON.stringify({ type, sequence_number: seq++, ...data })}\n\n`,
        pause: type === 'response.output_text.delta',
      });

      const fullText = text.join('');
      const message = (state: string, content: object[]) =>
        ({ id: 'msg_1', type: 'message', role: 'assistant', status: state, content });
      const part = (t: string) => ({ type: 'output_text', text: t, annotations: [], logprobs: [] });
      const call = (state: string, args: string) =>
        ({ id: 'fc_1', type: 'function_call', call_id: 'call_1', name: 'suggest_actions', arguments: args, status: state });
      const response = (state: string, output: object[]) => ({
        id: 'resp_1', object: 'response', created_at: Math.floor(Date.now() / 1000), status: state,
        model: 'fake-model', output, error: null,
        incomplete_details: state === 'incomplete' ? { reason: 'max_output_tokens' } : null,
        instructions: null, metadata: {}, parallel_tool_calls: false, temperature: null, top_p: null,
        tool_choice: 'auto', tools: [], text: { format: { type: 'text' } },
        usage: state === 'in_progress' ? null : {
          input_tokens: 1200, input_tokens_details: { cached_tokens: 0 },
          output_tokens: 90, output_tokens_details: { reasoning_tokens: 10 }, total_tokens: 1290,
        },
      });

      send('response.created', { response: response('in_progress', []) });
      send('response.output_item.added', { output_index: 0, item: message('in_progress', []) });
      send('response.content_part.added', { item_id: 'msg_1', output_index: 0, content_index: 0, part: part('') });
      for (const delta of text) {
        send('response.output_text.delta', { item_id: 'msg_1', output_index: 0, content_index: 0, delta, logprobs: [] });
      }
      send('response.output_text.done', { item_id: 'msg_1', output_index: 0, content_index: 0, text: fullText, logprobs: [] });
      send('response.content_part.done', { item_id: 'msg_1', output_index: 0, content_index: 0, part: part(fullText) });
      send('response.output_item.done', { output_index: 0, item: message('completed', [part(fullText)]) });
      const output: object[] = [message('completed', [part(fullText)])];

      if (toolArgs) {
        send('response.output_item.added', { output_index: 1, item: call('in_progress', '') });
        send('response.function_call_arguments.delta', { item_id: 'fc_1', output_index: 1, delta: toolArgs });
        send('response.function_call_arguments.done', { item_id: 'fc_1', output_index: 1, name: 'suggest_actions', arguments: toolArgs });
        send('response.output_item.done', { output_index: 1, item: call('completed', toolArgs) });
        output.push(call('completed', toolArgs));
      }

      send(status === 'completed' ? 'response.completed' : 'response.incomplete', { response: response(status, output) });

      (async () => {
        for (const { frame, pause } of frames) {
          if (pause && delayMs) await new Promise(r => setTimeout(r, delayMs));
          res.write(frame);
        }
        res.end();
      })();
    });
  });

  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  fake.close = () => new Promise(resolve => server.close(() => resolve()));
  return fake;
}

/** Parses a Server-Sent Events body into { event, data } pairs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payloads differ per event; tests assert on them
export function parseSse(body: string): Array<{ event: string; data: any }> {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map(chunk => {
      const event = /^event: (.*)$/m.exec(chunk)?.[1] ?? 'message';
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      return { event, data: data ? JSON.parse(data) : null };
    });
}
