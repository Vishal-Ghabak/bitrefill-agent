# My Bitrefill Buddy

Send a gift card to anyone in one Telegram message. An AI agent searches Bitrefill, picks the best options, buys autonomously, and delivers the gift straight to your friend's inbox.

## Demo

[▶ Watch the demo video](https://youtu.be/kI1dIYYfzxA)

**Live bot:** [@mybitrefillbuddy_bot](https://t.me/mybitrefillbuddy_bot)

## How it works

1. **Describe the gift** — `"Gift Alex at alex@gmail.com for shipping the feature"`
   - Optionally include a budget: `"…keep it under €10"`
   - Optionally include a location: `"…he's based in the US"` (defaults to Germany)
2. **Bot asks one question** — `"What are Alex's interests?"`
3. **You reply** — `"coffee"`, `"gaming"`, `"music"`, or anything
4. **Agent searches Bitrefill** and shows the top matching options as buttons, filtered by your budget and country
5. **You tap one** — everything else is autonomous
6. **Agent buys via Bitrefill MCP** — `buy-products` → polls `get-invoice-by-id` until delivered
7. **Gift card emailed** to the recipient, redemption code confirmed in Telegram

Type `cancel` at any point to abort the flow.

## Tech stack

| Layer | Tool |
|-------|------|
| Conversation | Telegram (grammy) |
| Intent + budget + country parsing | Claude Haiku |
| Product discovery | Bitrefill REST API |
| Autonomous purchase + delivery | Claude Sonnet + Bitrefill MCP |

**Why REST for discovery, MCP for purchase?** REST is the right tool for fast catalog reads — no AI reasoning needed. MCP shines for the purchase workflow: the agent sequences `buy-products` → `get-invoice-by-id`, handles polling, reads redemption codes, and delivers without any human clicking pay.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Vishal-Ghabak/bitrefill-agent.git
cd bitrefill-agent
npm install
```

### 2. Create `.env.local`

Copy the example file and fill in your keys:

```bash
cp .env.local.example .env.local
```

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

```
Gift Alex at alex@example.com for shipping the feature
```

## Hackathon

Built for the [Bitrefill PROMPT × PURCHASE Hackathon](https://bitrefill.com) · June 2026 · Berlin
