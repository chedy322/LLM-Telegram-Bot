/**
 * In-memory store for user sessions & OAuth tokens.
 * In production, replace with Redis or a database (e.g. SQLite / PostgreSQL).
 */
// const NodeCache = require('node-cache');
const {statements :stmts}=require('./database');

module.exports = {
  async saveTokens(telegramId, tokens) {
    await stmts.upsertUser({
      telegram_id: telegramId,
      email: tokens.email || null,
      access_token: tokens.access_token,
      refresh_token: null,
      expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date): null,
    });
  },

  async getTokens(telegramId) {
    const res = await stmts.getUser(telegramId);
    const row = res.rows[0];
    if (!row || !row.access_token) return null;
    // return {
    //   access_token: row.access_token,
    //   refresh_token: row.refresh_token,
    //   expiry_date: row.expiry_date,
    //   email: row.email,
    // };
    return row;
  },

  async deleteTokens(telegramId) {
    await stmts.deleteUser(telegramId);
  },

  // async isAuthenticated(telegramId) {
  //   const res = await stmts.getUser(telegramId);
  //   return !!(res.rows.length > 0 && res.rows[0].access_token);
  // },
async isAuthenticated(telegramId) {
    const res = await stmts.getUser(telegramId);
    return !!(res.rows.length > 0 && res.rows[0].access_token);
  },
  
  async touchUser(telegramId) {
    await stmts.touchUser(telegramId);
  },

  async getAllUsers() {
    const res = await stmts.allUsers();
    return res.rows;
  },

  async getUserCount() {
    const res = await stmts.userCount();
    return parseInt(res.rows[0].cnt);
  },

  // OAuth states
  async savePendingState(state, telegramId) { 
    await stmts.saveState(state, telegramId); 
  },

  async getPendingState(state) {
    const res = await stmts.getState(state);
    return res.rows[0] ? res.rows[0].telegram_id : null;
  },

  async deletePendingState(state) { 
    await stmts.deleteState(state); 
  },

  // Drafts
  async saveDraft(telegramId, draft) { 
    await stmts.saveDraft(telegramId, JSON.stringify(draft)); 
  },

  async getDraft(telegramId) {
    const res = await stmts.getDraft(telegramId);
    return res.rows[0] ? JSON.parse(res.rows[0].data) : null;
  },

  async deleteDraft(telegramId) { 
    await stmts.deleteDraft(telegramId); 
  },

  // Activity logging
  async log(telegramId, action, detail = null) {
    try { 
      await stmts.logActivity(telegramId, action, detail); 
    } catch (e) {
      console.error("Logging failed", e);
    }
  },

  async getRecentActivity() { 
    const res = await stmts.recentActivity(); 
    return res.rows;
  },

  async getActivityCount() { 
    const res = await stmts.activityCount(); 
    return parseInt(res.rows[0].cnt); 
  },
};

// TTL: 30 days (in seconds)
// const cache = new NodeCache({ stdTTL: 60 * 60 * 24 * 30, checkperiod: 600 });

// // Pending OAuth states: short-lived (10 min)
// const pendingStates = new NodeCache({ stdTTL: 600, checkperiod: 60 });

// module.exports = {
//   /**
//    * Save OAuth tokens for a Telegram user.
//    * @param {number} telegramId
//    * @param {object} tokens  { access_token, refresh_token, expiry_date, email }
//    */
//   saveTokens(telegramId, tokens) {
//     // statements.sa
//     // cache.set(`tokens:${telegramId}`, tokens);
//   },

//   /**
//    * Retrieve stored tokens for a Telegram user.
//    */
//   getTokens(telegramId) {
//     return cache.get(`tokens:${telegramId}`) || null;
//   },

//   /**
//    * Delete tokens (logout).
//    */
//   deleteTokens(telegramId) {
//     cache.del(`tokens:${telegramId}`);
//   },

//   /**
//    * Check whether a user is authenticated.
//    */
//   isAuthenticated(telegramId) {
//     return !!cache.get(`tokens:${telegramId}`);
//   },

//   // ── OAuth state helpers ──────────────────────────────────

//   savePendingState(state, telegramId) {
//     pendingStates.set(state, telegramId);
//   },

//   getPendingState(state) {
//     return pendingStates.get(state) || null;
//   },

//   deletePendingState(state) {
//     pendingStates.del(state);
//   },

//   // ── Compose drafts (multi-step) ───────────────────────────

//   saveDraft(telegramId, draft) {
//     cache.set(`draft:${telegramId}`, draft, 600); // 10 min TTL
//   },

//   getDraft(telegramId) {
//     return cache.get(`draft:${telegramId}`) || null;
//   },

//   deleteDraft(telegramId) {
//     cache.del(`draft:${telegramId}`);
//   },
// };