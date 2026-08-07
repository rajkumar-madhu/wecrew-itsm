// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Problem Management Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { emitToAll } = require('../config/socket');
const { generateProblemNumber, paginate, paginationMeta, success, error } = require('../utils/helpers');
const { PROBLEM_TRANSITIONS } = require('../config/constants');
const logger = require('../utils/logger');
const { getCreateOrgId } = require('../middleware/tenant');
const { ollamaGenerate } = require('../services/aiService');
const { ALERT_KB, getAlertKB } = require('./alert.controller');

// Map frontend state names to Prisma enum values (handles both conventions)
const STATE_MAP = {
  INVESTIGATING: 'INVESTIGATION',
  ROOT_CAUSE_IDENTIFIED: 'RCA_IN_PROGRESS',
};
function mapState(s) { return STATE_MAP[s] || s; }

const INCLUDE_LIST = {
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
  assignmentGroup: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

const INCLUDE_DETAIL = {
  ...INCLUDE_LIST,
  workNotes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
  activities: { include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 50 },
  attachments: { orderBy: { createdAt: 'desc' } },
  linkedIncidents: { include: { incident: { select: { id: true, number: true, shortDescription: true, state: true, priority: true } } } },
};

// GET /api/v1/problems
async function listProblems(req, res, next) {
  try {
    const { state, priority, category, isKnownError, assignedToId, search, sortBy, sortOrder } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const where = {};
    Object.assign(where, req.tenantWhere);
    if (state) where.state = mapState(state);
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (isKnownError !== undefined) where.isKnownError = isKnownError === 'true';
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.OR = [
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = sortBy ? { [sortBy]: sortOrder || 'desc' } : { createdAt: 'desc' };

    const [problems, total] = await prisma.$transaction([
      prisma.problem.findMany({ where, include: INCLUDE_LIST, orderBy, skip, take }),
      prisma.problem.count({ where }),
    ]);

    return success(res, problems, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// GET /api/v1/problems/:id
async function getProblem(req, res, next) {
  try {
    const problem = await prisma.problem.findUnique({ where: { id: req.params.id }, include: INCLUDE_DETAIL });
    if (!problem) return error(res, 'Problem not found', 404);
    if (req.tenantWhere.organizationId && problem.organizationId !== req.tenantWhere.organizationId) return error(res, 'Problem not found', 404);
    return success(res, problem);
  } catch (err) { next(err); }
}

// POST /api/v1/problems
async function createProblem(req, res, next) {
  try {
    const { shortDescription, description, priority, category, assignmentGroupId, assignedToId } = req.body;
    const number = await generateProblemNumber();

    const problem = await prisma.problem.create({
      data: {
        number, shortDescription, description,
        priority: priority || 'P4', category,
        assignmentGroupId, assignedToId, createdById: req.user.id,
        organizationId: getCreateOrgId(req),
      },
      include: INCLUDE_LIST,
    });

    await prisma.activity.create({
      data: { action: 'CREATED', description: `Problem ${number} created`, userId: req.user.id, problemId: problem.id },
    });

    emitToAll('problem:created', { id: problem.id, number, shortDescription });
    logger.info(`Problem created: ${number} by ${req.user.email}`);
    return success(res, problem, 201);
  } catch (err) { next(err); }
}

// PATCH /api/v1/problems/:id
async function updateProblem(req, res, next) {
  try {
    const existing = await prisma.problem.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Problem not found', 404);
    if (req.tenantWhere.organizationId && existing.organizationId !== req.tenantWhere.organizationId) return error(res, 'Problem not found', 404);

    // Map frontend state names to schema values
    if (req.body.state) req.body.state = mapState(req.body.state);

    if (req.body.state && req.body.state !== existing.state) {
      const allowed = PROBLEM_TRANSITIONS[existing.state] || [];
      if (!allowed.includes(req.body.state)) {
        return error(res, `Cannot transition from ${existing.state} to ${req.body.state}`, 400);
      }
    }

    const data = { ...req.body };
    if (data.state === 'KNOWN_ERROR') data.isKnownError = true;

    const problem = await prisma.problem.update({ where: { id: req.params.id }, data, include: INCLUDE_LIST });

    if (req.body.state && req.body.state !== existing.state) {
      await prisma.activity.create({
        data: { action: 'STATE_CHANGED', description: `State: ${existing.state} → ${req.body.state}`, oldValue: existing.state, newValue: req.body.state, userId: req.user.id, problemId: problem.id },
      });
    }

    emitToAll('problem:updated', { id: problem.id, number: problem.number, state: problem.state });
    return success(res, problem);
  } catch (err) { next(err); }
}

// PATCH /api/v1/problems/:id/rca
async function updateRCA(req, res, next) {
  try {
    const { rootCause, rootCauseAnalysis, workaround, workaroundEffective, permanentFix } = req.body;
    const problem = await prisma.problem.update({
      where: { id: req.params.id },
      data: { rootCause, rootCauseAnalysis, workaround, workaroundEffective, permanentFix },
      include: INCLUDE_LIST,
    });

    await prisma.activity.create({
      data: { action: 'RCA_UPDATED', description: 'Root cause analysis updated', userId: req.user.id, problemId: problem.id },
    });

    return success(res, problem);
  } catch (err) { next(err); }
}

// POST /api/v1/problems/:id/notes
async function addWorkNote(req, res, next) {
  try {
    const { content, isInternal } = req.body;
    const note = await prisma.workNote.create({
      data: { content, isInternal: isInternal || false, authorId: req.user.id, problemId: req.params.id },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
    return success(res, note, 201);
  } catch (err) { next(err); }
}

// POST /api/v1/problems/:id/ai-rca — AI-powered root cause suggestion
async function aiRCA(req, res, next) {
  try {
    const problem = await prisma.problem.findUnique({
      where: { id: req.params.id },
      include: {
        linkedIncidents: {
          include: {
            incident: {
              select: { id: true, number: true, shortDescription: true, description: true, priority: true, state: true, alertName: true, labels: true },
            },
          },
        },
        assignmentGroup: { select: { name: true } },
      },
    });
    if (!problem) return error(res, 'Problem not found', 404);
    if (req.tenantWhere?.organizationId && problem.organizationId !== req.tenantWhere.organizationId) {
      return error(res, 'Problem not found', 404);
    }

    // Gather alert KB matches from linked incidents
    const kbMatches = [];
    const incidents = problem.linkedIncidents.map(li => li.incident).filter(Boolean);
    for (const inc of incidents) {
      const alertName = inc.alertName || inc.shortDescription || '';
      const kb = getAlertKB(alertName);
      if (kb) kbMatches.push({ alertName, kb });
    }

    // Build the AI prompt with full context
    const incidentSummaries = incidents.map(inc =>
      `- ${inc.number}: ${inc.shortDescription} (Priority: ${inc.priority}, State: ${inc.state})`
    ).join('\n');

    const kbContext = kbMatches.map(m =>
      `Alert: ${m.alertName}\n  Category: ${m.kb.cat}\n  Known root causes: ${m.kb.rootCause.join('; ')}\n  Investigation: ${m.kb.investigate.slice(0, 3).join('; ')}\n  Remediation: ${m.kb.remediate.slice(0, 3).join('; ')}`
    ).join('\n\n');

    const prompt = `You are an expert ITSM root cause analyst. Analyze this problem record and its linked incidents to determine the most likely root cause.

PROBLEM: ${problem.number}
Title: ${problem.shortDescription}
Description: ${problem.description || 'N/A'}
Category: ${problem.category || 'Unknown'}
Priority: ${problem.priority}

LINKED INCIDENTS (${incidents.length}):
${incidentSummaries || 'No linked incidents'}

KNOWLEDGE BASE MATCHES:
${kbContext || 'No KB matches found'}

Based on this information, provide a structured root cause analysis in the following JSON format:
{
  "category": "Hardware|Software|Network|Database|Security|Cloud|Infrastructure|Application|Configuration|Human Error",
  "rootCause": "Clear description of the most likely root cause",
  "evidence": ["Evidence point 1", "Evidence point 2", "Evidence point 3"],
  "workaround": "Suggested temporary workaround if applicable",
  "permanentFix": "Suggested permanent fix",
  "confidence": 75,
  "relatedKBEntries": ["kb_key_1", "kb_key_2"]
}

Return ONLY valid JSON, no additional text.`;

    let response;
    try {
      response = await ollamaGenerate(prompt, 'qwen3:32b', { temperature: 0.3 });
    } catch (aiErr) {
      logger.warn(`AI RCA generation failed for ${problem.number}: ${aiErr.message}`);
      // Fallback: build RCA from KB matches without AI
      if (kbMatches.length > 0) {
        const firstKB = kbMatches[0];
        response = JSON.stringify({
          category: firstKB.kb.cat,
          rootCause: firstKB.kb.rootCause[0],
          evidence: firstKB.kb.rootCause,
          workaround: firstKB.kb.remediate[0] || '',
          permanentFix: firstKB.kb.remediate.slice(-1)[0] || '',
          confidence: 50,
          relatedKBEntries: kbMatches.map(m => m.alertName),
        });
      } else {
        return error(res, 'AI service unavailable and no KB matches found', 503);
      }
    }

    // Parse the AI response
    let rca;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      rca = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (parseErr) {
      rca = { category: 'Unknown', rootCause: response, evidence: [], workaround: '', permanentFix: '', confidence: 30, relatedKBEntries: [] };
    }

    if (!rca) return error(res, 'Failed to parse AI response', 500);

    // Enrich with KB entries
    rca.kbDetails = kbMatches.map(m => ({
      alertName: m.alertName,
      category: m.kb.cat,
      rootCauses: m.kb.rootCause,
      investigate: m.kb.investigate,
      remediate: m.kb.remediate,
      escalation: m.kb.escalation,
      blastRadius: m.kb.blast,
    }));

    // Save to problem's rootCauseAnalysis JSON field
    await prisma.problem.update({
      where: { id: req.params.id },
      data: { rootCauseAnalysis: rca },
    });

    await prisma.activity.create({
      data: { action: 'AI_RCA', description: `AI root cause analysis performed (confidence: ${rca.confidence}%)`, userId: req.user.id, problemId: problem.id },
    });

    logger.info(`AI RCA for ${problem.number}: category=${rca.category}, confidence=${rca.confidence}%`);
    return success(res, rca);
  } catch (err) { next(err); }
}

// GET /api/v1/problems/stats — problem state counts for pipeline visualization
async function getProblemStats(req, res, next) {
  try {
    const where = {};
    Object.assign(where, req.tenantWhere);

    const states = ['NEW', 'INVESTIGATION', 'RCA_IN_PROGRESS', 'KNOWN_ERROR', 'RESOLVED', 'CLOSED'];
    const counts = {};
    for (const state of states) {
      counts[state] = await prisma.problem.count({ where: { ...where, state } });
    }

    // Known error problems with workarounds (for KEDB section)
    const knownErrors = await prisma.problem.findMany({
      where: { ...where, state: 'KNOWN_ERROR' },
      select: { id: true, number: true, shortDescription: true, workaround: true, category: true, priority: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return success(res, { stateCounts: counts, knownErrors });
  } catch (err) { next(err); }
}

module.exports = { listProblems, getProblem, createProblem, updateProblem, updateRCA, addWorkNote, aiRCA, getProblemStats };
