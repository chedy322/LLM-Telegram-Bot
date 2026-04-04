const store = require('./store');
const { getAuthUrl } = require('./google');
const { listInbox, readMessage, sendEmail, searchEmails } = require('./gmail');
const kb = require('./keyboards');

// ─── Utility ──────────────────────────────────────────────────────────────────

function esc(text) {
  // Escape MarkdownV2 special chars
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

async function requireAuth(bot, chatId, telegramId) {
  if (!await store.isAuthenticated(telegramId)) {
    const url = await getAuthUrl(telegramId);
    await bot.sendMessage(
      chatId,
      `🔐 *You need to connect your Gmail first\\.*\n\nTap the button below to authorise:`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [[{ text: '🔗 Connect Gmail', url }]],
        },
      }
    );
    return false;
  }
  return true;
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStart(bot, msg) {
  const { chat, from } = msg;
  const name = esc(from.first_name || 'there');
  const authed = await store.isAuthenticated(from.id);

  await bot.sendMessage(
    chat.id,
    `👋 *Hello, ${name}\\!*\n\n` +
    `I'm your *Gmail Bot* — read and send emails right inside Telegram\\.\n\n` +
    (authed
      ? `You're already connected\\. Choose an action below\\.`
      : `Tap *Connect Gmail* to link your account\\.`),
    authed ? { parse_mode: 'MarkdownV2', ...kb.mainMenu } : { parse_mode: 'MarkdownV2' }
  );

  if (!authed) await requireAuth(bot, chat.id, from.id);
}

async function handleHelp(bot, msg) {
  await bot.sendMessage(
    msg.chat.id,
    `*Available commands*\n\n` +
    `/start — welcome screen\n` +
    `/menu — main menu\n` +
    `/inbox — view latest emails\n` +
    `/compose — write a new email\n` +
    `/search — search your inbox\n` +
    `/account — show linked account\n` +
    `/logout — disconnect Gmail\n` +
    `/help — this message`,
    { parse_mode: 'Markdown' }
  );
}

async function handleMenu(bot, chatId, telegramId) {
  if (!(await requireAuth(bot, chatId, telegramId))) return;
  await bot.sendMessage(chatId, '📬 *Gmail Bot — Main Menu*', {
    parse_mode: 'Markdown',
    ...kb.mainMenu,
  });
}

// async function safeExecute(bot, chatId, loadingMsgId, actionName, task) {
//     try {
//         await task();
//     } catch (err) {
//         console.error(`Error in ${actionName}:`, err);
//         if (loadingMsgId) await bot.deleteMessage(chatId, loadingMsgId).catch(() => {});
        
//         await bot.sendMessage(
//             chatId, 
//             `❌ *Error:* We encountered a problem processing your ${actionName}. Please try again later.`, 
//             { parse_mode: 'Markdown', ...kb.backToMenu }
//         );
//     }
// }

async function handleInbox(bot, chatId, telegramId) {
  if (!(await requireAuth(bot, chatId, telegramId))) return;

  const loading = await bot.sendMessage(chatId, '⏳ Fetching inbox…');
  try {
    const emails = await listInbox(telegramId, 8);
    await bot.deleteMessage(chatId, loading.message_id);

    if (!emails.length) {
      return bot.sendMessage(chatId, '📭 Your inbox is empty.', kb.backToMenu);
    }

    const lines = emails
      .map((e, i) => `*${i + 1}\\.* ${esc(e.subject)}\n   _From:_ ${esc(e.from)}`)
      .join('\n\n');

    await bot.sendMessage(chatId, `📥 *Inbox — latest ${emails.length} emails:*\n\n${lines}`, {
      parse_mode: 'MarkdownV2',
      ...kb.inboxList(emails),
    });
  } catch (err) {
    // await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
    // await bot.sendMessage(chatId, `❌ Error: ${err.message}`, kb.backToMenu);
       console.error(`Error in ${actionName}:`, err);
        if (loadingMsgId) await bot.deleteMessage(chatId, loadingMsgId).catch(() => {});
        
        await bot.sendMessage(
            chatId, 
            `❌ *Error:* We encountered a problem processing your ${actionName}. Please try again later.`, 
            { parse_mode: 'Markdown', ...kb.backToMenu }
        );
  }
}

async function handleReadMessage(bot, chatId, telegramId, messageId) {
  if (!(await requireAuth(bot, chatId, telegramId))) return;

  const loading = await bot.sendMessage(chatId, '⏳ Loading email…');
  try {
    const email = await readMessage(telegramId, messageId);
    await bot.deleteMessage(chatId, loading.message_id);

    // const text =
    //   `📧 *${esc(email.subject)}*\n` +
    //   `👤 *From:* ${esc(email.from)}\n` +
    //   `📅 *Date:* ${esc(email.date)}\n` +
    //   `${esc('─'.repeat(30))}\n\n`+
    //   `${esc(email.body || '(no body)')}`;

    // await bot.sendMessage(chatId, text, {
    //   parse_mode: 'MarkdownV2',
    //   ...kb.backToMenu,
    // });
    // the commecnted code changed to this
    const escHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const text = 
  `📧 <b>${escHTML(email.subject)}</b>\n` +
  `👤 <b>From:</b> ${escHTML(email.from)}\n` +
  `📅 <b>Date:</b> ${escHTML(email.date)}\n` +
  `──────────────────────────────\n\n` + 
  `${escHTML(email.body || '(no body)')}`;
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...kb.backToMenu });
    
  } catch (err) {
    // await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
    // await bot.sendMessage(chatId, `❌ Error: ${err.message}`, kb.backToMenu);
       console.error(`Error in ${actionName}:`, err);
        if (loadingMsgId) await bot.deleteMessage(chatId, loadingMsgId).catch(() => {});
        
        await bot.sendMessage(
            chatId, 
            `❌ *Error:* We encountered a problem processing your ${actionName}. Please try again later.`, 
            { parse_mode: 'Markdown', ...kb.backToMenu }
        );
  }
}

// ─── Compose flow (multi-step) ────────────────────────────────────────────────

async function handleCompose(bot, chatId, telegramId) {
  if (!(await requireAuth(bot, chatId, telegramId))) return;
  await store.saveDraft(telegramId, { step: 'to' });
  await bot.sendMessage(chatId, '✉️ *New Email*\n\nEnter the *recipient* email address:', {
    parse_mode: 'Markdown',
    ...kb.cancelMenu,
  });
}

async function handleComposeStep(bot, msg, telegramId) {
  const { chat, text } = msg;
  const draft =await store.getDraft(telegramId);
  if (!draft) return false; // not in compose flow

  if (draft.step === 'to') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) {
      return bot.sendMessage(chat.id, '⚠️ That doesn\'t look like a valid email. Try again:', kb.cancelMenu);
    }
    await store.saveDraft(telegramId, { ...draft, to: text.trim(), step: 'subject' });
    await bot.sendMessage(chat.id, `✅ *To:* ${text.trim()}\n\nNow enter the *Subject*:`, {
      parse_mode: 'Markdown',
      ...kb.cancelMenu,
    });
    return true;
  }

  if (draft.step === 'subject') {
    await store.saveDraft(telegramId, { ...draft, subject: text.trim(), step: 'body' });
    await bot.sendMessage(chat.id, `✅ *Subject:* ${text.trim()}\n\nNow type the *body* of your email:`, {
      parse_mode: 'Markdown',
      ...kb.cancelMenu,
    });
    return true;
  }

  if (draft.step === 'body') {
    await store.saveDraft(telegramId, { ...draft, body: text.trim(), step: 'confirm' });
    await bot.sendMessage(
      chat.id,
      `📋 *Review your email:*\n\n` +
      `*To:* ${draft.to}\n` +
      `*Subject:* ${draft.subject}\n\n` +
      `${text.trim()}`,
      { parse_mode: 'Markdown', ...kb.confirmSend(draft.to, draft.subject) }
    );
    return true;
  }

  return false;
}

async function handleSendConfirm(bot, chatId, telegramId) {
  const draft = await store.getDraft(telegramId);
  if (!draft || draft.step !== 'confirm') {
    return bot.sendMessage(chatId, '⚠️ No draft to send.', kb.backToMenu);
  }

  const loading = await bot.sendMessage(chatId, '📤 Sending…');
  try {
    await sendEmail(telegramId, { to: draft.to, subject: draft.subject, body: draft.body });
    await store.deleteDraft(telegramId);
    await bot.deleteMessage(chatId, loading.message_id);
    await bot.sendMessage(chatId, `✅ *Email sent successfully!*\n\n📬 To: ${draft.to}`, {
      parse_mode: 'Markdown',
      ...kb.backToMenu,
    });
  } catch (err) {
    // await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
    // await bot.sendMessage(chatId, `❌ Failed to send: ${err.message}`, kb.backToMenu);
       console.error(`Error in ${actionName}:`, err);
        if (loadingMsgId) await bot.deleteMessage(chatId, loadingMsgId).catch(() => {});
        
        await bot.sendMessage(
            chatId, 
            `❌ *Error:* We encountered a problem processing your ${actionName}. Please try again later.`, 
            { parse_mode: 'Markdown', ...kb.backToMenu }
        );
  }
}

// ─── Search flow ──────────────────────────────────────────────────────────────

async function handleSearch(bot, chatId, telegramId) {
  if (!(await requireAuth(bot, chatId, telegramId))) return;
  await store.saveDraft(telegramId, { step: 'search_query' });
  await bot.sendMessage(chatId, '🔍 *Search Inbox*\n\nEnter a search term (e.g. sender, subject, keyword):', {
    parse_mode: 'Markdown',
    ...kb.cancelMenu,
  });
}

async function handleSearchQuery(bot, msg, telegramId) {
  const { chat, text } = msg;
  const draft = await store.getDraft(telegramId);
  if (!draft || draft.step !== 'search_query') return false;

  await store.deleteDraft(telegramId);
  const loading = await bot.sendMessage(chat.id, `🔍 Searching for *${text}*…`, { parse_mode: 'Markdown' });

  try {
    const results = await searchEmails(telegramId, text, 8);
    await bot.deleteMessage(chat.id, loading.message_id);

    if (!results.length) {
      return bot.sendMessage(chat.id, '📭 No results found.', kb.backToMenu);
    }

    const lines = results
      .map((e, i) => `*${i + 1}.* ${esc(e.subject)}\n   _From:_ ${esc(e.from)}`)
      .join('\n\n');

    await bot.sendMessage(chat.id, `🔍 *Search results for "${esc(text)}":*\n\n${lines}`, {
      parse_mode: 'MarkdownV2',
      ...kb.searchResultsList(results),
    });
  } catch (err) {
    // await bot.deleteMessage(chat.id, loading.message_id).catch(() => {});
    // await bot.sendMessage(chat.id, `❌ Error: ${err.message}`, kb.backToMenu);
       console.error(`Error in ${actionName}:`, err);
        if (loadingMsgId) await bot.deleteMessage(chat.id, loadingMsgId).catch(() => {});
        
        await bot.sendMessage(
            chat.id, 
            `❌ *Error:* We encountered a problem processing your ${actionName}. Please try again later.`, 
            { parse_mode: 'Markdown', ...kb.backToMenu }
        );
  }

  return true;
}

// ─── Account / Logout ─────────────────────────────────────────────────────────

async function handleAccount(bot, chatId, telegramId) {
  if (!(await requireAuth(bot, chatId, telegramId))) return;
  const tokens = await store.getTokens(telegramId);
  await bot.sendMessage(
    chatId,
    `👤 *Connected Account*\n\n📧 ${tokens.email || 'Unknown'}`,
    { parse_mode: 'Markdown', ...kb.backToMenu }
  );
}

async function handleLogout(bot, chatId, telegramId) {
  await store.deleteTokens(telegramId);
  await store.deleteDraft(telegramId);
  await bot.sendMessage(
    chatId,
    '🚪 *Logged out successfully.*\n\nUse /start to connect again.',
    { parse_mode: 'Markdown' }
  );
}

module.exports = {
  handleStart,
  handleHelp,
  handleMenu,
  handleInbox,
  handleReadMessage,
  handleCompose,
  handleComposeStep,
  handleSendConfirm,
  handleSearch,
  handleSearchQuery,
  handleAccount,
  handleLogout,
};
