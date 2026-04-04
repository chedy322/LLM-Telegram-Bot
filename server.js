/**
 * Express server — handles the Google OAuth2 callback.
 */
const express = require('express');
const { handleOAuthCallback } = require('./google');

module.exports = function createServer(bot) {
  const app = express();

  app.get('/auth/google/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[OAuth] Error from Google:', error);
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>❌ Authentication failed</h2>
          <p>${error}</p>
          <p>Return to Telegram and try again.</p>
        </body></html>
      `);
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter.');
    }

    try {
      const { telegramId, email } = await handleOAuthCallback(code, state);

      // Notify the user in Telegram
      await bot.sendMessage(
        telegramId,
        `✅ *Gmail connected successfully!*\n\n📧 Account: \`${email}\`\n\nUse /menu to get started.`,
        { parse_mode: 'Markdown' }
      );

      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>✅ Connected!</h2>
          <p>Your Gmail account <strong>${email}</strong> has been linked.</p>
          <p>Return to Telegram to continue.</p>
        </body></html>
      `);
    } catch (err) {
      console.error('[OAuth] Callback error:', err.message);
      res.status(500).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>❌ Something went wrong</h2>
          <p>${err.message}</p>
        </body></html>
      `);
    }
  });

  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  return app;
};
