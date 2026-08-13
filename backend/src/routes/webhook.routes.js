// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Webhook Routes (Inbound)
// ═══════════════════════════════════════════════════════════

const { Router } = require('express');
const {
  alertmanagerWebhook,
  grafanaWebhook,
  slackSlashCommand,
  slackInteractive,
  serviceNowWebhook,
  genericWebhook,
} = require('../controllers/webhook.controller');
const smsCtrl = require('../controllers/sms.controller');
const voiceCtrl = require('../controllers/voice.controller');
const { validateTwilioSignature } = require('../middleware/twilioAuth');

const router = Router();

// No auth required for inbound webhooks — they use their own verification

// Prometheus Alertmanager
router.post('/alertmanager', alertmanagerWebhook);

// Grafana
router.post('/grafana', grafanaWebhook);

// Slack
router.post('/slack/commands', slackSlashCommand);
router.post('/slack/interactive', slackInteractive);

// ServiceNow
router.post('/servicenow', serviceNowWebhook);

// Generic
router.post('/generic', genericWebhook);

// Twilio SMS/Voice webhooks — verified via X-Twilio-Signature (HMAC-SHA1)
router.post('/twilio/sms', validateTwilioSignature, smsCtrl.twilioInboundSMS);
router.post('/twilio/voice', validateTwilioSignature, voiceCtrl.twilioInboundVoice);
router.post('/twilio/speech', validateTwilioSignature, voiceCtrl.twilioSpeechInput);
router.post('/twilio/gather', validateTwilioSignature, voiceCtrl.twilioGather);
router.post('/twilio/status', validateTwilioSignature, voiceCtrl.twilioCallStatus);

// MSG91 delivery callback
router.post('/msg91/delivery', smsCtrl.msg91DeliveryCallback);

// Kaleyra delivery callback
router.post('/kaleyra/delivery', smsCtrl.kaleyraDeliveryCallback);

module.exports = router;
