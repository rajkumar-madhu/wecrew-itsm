// Simulate Hoysala clicking Acknowledge from L2 email
// Generates the JWT token and hits the live API endpoint
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const https = require('https');
const http = require('http');

const p = new PrismaClient();
const JWT_SECRET = 'linkedeye-jwt-super-secret-2026';
const API_BASE = 'https://itsm.wecrew.in';

async function main() {
  const inc = await p.incident.findFirst({
    where: { number: 'INC0000032' },
    select: { id: true, number: true, state: true, escalationLevel: true }
  });
  console.log('Before ack:', inc);

  // Generate the same token the email would have embedded
  const token = jwt.sign({ incidentId: inc.id, action: 'ack' }, JWT_SECRET, { expiresIn: '24h' });
  const url = API_BASE + '/api/v1/incidents/ack?token=' + token;
  console.log('\nSimulating Hoysala clicking:\n', url);

  // Hit the endpoint
  await new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log('\nHTTP Status:', res.statusCode);
        // Extract just the title from the HTML response
        const titleMatch = body.match(/<div class="badge">([^<]+)<\/div>/);
        const h1Match = body.match(/<h1>([^<]+)<\/h1>/);
        if (titleMatch) console.log('Response badge:', titleMatch[1]);
        if (h1Match) console.log('Response heading:', h1Match[1]);
        resolve();
      });
    });
    req.on('error', e => { console.log('Request error:', e.message); resolve(); });
  });

  // Check DB after
  const after = await p.incident.findFirst({
    where: { number: 'INC0000032' },
    select: { state: true, escalationLevel: true, lastEscalatedAt: true }
  });
  console.log('\nAfter ack:', after);
  console.log('Escalation continues for L3 at 360min if unresolved.');
}

main().catch(console.error).finally(() => p.$disconnect());
