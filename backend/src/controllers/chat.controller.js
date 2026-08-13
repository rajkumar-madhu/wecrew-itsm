// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Team Chat Controller
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const { emitToTeam } = require('../config/socket');

async function assertTeamAccess(user, teamId) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      members: { select: { userId: true } },
    },
  });
  if (!team) return { error: 'Team not found', status: 404 };

  // Super-admin / org admin can access all teams in scope
  if (user.role === 'ADMIN' || user.role === 'MANAGER') {
    return { team };
  }

  const isMember = team.members.some((m) => m.userId === user.id);
  if (!isMember) return { error: 'Not a member of this team', status: 403 };
  return { team };
}

/** GET /api/v1/chat/teams — teams the user can chat in */
async function listChatTeams(req, res, next) {
  try {
    const user = req.user;
    let teams;

    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      teams = await prisma.team.findMany({
        where: {
          isActive: true,
          ...(req.tenantWhere || {}),
        },
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { members: true } },
        },
        orderBy: { name: 'asc' },
      });
    } else {
      teams = await prisma.team.findMany({
        where: {
          isActive: true,
          members: { some: { userId: user.id } },
        },
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { members: true } },
        },
        orderBy: { name: 'asc' },
      });
    }

    // last message preview
    const withPreview = await Promise.all(
      teams.map(async (t) => {
        const last = await prisma.chatMessage.findFirst({
          where: { teamId: t.id },
          orderBy: { createdAt: 'desc' },
          select: {
            body: true,
            createdAt: true,
            user: { select: { firstName: true, lastName: true } },
          },
        });
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          memberCount: t._count.members,
          lastMessage: last
            ? {
                body: last.body,
                createdAt: last.createdAt,
                author: `${last.user.firstName} ${last.user.lastName}`.trim(),
              }
            : null,
        };
      })
    );

    res.json({ success: true, data: withPreview });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/chat/teams/:teamId/messages */
async function listMessages(req, res, next) {
  try {
    const { teamId } = req.params;
    const access = await assertTeamAccess(req.user, teamId);
    if (access.error) return res.status(access.status).json({ success: false, error: access.error });

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before ? new Date(req.query.before) : null;

    const messages = await prisma.chatMessage.findMany({
      where: {
        teamId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
        },
      },
    });

    res.json({
      success: true,
      data: messages.reverse(),
      meta: { team: { id: access.team.id, name: access.team.name } },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/chat/teams/:teamId/messages */
async function sendMessage(req, res, next) {
  try {
    const { teamId } = req.params;
    const body = (req.body.body || req.body.message || '').trim();
    if (!body) return res.status(400).json({ success: false, error: 'Message body required' });
    if (body.length > 4000) {
      return res.status(400).json({ success: false, error: 'Message too long (max 4000)' });
    }

    const access = await assertTeamAccess(req.user, teamId);
    if (access.error) return res.status(access.status).json({ success: false, error: access.error });

    const message = await prisma.chatMessage.create({
      data: {
        teamId,
        userId: req.user.id,
        body,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
        },
      },
    });

    // Real-time fan-out
    try {
      emitToTeam(teamId, 'chat:message', message);
    } catch {
      // socket optional if not initialized
    }

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}

module.exports = { listChatTeams, listMessages, sendMessage };
