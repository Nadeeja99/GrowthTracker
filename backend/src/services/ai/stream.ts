// Server-Sent Events for replies that are written as they are generated.
import { Response } from 'express';

/** Starts the stream and returns the function that sends each event. */
export function openEventStream(res: Response) {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform also stops the compression middleware from buffering the stream.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  return (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Stops generating (and paying for) a reply nobody will read. */
export function abortWhenClientLeaves(res: Response): AbortController {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller;
}
