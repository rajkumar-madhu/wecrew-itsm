// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Attachment Routes (mounted at /api/v1/attachments)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { param } = require('express-validator');
const { authenticate, checkPermission } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { validate, validateUUID } = require('../middleware/validator');
const upload = require('../middleware/upload');
const { MAX_FILE_SIZE } = require('../config/constants');
const ctrl = require('../controllers/attachment.controller');

router.use(authenticate);
router.use(enforceWriteAccess); // 402 on writes once the org's trial or subscription lapses

const TYPES = ctrl.PARENT_TYPES.join('|');
const validateParent = [param('parentId').isUUID().withMessage('Invalid ID format'), validate];
// The ticket's own read/update permission decides who may see/add files.
const permissionFor = (action) => (req, res, next) =>
  checkPermission(ctrl.PARENTS[req.params.parentType].resource, action)(req, res, next);

// Turn multer's errors into a 400 the UI can show, instead of a 500.
function receiveFiles(req, res, next) {
  upload.array('files', 5)(req, res, (err) => {
    if (!err) return next();
    let message = err.message;
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') message = `Each file must be ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB or smaller`;
      else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Upload up to 5 files at a time';
    }
    return res.status(400).json({ success: false, error: message });
  });
}

router.get(`/:parentType(${TYPES})/:parentId`, permissionFor('read'), validateParent, ctrl.requireParent, ctrl.listAttachments);
router.post(`/:parentType(${TYPES})/:parentId`, permissionFor('update'), validateParent, ctrl.requireParent, receiveFiles, ctrl.uploadAttachments);
router.get('/:id/download', validateUUID, ctrl.downloadAttachment);
router.delete('/:id', validateUUID, ctrl.deleteAttachment);

module.exports = router;
