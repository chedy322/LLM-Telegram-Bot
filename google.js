const { google } = require('googleapis');
const config = require('./config');
const store = require('./store');
const crypto=require("crypto")

const algorithm = 'aes-256-cbc';
const TOKEN_SECRET= Buffer.from(process.env.TOKEN_SECRET, 'hex');
if (!process.env.TOKEN_SECRET || TOKEN_SECRET.length !== 32) {
  throw new Error('TOKEN_SECRET must be 32 bytes (hex)');
}
/**
 * Create a fresh OAuth2 client.
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}
// generate iv for hashing
function IVGenerator(){
  return crypto.randomBytes(16);
}

function encryptTokenWithSecret(token){
  // generate iv for hashing
  const iv=IVGenerator();
  const cipher=crypto.createCipheriv(algorithm, TOKEN_SECRET, iv);
  let encrypted=cipher.update(JSON.stringify(token), 'utf8', 'hex');
  encrypted+=cipher.final('hex');
  return encrypted+":"+iv.toString("hex");
}
function decryptToken(encryptedToken){
  console.log("EncryptedToken "+encryptedToken)
  const [encrypted, iv] = encryptedToken.split(':');
  console.log("Splitted encrypted token "+encrypted)
  const decipher = crypto.createDecipheriv(
    algorithm,
    TOKEN_SECRET,
    Buffer.from(iv, 'hex')
  );

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}
/**
 * Build the Google consent-screen URL for a given Telegram user.
 * We embed the Telegram ID in the `state` param so the callback
 * can link the token back to the right user.
 */
async function getAuthUrl(telegramId) {
  const state = crypto.randomBytes(32).toString("hex");
  await store.savePendingState(state, telegramId);

  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', 
    scope: config.google.scopes,
    state,
  });
}

/**
 * Exchange an auth `code` for tokens and persist them.
 * Returns the Telegram user ID that initiated the flow.
 */
// async function handleOAuthCallback(code, state) {
//   const telegramId = await store.getPendingState(state);
//   if (!telegramId) throw new Error('Unknown or expired OAuth state.');
//   await store.deletePendingState(state);

//   const oauth2 = createOAuth2Client();
//   const { tokens } = await oauth2.getToken(code);
//   oauth2.setCredentials(tokens);

//   // Fetch the user's Gmail address
//   const people = google.oauth2({ version: 'v2', auth: oauth2 });
//   const { data } = await people.userinfo.get();
//   tokens.email = data.email;
//   // hash token before saving it to db
//   let hashedToken=encryptTokenWithSecret(tokens)
//   await store.saveTokens(telegramId, hashedToken);
//   return { telegramId, email: data.email };
// }
async function handleOAuthCallback(code, state) {
  const telegramId = await store.getPendingState(state);
  if (!telegramId) throw new Error('Unknown or expired OAuth state.');
  
  await store.deletePendingState(state);

  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const people = google.oauth2({ version: 'v2', auth: oauth2 });
  const { data } = await people.userinfo.get();
  
  // 1. Attach the email to the token object before encrypting
  tokens.email = data.email;

  // 2. Encrypt the WHOLE object into one string
  const encryptedString = encryptTokenWithSecret(tokens);

  /** * IMPORTANT: Since you are encrypting the whole thing, 
   * your saveTokens/upsertUser needs to handle this.
   * If your DB has columns for access_token, etc., you usually 
   * encrypt the SENSITIVE fields only, OR store the encrypted string 
   * in a single 'tokens' TEXT column.
   * * Assuming you are keeping your current schema, we pass the 
   * encrypted string as the access_token for now:
   */
  await store.saveTokens(telegramId, {
    email: data.email,
    access_token: encryptedString, // This holds the encrypted JSON
    refresh_token: null,           // Included inside the encrypted string
    expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null
  });

  return { telegramId, email: data.email };
}

/**
 * Return an authenticated OAuth2 client for a stored user.
 * Auto-refreshes the access token when needed.
 */
// async function getAuthClientForUser(telegramId) {
//   const encryptedtokens = await store.getTokens(telegramId);
//   if (!encryptedtokens) throw new Error('User not authenticated.');
//   const tokens=decryptToken(encryptedtokens);

//   const oauth2 = createOAuth2Client();
//   oauth2.setCredentials(tokens);

//   // Refresh if expired (or within 2 minutes of expiry)
//   if (tokens.expiry_date && Date.now() > tokens.expiry_date - 120_000) {
//     const { credentials } = await oauth2.refreshAccessToken();
//     // encrypt the tokens/data before storing in db
//     const data={ ...tokens, ...credentials };
//     const encryptedData=encryptTokenWithSecret(data);
//     await store.saveTokens(telegramId, encryptedData);
//     oauth2.setCredentials(credentials);
//   }
  
//   // store user

//   return oauth2;
// }


// async function getAuthClientForUser(telegramId) {
//   const row = await store.getTokens(telegramId);
//   if (!row || !row.access_token) throw new Error('User not authenticated.');

//   // Decrypt the string back into the tokens object
//   const tokens = decryptToken(row.access_token);

//   const oauth2 = createOAuth2Client();
//   oauth2.setCredentials(tokens);

//   // Refresh if expired (or within 2 minutes of expiry)
//   if (tokens.expiry_date && Date.now() > (tokens.expiry_date - 120_000)) {
//     try {
//       const { credentials } = await oauth2.refreshAccessToken();
//       const updatedTokens = { ...tokens, ...credentials };
      
//       const encryptedData = encryptTokenWithSecret(updatedTokens);
      
//       await store.saveTokens(telegramId, {
//         email: tokens.email,
//         access_token: encryptedData,
//         expiry_date: updatedTokens.expiry_date ? new Date(updatedTokens.expiry_date) : null
//       });
      
//       oauth2.setCredentials(updatedTokens);
//     } catch (err) {
//       console.error("Token refresh failed:", err);
//       throw err;
//     }
//   }
// }




async function getAuthClientForUser(telegramId) {
  // 1. Await the database result
  const row = await store.getTokens(telegramId);
  if (!row || !row.access_token) throw new Error('User not authenticated.');

  // 2. Decrypt ONLY the access_token string from the row
  const tokens = decryptToken(row.access_token);

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials(tokens);

  // 3. Handle Refresh Logic
  if (tokens.expiry_date && Date.now() > (tokens.expiry_date - 120_000)) {
    const { credentials } = await oauth2.refreshAccessToken();
    const updatedTokens = { ...tokens, ...credentials };
    
    // Encrypt the new combined object
    const encryptedData = encryptTokenWithSecret(updatedTokens);
    
    await store.saveTokens(telegramId, {
      email: tokens.email,
      access_token: encryptedData,
      expiry_date: updatedTokens.expiry_date
    });
  }
  
  return oauth2;
}


module.exports = { getAuthUrl, handleOAuthCallback, getAuthClientForUser };
