const mockPost = jest.fn();
jest.mock('axios', () => ({ post: (...a) => mockPost(...a) }));
jest.mock('../../config/env', () => ({ config: { ai: { geminiApiKey: 'test-key-123', geminiModel: 'gemini-flash-latest' } } }));

const gemini = require('../geminiService');

it('sends the key in a header, never the URL, and returns the text', async () => {
  mockPost.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: ' {"ok":true} ' }] } }] } });
  const out = await gemini.generate('sys', 'hello', { json: true, maxTokens: 50 });
  expect(out).toBe('{"ok":true}');
  const [url, body, opts] = mockPost.mock.calls[0];
  expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
  expect(url).not.toContain('test-key-123');
  expect(opts.headers['x-goog-api-key']).toBe('test-key-123');
  expect(body.generationConfig).toMatchObject({ maxOutputTokens: 50 + 2048, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } });
  expect(body.systemInstruction.parts[0].text).toBe('sys');
});

it('throws when the model returns no text', async () => {
  mockPost.mockResolvedValue({ data: { candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] } });
  await expect(gemini.generate('s', 'u')).rejects.toThrow(/SAFETY/);
});

it('retries a 503 "high demand" and succeeds', async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  mockPost
    .mockRejectedValueOnce({ response: { status: 503, data: {} } })
    .mockResolvedValueOnce({ data: { candidates: [{ content: { parts: [{ text: 'OK' }] } }] } });
  const p = gemini.generate('s', 'u');
  await jest.advanceTimersByTimeAsync(1000);
  await expect(p).resolves.toBe('OK');
  jest.useRealTimers();
});

it('drops thinkingConfig when the model rejects it', async () => {
  mockPost
    .mockRejectedValueOnce({ response: { status: 400, data: { error: { message: 'thinking_config is not supported' } } } })
    .mockResolvedValueOnce({ data: { candidates: [{ content: { parts: [{ text: 'OK' }] } }] } });
  await expect(gemini.generate('s', 'u')).resolves.toBe('OK');
  expect(mockPost.mock.calls.at(-1)[1].generationConfig.thinkingConfig).toBeUndefined();
});

it('ignores thought parts in the reply', async () => {
  mockPost.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: 'Answer' }] } }] } });
  await expect(gemini.generate('s', 'u')).resolves.toBe('Answer');
});
