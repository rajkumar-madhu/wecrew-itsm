const express = require('express');
const router = express.Router();
const { getOrgStatus } = require('../controllers/status.controller');

// Public — no authentication required
router.get('/:orgSlug', getOrgStatus);

module.exports = router;
