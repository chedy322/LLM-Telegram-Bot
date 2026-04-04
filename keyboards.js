/**
 * Inline keyboard factories.
 */

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '📥 Inbox', callback_data: 'inbox' },
        { text: '🔍 Search', callback_data: 'search' },
      ],
      [
        { text: '✉️ Compose', callback_data: 'compose' },
        { text: '👤 Account', callback_data: 'account' },
      ],
      [{ text: '🚪 Logout', callback_data: 'logout' }],
    ],
  },
};

const cancelMenu = {
  reply_markup: {
    inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel' }]],
  },
};

const backToMenu = {
  reply_markup: {
    inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu' }]],
  },
};

function inboxList(emails) {
  const buttons = emails.map((e, i) => [
    { text: `📧 ${e.subject.slice(0, 40)}`, callback_data: `read_${e.id}` },
  ]);
  buttons.push([{ text: '🏠 Main Menu', callback_data: 'menu' }]);
  return { reply_markup: { inline_keyboard: buttons } };
}

function searchResultsList(emails) {
  const buttons = emails.map(e => [
    { text: `📧 ${e.subject.slice(0, 40)}`, callback_data: `read_${e.id}` },
  ]);
  buttons.push([{ text: '🏠 Main Menu', callback_data: 'menu' }]);
  return { reply_markup: { inline_keyboard: buttons } };
}

function confirmSend(to, subject) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Send', callback_data: 'send_confirm' },
          { text: '❌ Cancel', callback_data: 'cancel' },
        ],
      ],
    },
  };
}

module.exports = { mainMenu, cancelMenu, backToMenu, inboxList, searchResultsList, confirmSend };
