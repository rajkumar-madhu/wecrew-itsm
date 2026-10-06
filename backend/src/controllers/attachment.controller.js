// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Attachments on incidents, changes and problems
//
// Attachment rows carry no organizationId, so every access goes through the
// parent ticket, looked up with req.tenantWhere: a file is visible exactly
// when its ticket is.
// ═══════════════════════════════════════════════════════════

const fs = require('fs/promises');
const { prisma } = require('../config/database');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');
const { PERMISSIONS } = require('../config/constants');
const { storedFilePath } = require('../middleware/upload');

// URL segment → Prisma model, Attachment foreign key, PERMISSIONS key.
const PARENTS = {
  incidents: { model: 'incident', fk: 'incidentId', resource: 'incidents' },
  changes:   { model: 'change',   fk: 'changeId',   resource: 'changes' },
  problems:  { model: 'problem',  fk: 'problemId',  resource: 'problems' },
};

const uploaderSelect = { select: { id: true, firstName: true, lastName: true } };
const publicFields = {
  id: true, originalName: true, mimeType: true, size: true, createdAt: true,
  incidentId: true, changeId: true, problemId: true, uploadedBy: uploaderSelect,
};

function can(user, resource, letter) {
  const perms = PERMISSIONS[user.role];
  return !!perms?.[resource]?.includes(letter);
}

async function findParent(req, type, id) {
  return prisma[PARENTS[type].model].findFirst({
    where: { id, ...(req.tenantWhere || {}) },
    select: { id: true },
  });
}

/** Load an attachment plus its parent type, tenant-checked. → { att, type } or null. */
async function loadAttachment(req) {
  const att = await prisma.attachment.findUnique({ where: { id: req.params.id } });
  if (!att) return null;
  const type = Object.keys(PARENTS).find((t) => att[PARENTS[t].fk]);
  if (!type || !(await findParent(req, type, att[PARENTS[type].fk]))) return null;
  return { att, type };
}

async function removeFiles(files = []) {
  await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));
}

// Middleware for /:parentType/:parentId — 404 before multer writes anything.
async function requireParent(req, res, next) {
  try {
    if (!(await findParent(req, req.params.parentType, req.params.parentId))) {
      return error(res, 'Not found', 404);
    }
    next();
  } catch (err) { next(err); }
}

// GET /api/v1/attachments/:parentType/:parentId
async function listAttachments(req, res, next) {
  try {
    const { fk } = PARENTS[req.params.parentType];
    const items = await prisma.attachment.findMany({
      where: { [fk]: req.params.parentId },
      select: publicFields,
      orderBy: { createdAt: 'desc' },
    });
    return success(res, items);
  } catch (err) { next(err); }
}

// POST /api/v1/attachments/:parentType/:parentId  (multipart, field "files")
async function uploadAttachments(req, res, next) {
  const files = req.files || [];
  try {
    if (!files.length) return error(res, 'Choose at least one file', 400);
    const { fk } = PARENTS[req.params.parentType];
    const created = await prisma.$transaction(files.map((f) => prisma.attachment.create({
      data: {
        filename: f.filename,
        path: f.filename, // relative to UPLOAD_DIR
        originalName: String(f.originalname).slice(0, 255),
        mimeType: f.mimetype,
        size: f.size,
        [fk]: req.params.parentId,
        uploadedById: req.user.id,
      },
      select: publicFields,
    })));
    logger.info(`[attachments] ${created.length} file(s) added to ${req.params.parentType}/${req.params.parentId} by ${req.user.id}`);
    return success(res, created, 201);
  } catch (err) {
    await removeFiles(files); // no orphaned files when the DB write fails
    next(err);
  }
}

// GET /api/v1/attachments/:id/download
async function downloadAttachment(req, res, next) {
  try {
    const found = await loadAttachment(req);
    if (!found || !can(req.user, PARENTS[found.type].resource, 'r')) return error(res, 'Not found', 404);
    const { att } = found;
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, no-store');
    // Always a download, never rendered inline from our origin.
    return res.download(storedFilePath(att.filename), att.originalName, { headers: { 'Content-Type': att.mimeType } }, (err) => {
      if (err && !res.headersSent) {
        logger.error(`[attachments] file for ${att.id} unreadable: ${err.message}`);
        error(res, 'File is no longer available', 410);
      }
    });
  } catch (err) { next(err); }
}

// DELETE /api/v1/attachments/:id — the uploader, or a role that can delete the ticket
async function deleteAttachment(req, res, next) {
  try {
    const found = await loadAttachment(req);
    if (!found) return error(res, 'Not found', 404);
    const { att, type } = found;
    const { resource } = PARENTS[type];
    const isUploader = att.uploadedById === req.user.id && can(req.user, resource, 'u');
    if (!isUploader && !can(req.user, resource, 'd')) return error(res, 'Permission denied for this action', 403);

    await prisma.attachment.delete({ where: { id: att.id } });
    await fs.unlink(storedFilePath(att.filename)).catch((e) => {
      if (e.code !== 'ENOENT') logger.warn(`[attachments] could not remove file for ${att.id}: ${e.message}`);
    });
    return success(res, { deleted: true });
  } catch (err) { next(err); }
}

module.exports = {
  PARENT_TYPES: Object.keys(PARENTS),
  PARENTS,
  requireParent, listAttachments, uploadAttachments, downloadAttachment, deleteAttachment,
};
