// ═══════════════════════════════════════════════════════════
// Argus ITSM — Service Catalog & Service Request Routes (agents)
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { enforceWriteAccess } = require('../middleware/billing.middleware');
const { validateUUID } = require('../middleware/validator');
const { auditLog } = require('../middleware/audit');
const { AGENT_ROLES } = require('../config/constants');
const ctrl = require('../controllers/request.controller');

const catalog = Router();
catalog.use(authenticate, authorize(...AGENT_ROLES), enforceWriteAccess);
catalog.get('/', ctrl.listCatalog);
catalog.post('/', authorize('ADMIN', 'MANAGER'), auditLog('ServiceCatalogItem'), ctrl.createCatalogItem);
catalog.patch('/:id', authorize('ADMIN', 'MANAGER'), validateUUID, auditLog('ServiceCatalogItem'), ctrl.updateCatalogItem);

const requests = Router();
requests.use(authenticate, authorize(...AGENT_ROLES), enforceWriteAccess);
const WORKERS = ['ADMIN', 'MANAGER', 'ENGINEER', 'OPERATOR'];
requests.get('/', ctrl.listRequests);
requests.get('/:id', validateUUID, ctrl.getRequest);
requests.patch('/:id', authorize(...WORKERS), validateUUID, auditLog('ServiceRequest'), ctrl.updateRequest);
requests.post('/:id/decision', validateUUID, auditLog('ServiceRequest'), ctrl.decideRequest);
requests.post('/:id/comments', authorize(...WORKERS), validateUUID, ctrl.addRequestComment);

module.exports = { catalogRoutes: catalog, requestRoutes: requests };
