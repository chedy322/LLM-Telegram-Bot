require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const createServer = require('./server');
const h = require('./handlers');
const { DbTablesSetup } = require('./database');

// ── Validate env ──────────────────────────────────────────────────────────────
if (!config.telegram.token) {
  console.error('❌  TELEGRAM_BOT_TOKEN is missing in .env');
  process.exit(1);
}
if (!config.google.clientId || !config.google.clientSecret) {
  console.error('❌  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing in .env');
  process.exit(1);
}

async function init(){


  try{
console.log('⏳ Initializing database...');
    await DbTablesSetup(); 
    console.log('✅ Database ready.');

// ── Bot ───────────────────────────────────────────────────────────────────────
const bot = new TelegramBot(config.telegram.token, { polling: true });

console.log('🤖  Telegram bot started (polling)');

// ── OAuth server ──────────────────────────────────────────────────────────────
const app = createServer(bot);
app.listen(config.server.port, () => {
  console.log(`🌐  OAuth server listening on port ${config.server.port}`);
  console.log(`🔗  Callback URL: ${config.google.redirectUri}`);
});

// ── Commands ──────────────────────────────────────────────────────────────────
bot.onText(/\/start/, msg => h.handleStart(bot, msg));
bot.onText(/\/help/, msg => h.handleHelp(bot, msg));
bot.onText(/\/menu/, msg => h.handleMenu(bot, msg.chat.id, msg.from.id));
bot.onText(/\/inbox/, msg => h.handleInbox(bot, msg.chat.id, msg.from.id));
bot.onText(/\/compose/, msg => h.handleCompose(bot, msg.chat.id, msg.from.id));
bot.onText(/\/search/, msg => h.handleSearch(bot, msg.chat.id, msg.from.id));
bot.onText(/\/account/, msg => h.handleAccount(bot, msg.chat.id, msg.from.id));
bot.onText(/\/logout/, msg => h.handleLogout(bot, msg.chat.id, msg.from.id));

// ── Inline button callbacks ───────────────────────────────────────────────────
bot.on('callback_query', async query => {
  const { data, message, from } = query;
  const chatId = message.chat.id;
  const telegramId = from.id;

  await bot.answerCallbackQuery(query.id);

  if (data === 'menu') return h.handleMenu(bot, chatId, telegramId);
  if (data === 'inbox') return h.handleInbox(bot, chatId, telegramId);
  if (data === 'compose') return h.handleCompose(bot, chatId, telegramId);
  if (data === 'search') return h.handleSearch(bot, chatId, telegramId);
  if (data === 'account') return h.handleAccount(bot, chatId, telegramId);
  if (data === 'logout') return h.handleLogout(bot, chatId, telegramId);
  if (data === 'send_confirm') return h.handleSendConfirm(bot, chatId, telegramId);

  if (data === 'cancel') {
    await require('./store').deleteDraft(telegramId);
    return bot.sendMessage(chatId, '❌ Cancelled.', require('./keyboards').backToMenu);
  }

  if (data.startsWith('read_')) {
    const messageId = data.replace('read_', '');
    return h.handleReadMessage(bot, chatId, telegramId, messageId);
  }
});

// ── Free-text messages (multi-step flows) ─────────────────────────────────────
bot.on('message', async msg => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const telegramId = msg.from.id;

  // Try compose steps
  const composedHandled = await h.handleComposeStep(bot, msg, telegramId);
  if (composedHandled) return;

  // Try search query
  const searchHandled = await h.handleSearchQuery(bot, msg, telegramId);
  if (searchHandled) return;

  // Default fallback
  await bot.sendMessage(msg.chat.id, 'Use /menu or tap a button to get started.', {
    ...require('./keyboards').backToMenu,
  });
});

// ── Error handling ────────────────────────────────────────────────────────────
bot.on('polling_error', err => console.error('[Polling error]', err.message));
process.on('unhandledRejection', err => console.error('[Unhandled rejection]', err));


}catch(error){
  console.error('❌ Failed to start application:', error);
    process.exit(1);
}
}


init()