// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Google Gemini client (REST, no SDK)
//
// The key travels in the x-goog-api-key header, never the URL, so it cannot
// leak into proxy/access logs. GEMINI_MODEL defaults to the rolling
// `gemini-flash-latest` alias: pinned versions get retired for new keys
// (gemini-2.5-flash already is), the alias keeps working.
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const { config } = require('../config/env');

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function isConfigured() {
  return !!config.ai.geminiApiKey;
}

// Thinking models spend "thought" tokens from the same maxOutputTokens budget,
// so a tight cap can end in MAX_TOKENS with no text at all. Keep thinking low
// (ops summaries don't need deep reasoning) and add headroom for it.
const THINKING_HEADROOM = 2048;
const RETRY_DELAYS_MS = [1000, 3000]; // 429 / 503 "high demand" are usually brief
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(model, body) {
  const url = `${BASE}/${encodeURIComponent(model)}:generateContent`;
  const opts = { headers: { 'x-goog-api-key': config.ai.geminiApiKey }, timeout: 45000 };
  for (let attempt = 0; ; attempt += 1) {
    try {
      return (await axios.post(url, body, opts)).data;
    } catch (err) {
      const status = err.response && err.response.status;
      if ((status === 429 || status === 503) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

/**
 * @returns {Promise<string>} the model's text reply
 * @param {object} opts { maxTokens, json } — json asks for application/json output
 */
async function generate(systemPrompt, userMessage, { maxTokens = 1024, json = false, temperature = 0.3 } = {}) {
  if (!isConfigured()) throw new Error('Gemini is not configured (GEMINI_API_KEY)');
  const model = config.ai.geminiModel || 'gemini-flash-latest';
  const body = {
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      maxOutputTokens: maxTokens + THINKING_HEADROOM,
      temperature,
      thinkingConfig: { thinkingLevel: 'low' },
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  let data;
  try {
    data = await post(model, body);
  } catch (err) {
    // A model without thinking controls rejects thinkingConfig with a 400 — retry plainly.
    const msg = JSON.stringify(err.response && err.response.data) || '';
    if (err.response && err.response.status === 400 && /thinking/i.test(msg)) {
      delete body.generationConfig.thinkingConfig;
      data = await post(model, body);
    } else {
      throw err;
    }
  }
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
  if (!text) throw new Error(`Gemini returned no text (finishReason=${data?.candidates?.[0]?.finishReason || 'unknown'})`);
  return text;
}

module.exports = { generate, isConfigured };
