// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Trial reminder emails: day 15, 19 and 21 (expired).
//
// Reminders ONLY. Access is derived at request time, so if this job
// never runs nobody gets free product — they just get no warning.
// Run once daily from cron: each reminder fires on exactly one day, so a
// second run on the same day would send it twice.
//
// Sends through emailService.sendEmail, which delivers immediately and
// records the EmailQueue row. Do not insert EmailQueue rows directly:
// processEmailQueue only retries rows whose scheduledAt <= now, and a
// NULL scheduledAt never matches, so they would sit PENDING forever.
// ═══════════════════════════════════════════════════════════

const { prisma } = require('../src/config/database');
const { config } = require('../src/config/env');
const { sendEmail } = require('../src/services/emailService');

const DAY_MS = 86400000;
const NOTIFY_ON = { 5: 'trial-5-days', 1: 'trial-1-day', '-1': 'trial-expired' };

// Org names come from the public signup form — never trust them in HTML.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render({ firstName, orgName, daysLeft }) {
  const name = escapeHtml(firstName);
  const org = escapeHtml(orgName);
  const billingUrl = `${config.frontendUrl.replace(/\/+$/, '')}/billing`;
  if (daysLeft > 0) {
    const days = `${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    return {
      subject: `${days} left in your WeCrew ITSM trial`,
      html: `<p>Hi ${name},</p><p>Your WeCrew ITSM trial for <strong>${org}</strong> ends in ${days}. `
        + `<a href="${billingUrl}">Subscribe</a> to keep full access.</p>`,
    };
  }
  return {
    subject: 'Your WeCrew ITSM trial has ended',
    html: `<p>Hi ${name},</p><p>Your WeCrew ITSM trial for <strong>${org}</strong> has ended. `
      + `Your data is safe and still readable — <a href="${billingUrl}">subscribe</a> to resume making changes.</p>`,
  };
}

async function main() {
  const subs = await prisma.subscription.findMany({
    where: { status: 'TRIALING' },
    include: { organization: { select: { id: true, name: true } } },
  });

  for (const sub of subs) {
    const daysLeft = Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / DAY_MS);
    const template = NOTIFY_ON[String(daysLeft)];
    if (!template) continue;

    const admins = await prisma.user.findMany({
      where: { organizationId: sub.organizationId, role: 'ADMIN', status: 'ACTIVE' },
      select: { email: true, firstName: true },
    });

    for (const admin of admins) {
      const { subject, html } = render({
        firstName: admin.firstName, orgName: sub.organization.name, daysLeft,
      });
      await sendEmail(admin.email, subject, html);
    }
    console.log(`[trial-reminders] ${template} sent to ${admins.length} admin(s) of org ${sub.organizationId}`);
  }
}

if (require.main === module) {
  main()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}

module.exports = { render, escapeHtml, NOTIFY_ON };
