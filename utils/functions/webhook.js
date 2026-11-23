const { discordWebhookUrl } = require('../config');

// strips characters Discord could interpret as mentions and bounds length
function clean(text, max) {
  return (
    String(text ?? '')
      // eslint-disable-next-line no-control-regex -- deliberately strips control characters
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .slice(0, max)
  );
}

module.exports = {
  // forwards user feedback to the team's Discord; never throws, never mentions anyone
  sendDiscordWebhook: async (comment, username, ign, questionId) => {
    if (!discordWebhookUrl) {
      return false;
    }
    let value = clean(comment, 1000);
    if (questionId) {
      value = 'Question ID: ' + clean(questionId, 64) + '\n' + value;
    }
    const params = {
      username: 'mutorials.org',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: clean(ign, 100) || 'unknown',
          color: 3650267,
          fields: [
            {
              name: clean(username, 100) || 'unknown',
              value: value || '(empty)',
            },
          ],
        },
      ],
    };
    try {
      const response = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (err) {
      console.error('Discord webhook failed:', err.message);
      return false;
    }
  },
};
