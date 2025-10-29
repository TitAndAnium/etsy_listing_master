// functions/utils/slack.js
// Minimalistische Slack-webhook util. Doet niets als SLACK_WEBHOOK_URL niet bestaat.
const https = require('https');
const { URL } = require('url');

function post(payload = {}) {
  const webhook = process.env.SLACK_WEBHOOK_URL || '';
  if (!webhook) return Promise.resolve();
  try {
    const url = new URL(webhook);
    const data = Buffer.from(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
          },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  } catch (_) {
    return Promise.resolve();
  }
}

module.exports = { post };
