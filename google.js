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
  const [encrypted, iv] = encryptedToken.split(':');
  const decipher = crypto.createDecipheriv(
    algorithm,
    TOKEN_SECRET,
    Buffer.from(iv, 'hex')
  );

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

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
  await store.saveTokens(telegramId, {
    email: data.email,
    access_token: encryptedString, // This holds the encrypted JSON
    refresh_token: null,           // Included inside the encrypted string
    expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date) : null
  });

  return { telegramId, email: data.email };
}


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
