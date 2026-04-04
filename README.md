# 📬 Gmail Telegram Bot

A Telegram bot that lets you **read and send Gmail emails** directly from Telegram using Google OAuth2.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 Google OAuth2 | Secure login — no passwords stored |
| 📥 Inbox | View your latest emails with one tap |
| 📧 Read Email | Open any email and read its full content |
| ✉️ Compose | Send emails via a guided multi-step flow |
| 🔍 Search | Search your inbox by keyword, sender, subject |
| 👤 Account | View your connected Gmail address |
| 🚪 Logout | Disconnect at any time |

---

## 🚀 Setup Guide

### 1. Clone & Install

```bash
git clone <your-repo>
cd gmail-telegram-bot
npm install
```

### 2. Create a Telegram Bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram
2. Send `/newbot` and follow the prompts
3. Copy the **Bot Token**

### 3. Create Google OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Navigate to **APIs & Services → Library**
4. Enable the **Gmail API**
5. Go to **APIs & Services → OAuth consent screen**
   - Choose **External**
   - Fill in app name, support email
   - Add scopes: `gmail.readonly`, `gmail.send`, `userinfo.email`
   - Add your Gmail as a **Test user**
6. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3000/auth/google/callback`
7. Copy **Client ID** and **Client Secret**

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
PORT=3000
BASE_URL=http://localhost:3000
```

### 5. Run the Bot

```bash
npm start
# or for development with auto-reload:
npm run dev
```

---

## 🌐 Production Deployment

For production (e.g. on a VPS or Railway/Render):

1. Set `BASE_URL` and `GOOGLE_REDIRECT_URI` to your public domain:
   ```
   BASE_URL=https://yourdomain.com
   GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
   ```
2. Update the Authorized redirect URI in Google Cloud Console to match
3. Use a process manager like **PM2**:
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name gmail-bot
   pm2 save
   ```

---

## 📂 Project Structure

```
gmail-telegram-bot/
├── src/
│   ├── index.js        # Entry point — bot + server wiring
│   ├── config.js       # Environment config
│   ├── store.js        # In-memory token/session store
│   ├── google.js       # OAuth2 helpers
│   ├── gmail.js        # Gmail API (read, send, search)
│   ├── handlers.js     # Bot command & flow handlers
│   ├── keyboards.js    # Inline keyboard factories
│   └── server.js       # Express OAuth callback server
├── .env.example
├── package.json
└── README.md
```

---

## 🔒 Security Notes

- Tokens are stored **in-memory** by default. They are lost on restart.
- For production: replace `store.js` with **Redis** or a database.
- Never commit your `.env` file.

---

## 🛠 Available Commands

| Command | Description |
|---|---|
| `/start` | Welcome screen |
| `/menu` | Main menu |
| `/inbox` | View latest emails |
| `/compose` | Send a new email |
| `/search` | Search inbox |
| `/account` | View connected account |
| `/logout` | Disconnect Gmail |
| `/help` | Show all commands |
