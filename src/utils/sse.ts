export interface ServerSentEvent<T = unknown> {
  type: string;
  data: T;
}

/**
 * Reads an SSE response without assuming network chunks end on event boundaries.
 * A JSON event may be split across several reads, especially on slower networks.
 */
export async function consumeEventStream(
  response: Response,
  onEvent: (event: ServerSentEvent) => void
): Promise<void> {
  if (!response.body) {
    throw new Error('Streaming responses are not supported in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processEvent = (rawEvent: string) => {
    const data = rawEvent
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n')
      .trim();
    if (!data || data === '[DONE]') return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error('The server returned an invalid streaming response.');
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      typeof parsed.type === 'string' &&
      'data' in parsed
    ) {
      onEvent(parsed as ServerSentEvent);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || '';
    events.forEach(processEvent);

    if (done) break;
  }

  if (buffer.trim()) processEvent(buffer);
}
