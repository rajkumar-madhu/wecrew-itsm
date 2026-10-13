// ═══════════════════════════════════════════════════════════
// Argus ITSM — CMDB relationships
// A row (parent, child, type) reads "parent <type> child":
//   payments-api DEPENDS_ON postgres-01 · payments-api RUNS_ON node-3 · node-3 HOSTS payments-api
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const { scopedWhere } = require('../middleware/tenant');
const logger = require('../utils/logger');

const TYPES = ['DEPENDS_ON', 'RUNS_ON', 'HOSTS', 'CONNECTS_TO', 'PART_OF'];
const CI_BRIEF = { select: { id: true, name: true, type: true, status: true } };
const MAX_DEPTH = 4;
const MAX_NODES = 200;

async function scopedCI(req, id) {
  return prisma.configurationItem.findFirst({ where: { ...scopedWhere(req), id }, select: { id: true, name: true, organizationId: true } });
}

// Items that break when `id` breaks: things that depend on, run on or are part of it,
// and things it hosts.
async function impactedBy(ids) {
  const [dependents, hosted] = await Promise.all([
    prisma.cIRelationship.findMany({ where: { childId: { in: ids }, type: { in: ['DEPENDS_ON', 'RUNS_ON', 'PART_OF'] } }, select: { parentId: true, childId: true, type: true } }),
    prisma.cIRelationship.findMany({ where: { parentId: { in: ids }, type: 'HOSTS' }, select: { parentId: true, childId: true, type: true } }),
  ]);
  return [
    ...dependents.map((r) => ({ from: r.childId, to: r.parentId, type: r.type })),
    ...hosted.map((r) => ({ from: r.parentId, to: r.childId, type: r.type })),
  ];
}

// GET /assets/:id/relationships
async function getRelationships(req, res) {
  try {
    const ci = await scopedCI(req, req.params.id);
    if (!ci) return error(res, 'Asset not found', 404);

    const [outgoing, incoming] = await Promise.all([
      prisma.cIRelationship.findMany({ where: { parentId: ci.id }, include: { child: CI_BRIEF }, orderBy: { type: 'asc' } }),
      prisma.cIRelationship.findMany({ where: { childId: ci.id }, include: { parent: CI_BRIEF }, orderBy: { type: 'asc' } }),
    ]);

    // Breadth-first impact walk: what goes down if this item goes down
    const seen = new Set([ci.id]);
    const impact = [];
    let frontier = [ci.id];
    for (let depth = 1; depth <= MAX_DEPTH && frontier.length && seen.size < MAX_NODES; depth++) {
      const edges = await impactedBy(frontier);
      const next = [];
      for (const e of edges) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        next.push(e.to);
        impact.push({ id: e.to, via: e.from, type: e.type, depth });
      }
      frontier = next;
    }
    const impactedCIs = impact.length
      ? await prisma.configurationItem.findMany({ where: { id: { in: impact.map((i) => i.id) } }, ...CI_BRIEF })
      : [];
    const byId = Object.fromEntries(impactedCIs.map((c) => [c.id, c]));

    return success(res, {
      outgoing: outgoing.map((r) => ({ id: r.id, type: r.type, ci: r.child })),
      incoming: incoming.map((r) => ({ id: r.id, type: r.type, ci: r.parent })),
      impact: impact.filter((i) => byId[i.id]).map((i) => ({ ...i, ci: byId[i.id] })),
    });
  } catch (err) {
    logger.error('getRelationships failed:', err);
    return error(res, 'Failed to load relationships', 500);
  }
}

// POST /assets/:id/relationships { targetId, type, direction: 'outgoing' | 'incoming' }
async function addRelationship(req, res) {
  try {
    const { targetId, type, direction = 'outgoing' } = req.body;
    if (!TYPES.includes(type)) return error(res, `type must be one of ${TYPES.join(', ')}`, 400);
    if (!['outgoing', 'incoming'].includes(direction)) return error(res, 'direction must be outgoing or incoming', 400);
    if (!targetId || targetId === req.params.id) return error(res, 'Pick a different asset to relate to', 400);
    const [ci, target] = await Promise.all([scopedCI(req, req.params.id), scopedCI(req, targetId)]);
    if (!ci || !target) return error(res, 'Asset not found', 404);
    if (ci.organizationId !== target.organizationId) return error(res, 'Both assets must belong to the same organization', 400);

    const parentId = direction === 'outgoing' ? ci.id : target.id;
    const childId = direction === 'outgoing' ? target.id : ci.id;
    const existing = await prisma.cIRelationship.findUnique({ where: { parentId_childId_type: { parentId, childId, type } } });
    if (existing) return error(res, 'That relationship already exists', 409);
    const rel = await prisma.cIRelationship.create({ data: { parentId, childId, type, organizationId: ci.organizationId } });
    return success(res, rel, 201);
  } catch (err) {
    logger.error('addRelationship failed:', err);
    return error(res, 'Failed to add the relationship', 500);
  }
}

// DELETE /assets/:id/relationships/:relId
async function removeRelationship(req, res) {
  try {
    const ci = await scopedCI(req, req.params.id);
    if (!ci) return error(res, 'Asset not found', 404);
    const rel = await prisma.cIRelationship.findFirst({
      where: { id: req.params.relId, OR: [{ parentId: ci.id }, { childId: ci.id }] },
      select: { id: true },
    });
    if (!rel) return error(res, 'Relationship not found', 404);
    await prisma.cIRelationship.delete({ where: { id: rel.id } });
    return success(res, { id: rel.id });
  } catch (err) {
    logger.error('removeRelationship failed:', err);
    return error(res, 'Failed to remove the relationship', 500);
  }
}

module.exports = { getRelationships, addRelationship, removeRelationship, TYPES };
