const { google } = require('googleapis');
const { getAuthClientForUser } = require('./google');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getHeader(headers, name) {
  return (headers.find(h => h.name.toLowerCase() === name.toLowerCase()) || {}).value || '';
}

function decodeBody(part) {
  if (!part) return '';
  if (part.body && part.body.data) {
    return Buffer.from(part.body.data, 'base64').toString('utf-8');
  }
  if (part.parts) {
    for (const p of part.parts) {
      const text = decodeBody(p);
      if (text) return text;
    }
  }
  return '';
}

function truncate(str, max = 300) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List recent inbox messages.
 * @param {number} telegramId
 * @param {number} maxResults   How many threads to fetch (default 5)
 * @returns {Array<{id, subject, from, date, snippet}>}
 */
async function listInbox(telegramId, maxResults = 5) {
  const auth = await getAuthClientForUser(telegramId);
  const gmail = google.gmail({ version: 'v1', auth });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults,
  });

  const messages = listRes.data.messages || [];
  if (!messages.length) return [];

  const detailed = await Promise.all(
    messages.map(m =>
      gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      })
    )
  );

  return detailed.map(({ data }) => ({
    id: data.id,
    subject: getHeader(data.payload.headers, 'Subject') || '(no subject)',
    from: getHeader(data.payload.headers, 'From'),
    date: getHeader(data.payload.headers, 'Date'),
    snippet: data.snippet || '',
  }));
}

/**
 * Read a single message in full.
 * @returns {{ subject, from, date, body }}
 */
async function readMessage(telegramId, messageId) {
  const auth = await getAuthClientForUser(telegramId);
  const gmail = google.gmail({ version: 'v1', auth });

  const { data } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = data.payload.headers;
  const rawBody = decodeBody(data.payload);

  return {
    subject: getHeader(headers, 'Subject') || '(no subject)',
    from: getHeader(headers, 'From'),
    date: getHeader(headers, 'Date'),
    body: truncate(rawBody.replace(/<[^>]*>/g, '').trim(), 1500),
  };
}

/**
 * Send an email.
 * @param {number} telegramId
 * @param {{ to, subject, body }} opts
 */
async function sendEmail(telegramId, { to, subject, body }) {
  const auth = await getAuthClientForUser(telegramId);
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = Buffer.from(
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
    body
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}

/**
 * Search inbox with a query string.
 */
async function searchEmails(telegramId, query, maxResults = 5) {
  const auth = await getAuthClientForUser(telegramId);
  const gmail = google.gmail({ version: 'v1', auth });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const messages = listRes.data.messages || [];
  if (!messages.length) return [];

  const detailed = await Promise.all(
    messages.map(m =>
      gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      })
    )
  );

  return detailed.map(({ data }) => ({
    id: data.id,
    subject: getHeader(data.payload.headers, 'Subject') || '(no subject)',
    from: getHeader(data.payload.headers, 'From'),
    date: getHeader(data.payload.headers, 'Date'),
    snippet: data.snippet || '',
  }));
}

module.exports = { listInbox, readMessage, sendEmail, searchEmails };
