# My Bitrefill Buddy

Send a gift card to anyone in one Telegram message. An AI agent searches Bitrefill, picks the best options, buys autonomously, and delivers the gift straight to your friend's inbox.

## Demo

[▶ Watch the demo video](#) <!-- replace with your video link -->

## How it works

1. **You send one message** — "Gift Alex at alex@gmail.com for shipping the feature"
2. **Bot asks for interests** — "What are Alex's interests?"
3. **You reply** — "coffee" / "gaming" / "music" / anything
4. **Agent searches Bitrefill** (REST API) and shows top options as buttons
5. **You tap one** — everything else is autonomous
6. **Agent buys via Bitrefill MCP** — `buy-products` → polls `get-invoice-by-id` until delivered
7. **Gift email sent** to recipient, confirmation shown in Telegram

## Tech stack

| Layer | Tool |
|-------|------|
| Conversation | Telegram (grammy) |
| Intent parsing | Claude Haiku |
| Product discovery | Bitrefill REST API |
| Autonomous purchase | Claude Sonnet + Bitrefill MCP |

**Why REST for discovery, MCP for purchase?** REST is the right tool for fast catalog reads — no AI reasoning needed. MCP shines for the purchase workflow: the agent sequences `buy-products` → `get-invoice-by-id`, handles polling, reads redemption codes, and delivers without any human clicking pay.

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd bitrefill-agent
npm install
```

### 2. Create `.env.local`

```
ANTHROPIC_API_KEY=sk-ant-...
BITREFILL_API_KEY=...
TELEGRAM_BOT_TOKEN=...
```

Get your keys:
- Anthropic API key: [console.anthropic.com](https://console.anthropic.com)
- Bitrefill API key: [bitrefill.com/developers](https://www.bitrefill.com/developers)
- Telegram bot token: message [@BotFather](https://t.me/BotFather) on Telegram

### 3. Run the bot

```bash
npm run bot
```

### 4. Message the bot

Find your bot on Telegram and send:

```
Gift Alex at alex@example.com for shipping the feature
```

## Try it live

**[@mybitrefillbuddy_bot](https://t.me/mybitrefillbuddy_bot)** on Telegram

## Hackathon

Built for the [Bitrefill PROMPT × PURCHASE Hackathon](https://bitrefill.com) · June 2026 · Berlin
