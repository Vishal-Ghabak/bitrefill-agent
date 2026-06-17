import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'  // used for parseIntent()
import { Bot, InlineKeyboard } from 'grammy'
import { runAgent } from './lib/agent'

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)
const anthropic = new Anthropic()

// ── Types ──────────────────────────────────────────────────────────────────

type GiftIntent = {
  recipientName: string
  recipientEmail: string
  occasion: string
  budgetEUR?: number     // extracted from message if mentioned
  countryCode: string    // 2-letter ISO code, default "DE"
}

type ProductOption = {
  productId: string
  packageId: string
  name: string
  label: string   // shown on button
}

type ConvState =
  | { step: 'idle' }
  | { step: 'awaiting_interests'; intent: GiftIntent }
  | { step: 'awaiting_selection'; intent: GiftIntent; options: ProductOption[] }
  | { step: 'buying' }

const sessions = new Map<number, ConvState>()

// ── MCP-powered product search ─────────────────────────────────────────────

// ── Product search via REST API (fast catalog reads) ──────────────────────

async function getSearchTerms(interest: string): Promise<string[]> {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    messages: [{
      role: 'user',
      content:
        `Give 3 specific Bitrefill gift card brand names for someone interested in "${interest}". ` +
        `Return ONLY a JSON array like ["steam", "xbox", "playstation"]. No explanation.`
    }]
  })
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (res.content[0] as any).text
    const match = raw.match(/\[[\s\S]*?\]/)
    if (!match) return [interest]
    return JSON.parse(match[0]) as string[]
  } catch {
    return [interest]
  }
}

async function searchWithMCP(interest: string, budgetEUR?: number, countryCode = 'DE'): Promise<ProductOption[]> {
  // Test shortcut — bypasses API to save credits
  if (interest.toLowerCase() === 'test') {
    return [{
      productId: 'delos-syldavia',
      packageId: 'delos-syldavia<&>0.01',
      name: 'Delos Test Voucher (€0.01)',
      label: 'Delos Test Voucher · €0.01',
    }]
  }

  const terms = await getSearchTerms(interest)

  // Two passes: first collect country-matched results, then anything as fallback
  const collect = async (filterCountry: boolean): Promise<ProductOption[]> => {
    const results: ProductOption[] = []
    const seen = new Set<string>()

    for (const term of terms) {
      if (results.length >= 3) break
      const url = `https://api.bitrefill.com/v2/products/search?q=${encodeURIComponent(term)}&limit=10`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.BITREFILL_API_KEY}` } })
      const data = await res.json()

      for (const p of (data.data ?? [])) {
        if (results.length >= 3) break
        if (!p.id || seen.has(p.id)) continue
        if (filterCountry && p.country_code !== countryCode) continue
        seen.add(p.id)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pkgs: any[] = p.packages ?? []
        if (!pkgs.length) continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sorted = pkgs.sort((a: any, b: any) => a.price - b.price)
        const currency: string = p.currency ?? ''

        const affordable = (budgetEUR && currency === 'EUR')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? sorted.filter((pkg: any) => Number(pkg.value) <= budgetEUR)
          : sorted

        const pkg = (affordable.length ? affordable[0] : sorted[0])
        const displayValue = currency === 'EUR' ? `€${pkg.value}` : `${pkg.value} ${currency}`
        results.push({ productId: p.id, packageId: pkg.id, name: p.name, label: `${p.name} · ${displayValue}` })
        break
      }
    }
    return results
  }

  const countryResults = await collect(true)
  return countryResults.length > 0 ? countryResults : collect(false)
}

// ── Intent extraction (fast Haiku call) ───────────────────────────────────

async function parseIntent(text: string): Promise<GiftIntent | null> {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content:
        'Extract a gift intent from this message. Return ONLY a JSON object:\n' +
        '{ "recipientName": string, "recipientEmail": string, "occasion": string, "budgetEUR": number | null, "countryCode": string }\n' +
        'budgetEUR: if a budget is mentioned (e.g. "under €10" → 10, "keep it under 5" → 5), else null.\n' +
        'countryCode: 2-letter ISO code if a country/location is mentioned (e.g. "based in US" → "US", "in Germany" → "DE"), else "DE".\n' +
        'If the email is missing return null.\n\n' +
        `Message: "${text}"`
    }]
  })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (res.content[0] as any).text
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (!parsed.recipientEmail?.includes('@')) return null
    return parsed as GiftIntent
  } catch {
    return null
  }
}

// ── Bot handlers ───────────────────────────────────────────────────────────

const CANCEL_WORDS = new Set(['cancel', 'stop', 'quit', 'abort', 'never mind', 'nevermind', 'nvm', 'no'])

bot.command('start', ctx =>
  ctx.reply(
    '👋 Hi! I\'m your Bitrefill gifting agent.\n\n' +
    'Try sending:\n"Gift Alex at alex@example.com for shipping the feature"\n\n' +
    'Type "cancel" at any time to stop.'
  )
)

bot.command('cancel', async ctx => {
  sessions.set(ctx.chat.id, { step: 'idle' })
  await ctx.reply('↩️ Cancelled. Start fresh whenever you\'re ready.')
})

bot.on('message:text', async ctx => {
  const chatId = ctx.chat.id
  const text = ctx.message.text.trim()
  const session = sessions.get(chatId) ?? { step: 'idle' }

  // Allow cancel from any active state
  if (CANCEL_WORDS.has(text.toLowerCase()) && session.step !== 'idle') {
    sessions.set(chatId, { step: 'idle' })
    await ctx.reply('↩️ Cancelled.')
    return
  }

  // ── Step 2: user replied with interests ──
  if (session.step === 'awaiting_interests') {
    const interest = text
    await ctx.reply('🔍 Searching Bitrefill for the best options...')

    try {
      const options = await searchWithMCP(interest, session.intent.budgetEUR, session.intent.countryCode)

      if (!options.length) {
        await ctx.reply('Hmm, nothing found for that. Try: gaming, music, food, coffee, sports')
        return
      }

      const keyboard = new InlineKeyboard()
      options.forEach((opt, i) => keyboard.text(opt.label, `pick:${i}`).row())

      sessions.set(chatId, { step: 'awaiting_selection', intent: session.intent, options })

      await ctx.reply(
        `Here are the top options for ${session.intent.recipientName}${session.intent.budgetEUR ? ` within your €${session.intent.budgetEUR} budget` : ''} 👇`,
        { reply_markup: keyboard }
      )
    } catch (err) {
      await ctx.reply(`❌ Search failed: ${String(err)}`)
      sessions.set(chatId, { step: 'idle' })
    }
    return
  }

  // Block new requests while a purchase is running
  if (session.step === 'buying') {
    await ctx.reply('⏳ Still processing your previous gift...')
    return
  }

  // ── Step 1: parse gift intent ──
  const intent = await parseIntent(text)

  if (!intent) {
    await ctx.reply(
      "I need a name, email, and reason. Try:\n" +
      '"Gift Alex at alex@example.com for shipping the feature"'
    )
    return
  }

  sessions.set(chatId, { step: 'awaiting_interests', intent })
  await ctx.reply(
    `🎁 Got it! Gifting ${intent.recipientName} for: *${intent.occasion}*\n\n` +
    `What are ${intent.recipientName}'s interests? _(e.g. gaming, music, food, coffee)_`,
    { parse_mode: 'Markdown' }
  )
})

// ── Step 3: user taps a product button ────────────────────────────────────

bot.on('callback_query:data', async ctx => {
  const chatId = ctx.chat!.id
  const data = ctx.callbackQuery.data
  const session = sessions.get(chatId)

  if (!data.startsWith('pick:') || session?.step !== 'awaiting_selection') {
    await ctx.answerCallbackQuery()
    return
  }

  const idx = parseInt(data.split(':')[1])
  const option = session.options[idx]
  const { intent } = session

  await ctx.answerCallbackQuery('Great choice!')
  await ctx.reply(`🛒 Buying *${option.name}* for ${intent.recipientName}...`, { parse_mode: 'Markdown' })

  sessions.set(chatId, { step: 'buying' })

  // Build a precise goal for the agent
  const goal =
    `Purchase this exact product on Bitrefill:\n` +
    `- product_id: "${option.productId}"\n` +
    `- package_id: "${option.packageId}"\n` +
    `- quantity: 1\n` +
    `Send it as a gift:\n` +
    `- recipient_name: "${intent.recipientName}"\n` +
    `- recipient_email: "${intent.recipientEmail}"\n` +
    `- sender_name: "Vishal"\n` +
    `- message: "Congratulations on ${intent.occasion}! 🎉"\n` +
    `- theme: "red"\n` +
    `Use payment_method: "balance", balance_currency: "EUR". ` +
    `After buying, poll get-invoice-by-id until delivered.`

  try {
    let summary = ''
    for await (const event of runAgent(goal)) {
      if (event.type === 'tool_call') {
        const tool = event.tool.includes('__') ? event.tool.split('__').pop()! : event.tool
        const labels: Record<string, string> = {
          'get-invoice-by-id': '⏳ Checking delivery status...',
        }
        if (labels[tool]) await ctx.reply(labels[tool])
      }
      if (event.type === 'done') summary = event.summary
      if (event.type === 'error') throw new Error(event.message)
    }

    const codeMatch = summary.match(/Code:\s*([^\n]+)/)
    const code = codeMatch?.[1]?.trim()

    await ctx.reply(
      `✅ *Gift sent to ${intent.recipientName}!*\n\n` +
      `🎁 ${option.name}\n` +
      `📧 ${intent.recipientEmail}\n` +
      (code ? `\n🔑 Redemption code: \`${code}\`` : ''),
      { parse_mode: 'Markdown' }
    )
  } catch (err) {
    await ctx.reply(`❌ Purchase failed: ${String(err)}`)
  } finally {
    sessions.set(chatId, { step: 'idle' })
  }
})

bot.catch(err => console.error('Bot error:', err.message))
bot.start()
console.log('✅ My Bitrefill Buddy is running.')
