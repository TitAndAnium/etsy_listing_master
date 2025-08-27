// scripts/slackPing.js
const https = require('https');
require('dotenv').config();

const url = process.env.SLACK_WEBHOOK_URL;
if (!url) {
  console.error('SLACK_WEBHOOK_URL is not set. Put it in your .env file.');
  process.exit(1);
}

const msg = process.argv.slice(2).join(' ') || '✅ Slack webhook test';
const payload = JSON.stringify({ text: msg });

const req = https.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  console.log('Slack response status:', res.statusCode);
  // Drain response to allow process to exit, then explicitly exit
  res.on('data', () => {});
  res.on('end', () => process.exit(0));
});
req.on('error', e => console.error('Slack request error:', e.message));
req.write(payload);
req.end();
