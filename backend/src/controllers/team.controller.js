// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Team Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { paginate, paginationMeta, success, error } = require('../utils/helpers');
const { getCreateOrgId } = require('../middleware/tenant');
const logger = require('../utils/logger');

// GET /api/v1/teams
async function listTeams(req, res, next) {
  try {
    const { search, isActive } = req.query;
    const { skip, take, page, limit } = paginate(req.query.page, req.query.limit);

    const where = {};
    Object.assign(where, req.tenantWhere);
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [teams, total] = await prisma.$transaction([
      prisma.team.findMany({
        where, skip, take, orderBy: { name: 'asc' },
        include: {
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
          members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } } },
          _count: { select: { assignedIncidents: true, assignedChanges: true } },
        },
      }),
      prisma.team.count({ where }),
    ]);

    return success(res, teams, 200, paginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

// GET /api/v1/teams/:id
async function getTeam(req, res, next) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true, skills: true } } } },
        onCallSchedules: { where: { endTime: { gte: new Date() } }, include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } }, orderBy: { startTime: 'asc' } },
        escalationPolicies: { where: { isActive: true }, include: { rules: { orderBy: { level: 'asc' } } } },
        _count: { select: { assignedIncidents: true, assignedChanges: true, assignedProblems: true } },
      },
    });
    if (!team) return error(res, 'Team not found', 404);
    if (req.tenantWhere?.organizationId && team.organizationId !== req.tenantWhere.organizationId) return error(res, 'Team not found', 404);
    return success(res, team);
  } catch (err) { next(err); }
}

// POST /api/v1/teams
async function createTeam(req, res, next) {
  try {
    const { name, description, email, slackChannel, managerId } = req.body;
    const team = await prisma.team.create({
      data: { name, description, email, slackChannel, managerId, organizationId: getCreateOrgId(req) },
    });
    return success(res, team, 201);
  } catch (err) { next(err); }
}

// PATCH /api/v1/teams/:id
async function updateTeam(req, res, next) {
  try {
    const team = await prisma.team.update({ where: { id: req.params.id }, data: req.body });
    return success(res, team);
  } catch (err) { next(err); }
}

// POST /api/v1/teams/:id/members
async function addMember(req, res, next) {
  try {
    const { userId, role } = req.body;
    const member = await prisma.teamMember.create({
      data: { teamId: req.params.id, userId, role: role || 'MEMBER' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    return success(res, member, 201);
  } catch (err) { next(err); }
}

// DELETE /api/v1/teams/:id/members/:userId
async function removeMember(req, res, next) {
  try {
    await prisma.teamMember.deleteMany({ where: { teamId: req.params.id, userId: req.params.userId } });
    return success(res, { message: 'Member removed' });
  } catch (err) { next(err); }
}

// GET /api/v1/teams/:id/on-call
async function getOnCall(req, res, next) {
  try {
    const now = new Date();
    const onCall = await prisma.onCallSchedule.findMany({
      where: { teamId: req.params.id, startTime: { lte: now }, endTime: { gte: now } },
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } },
      orderBy: { isPrimary: 'desc' },
    });
    return success(res, onCall);
  } catch (err) { next(err); }
}

// GET /api/v1/teams/on-call/overview — all teams' active on-call responders
async function getOnCallOverview(req, res, next) {
  try {
    const now = new Date();
    const where = { startTime: { lte: now }, endTime: { gte: now } };

    // If tenant-scoped, filter by team org
    const teamWhere = {};
    Object.assign(teamWhere, req.tenantWhere);

    const schedules = await prisma.onCallSchedule.findMany({
      where: {
        ...where,
        team: teamWhere,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { startTime: 'asc' }],
    });

    // Aggregate stats
    const teamsCovered = new Set(schedules.map(s => s.teamId)).size;
    const activeResponders = new Set(schedules.map(s => s.userId)).size;

    // Get open P1/P2 incident count
    const openCritical = await prisma.incident.count({
      where: {
        ...req.tenantWhere,
        state: { in: ['NEW', 'IN_PROGRESS', 'ON_HOLD'] },
        priority: { in: ['P1', 'P2'] },
      },
    });

    return success(res, {
      schedules,
      stats: { activeResponders, teamsCovered, openCritical, totalSchedules: schedules.length },
    });
  } catch (err) { next(err); }
}

// GET /api/v1/teams/:id/escalation — escalation policies + rules for a team
async function getEscalationPolicies(req, res, next) {
  try {
    const policies = await prisma.escalationPolicy.findMany({
      where: { teamId: req.params.id },
      include: {
        rules: { orderBy: { level: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return success(res, policies);
  } catch (err) { next(err); }
}

// POST /api/v1/teams/:id/on-call — create/update on-call schedule
async function createOnCallSchedule(req, res, next) {
  try {
    const { userId, startTime, endTime, isPrimary } = req.body;
    if (!userId || !startTime || !endTime) {
      return error(res, 'userId, startTime, and endTime are required', 400);
    }

    const schedule = await prisma.onCallSchedule.create({
      data: {
        teamId: req.params.id,
        userId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isPrimary: isPrimary || false,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        team: { select: { id: true, name: true } },
      },
    });

    logger.info(`On-call schedule created for team ${req.params.id}, user ${userId}`);
    return success(res, schedule, 201);
  } catch (err) { next(err); }
}

// GET /api/v1/teams/:id/on-call/history — past on-call pages/incidents
async function getOnCallHistory(req, res, next) {
  try {
    const { skip, take, page: pg, limit: lim } = paginate(req.query.page, req.query.limit);

    // Past schedules for this team
    const [schedules, total] = await prisma.$transaction([
      prisma.onCallSchedule.findMany({
        where: { teamId: req.params.id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take,
      }),
      prisma.onCallSchedule.count({ where: { teamId: req.params.id } }),
    ]);

    // Also get recent P1/P2 incidents for this team
    const recentIncidents = await prisma.incident.findMany({
      where: {
        assignmentGroupId: req.params.id,
        priority: { in: ['P1', 'P2'] },
      },
      select: {
        id: true, number: true, shortDescription: true, priority: true, state: true,
        createdAt: true, resolvedAt: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return success(res, { schedules, recentIncidents }, 200, paginationMeta(total, pg, lim));
  } catch (err) { next(err); }
}

// POST /api/v1/teams/:id/escalation-policies
async function createEscalationPolicy(req, res, next) {
  try {
    const { name, description, rules = [] } = req.body;
    if (!name) return error(res, 'Policy name is required', 400);
    const policy = await prisma.escalationPolicy.create({
      data: {
        teamId: req.params.id,
        name,
        description: description || null,
        isActive: true,
        rules: {
          create: rules.map((r, idx) => ({
            level: r.level ?? idx + 1,
            delayMinutes: parseInt(r.delayMinutes) || 5,
            notifyType: r.notifyType || 'SMS_NOTIFY',
            notifyTargets: typeof r.notifyTargets === 'string' ? r.notifyTargets : JSON.stringify(r.notifyTargets || []),
          })),
        },
      },
      include: { rules: { orderBy: { level: 'asc' } } },
    });
    return success(res, policy, 201);
  } catch (err) { next(err); }
}

// PUT /api/v1/teams/:id/escalation-policies/:policyId
async function updateEscalationPolicy(req, res, next) {
  try {
    const { name, description, isActive, rules } = req.body;
    const { policyId } = req.params;
    await prisma.escalationPolicy.update({
      where: { id: policyId },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(isActive !== undefined && { isActive }) },
    });
    if (rules) {
      await prisma.escalationRule.deleteMany({ where: { policyId } });
      if (rules.length > 0) {
        await prisma.escalationRule.createMany({
          data: rules.map((r, idx) => ({
            policyId,
            level: r.level ?? idx + 1,
            delayMinutes: parseInt(r.delayMinutes) || 5,
            notifyType: r.notifyType || 'SMS_NOTIFY',
            notifyTargets: typeof r.notifyTargets === 'string' ? r.notifyTargets : JSON.stringify(r.notifyTargets || []),
          })),
        });
      }
    }
    const updated = await prisma.escalationPolicy.findUnique({
      where: { id: policyId },
      include: { rules: { orderBy: { level: 'asc' } } },
    });
    return success(res, updated);
  } catch (err) { next(err); }
}

// DELETE /api/v1/teams/:id/escalation-policies/:policyId
async function deleteEscalationPolicy(req, res, next) {
  try {
    await prisma.escalationPolicy.delete({ where: { id: req.params.policyId } });
    return success(res, { deleted: true });
  } catch (err) { next(err); }
}

module.exports = {
  listTeams, getTeam, createTeam, updateTeam, addMember, removeMember,
  getOnCall, getOnCallOverview, getEscalationPolicies, createOnCallSchedule, getOnCallHistory,
  createEscalationPolicy, updateEscalationPolicy, deleteEscalationPolicy,
};
