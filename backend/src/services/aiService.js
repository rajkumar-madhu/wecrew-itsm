// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — AI Service (Ollama + Flowise)
// ═══════════════════════════════════════════════════════════

const axios = require('axios');
const { config } = require('../config/env');
const logger = require('../utils/logger');

// ── Ollama (Local LLM) ────────────────────────────────

async function ollamaGenerate(prompt, model = 'qwen3:32b', options = {}) {
  const url = config.ai.ollamaUrl;
  if (!url) throw new Error('OLLAMA_URL not configured');
  const { data } = await axios.post(`${url}/api/generate`, {
    model,
    prompt,
    stream: false,
    options: { temperature: 0.3, num_predict: 1024, ...options },
  }, { timeout: 120000 });
  return data.response;
}

async function ollamaChat(messages, model = 'qwen3:32b') {
  const url = config.ai.ollamaUrl;
  if (!url) throw new Error('OLLAMA_URL not configured');
  const { data } = await axios.post(`${url}/api/chat`, {
    model,
    messages,
    stream: false,
  }, { timeout: 120000 });
  return data.message;
}

async function ollamaEmbedding(text, model = 'nomic-embed-text') {
  const url = config.ai.ollamaUrl;
  if (!url) throw new Error('OLLAMA_URL not configured');
  const { data } = await axios.post(`${url}/api/embed`, {
    model,
    input: text,
  }, { timeout: 30000 });
  return data.embeddings;
}

// ── Flowise (AI Chatflow) ──────────────────────────────

async function flowisePredict(chatflowId, question, overrideConfig = {}) {
  const url = config.ai.flowiseUrl;
  if (!url) throw new Error('FLOWISE_URL not configured');
  const { data } = await axios.post(`${url}/api/v1/prediction/${chatflowId}`, {
    question,
    overrideConfig,
  }, { timeout: 60000 });
  return data;
}

// ── HuggingFace TEI (Text Embeddings Inference) ────────

async function hfEmbedding(text) {
  const url = config.ai.hfTeiUrl;
  if (!url) throw new Error('HF_TEI_URL not configured');
  const { data } = await axios.post(`${url}/embed`, {
    inputs: text,
  }, { timeout: 30000 });
  return data;
}

// ── Incident Intelligence ──────────────────────────────

async function suggestRootCause(incident) {
  const prompt = `You are an ITSM expert analyzing incidents. Based on the following incident, suggest the most likely root cause and recommended resolution steps.

Incident: ${incident.number}
Priority: ${incident.priority}
Description: ${incident.shortDescription}
Details: ${incident.description || 'N/A'}
Category: ${incident.category || 'N/A'}
Config Item: ${incident.configItem?.name || 'N/A'}

Provide:
1. Most likely root cause (1-2 sentences)
2. Recommended diagnostic steps (3-5 bullet points)
3. Suggested resolution (2-3 bullet points)`;

  return ollamaGenerate(prompt);
}

async function classifyIncident(description) {
  const prompt = `Classify the following IT incident into a category and suggest impact/urgency.

Description: "${description}"

Respond in JSON format:
{
  "category": "<Hardware|Software|Network|Database|Security|Cloud Infrastructure|Application|Monitoring|Access Management|Other>",
  "suggestedImpact": "<ENTERPRISE|DEPARTMENT|TEAM|INDIVIDUAL>",
  "suggestedUrgency": "<CRITICAL|HIGH|MEDIUM|LOW>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;

  const response = await ollamaGenerate(prompt);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response };
  } catch {
    return { raw: response };
  }
}

async function summarizeIncidentTimeline(activities) {
  const timeline = activities.map((a) => `[${a.createdAt}] ${a.action}: ${a.description}`).join('\n');
  const prompt = `Summarize the following incident timeline into a brief executive summary (3-5 sentences):

${timeline}`;

  return ollamaGenerate(prompt);
}

async function suggestSimilarIncidents(incident) {
  const prompt = `Given this incident description, generate 3 search queries that would help find similar past incidents in an ITSM system:

"${incident.shortDescription}"
${incident.description || ''}

Return as a JSON array of strings.`;

  const response = await ollamaGenerate(prompt);
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return [];
  }
}

// ── Health Check ───────────────────────────────────────

async function healthCheck() {
  const results = {};

  // Ollama
  try {
    const url = config.ai.ollamaUrl;
    if (!url) { results.ollama = { healthy: false, message: 'Not configured' }; }
    else {
      const { data } = await axios.get(`${url}/api/tags`, { timeout: 5000 });
      results.ollama = { healthy: true, models: (data.models || []).map((m) => m.name) };
    }
  } catch (err) {
    results.ollama = { healthy: false, message: err.message };
  }

  // Flowise
  try {
    const url = config.ai.flowiseUrl;
    if (!url) { results.flowise = { healthy: false, message: 'Not configured' }; }
    else {
      await axios.get(`${url}/api/v1/ping`, { timeout: 5000 });
      results.flowise = { healthy: true };
    }
  } catch (err) {
    results.flowise = { healthy: false, message: err.message };
  }

  return results;
}

module.exports = {
  ollamaGenerate, ollamaChat, ollamaEmbedding,
  flowisePredict, hfEmbedding,
  suggestRootCause, classifyIncident, summarizeIncidentTimeline, suggestSimilarIncidents,
  healthCheck,
};
