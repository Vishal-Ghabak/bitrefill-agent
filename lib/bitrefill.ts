// Bitrefill API client
// MOCK_MODE is active when no API key is set — returns realistic fake data so demos always work
// When you get your Bitrefill API key on the day, add it to .env.local and real calls take over

const BASE_URL = 'https://api.bitrefill.com/v2'
const API_KEY = process.env.BITREFILL_API_KEY
const MOCK_MODE = !API_KEY

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PRODUCTS: Record<string, object[]> = {
  default: [
    { id: 'esim-jp-5gb', name: 'Japan eSIM 5GB / 30 days', category: 'esim', country: 'JP', price_eur: 18, description: 'Works on SoftBank network. Instant activation.' },
    { id: 'esim-jp-10gb', name: 'Japan eSIM 10GB / 30 days', category: 'esim', country: 'JP', price_eur: 28, description: 'Works on SoftBank network. Best value for longer trips.' },
    { id: 'netflix-de-25', name: 'Netflix Gift Card €25 (Germany)', category: 'giftcard', country: 'DE', price_eur: 25, description: 'Redeemable on Netflix.com/de' },
    { id: 'spotify-eu-10', name: 'Spotify Premium 1 Month (EU)', category: 'giftcard', country: 'EU', price_eur: 10, description: 'One month Spotify Premium' },
    { id: 'amazon-de-25', name: 'Amazon.de Gift Card €25', category: 'giftcard', country: 'DE', price_eur: 25, description: 'Valid on Amazon Germany' },
    { id: 'topup-de-telekom-15', name: 'Telekom Germany Top-up €15', category: 'topup', country: 'DE', price_eur: 15, description: 'Works for all Telekom prepaid numbers' },
  ],
}

const MOCK_ORDER = {
  order_id: `ORDER-${Date.now()}`,
  status: 'pending',
  payment_method: 'lightning',
  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
}

const MOCK_CONFIRMATION = {
  status: 'completed',
  product_code: 'XXXX-YYYY-ZZZZ-1234',
  delivery: 'instant',
  message: 'Purchase complete. Product code delivered.',
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function bitrefillFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`Bitrefill API error: ${res.status} ${await res.text()}`)
  return res.json()
}

// ─── Tool executors ───────────────────────────────────────────────────────────

export async function searchProducts(params: {
  query: string
  country?: string
  category?: string
}) {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 600))
    const results = MOCK_PRODUCTS.default.filter(p => {
      const product = p as { name: string; country?: string; category?: string }
      const matchesQuery = product.name.toLowerCase().includes(params.query.toLowerCase().split(' ')[0])
      const matchesCountry = !params.country || product.country === params.country
      const matchesCategory = !params.category || product.category === params.category
      return matchesQuery || matchesCountry || matchesCategory
    })
    return { products: results.length > 0 ? results : MOCK_PRODUCTS.default.slice(0, 3), mock: true }
  }

  const qs = new URLSearchParams({ q: params.query })
  if (params.country) qs.set('country', params.country)
  if (params.category) qs.set('category', params.category)
  return bitrefillFetch(`/products?${qs}`)
}

export async function getProductDetails(params: { product_id: string }) {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 400))
    const product = (MOCK_PRODUCTS.default as Array<{ id: string }>).find(p => p.id === params.product_id)
    return { product: product ?? MOCK_PRODUCTS.default[0], denominations: [10, 15, 20, 25, 30, 50], mock: true }
  }
  return bitrefillFetch(`/products/${params.product_id}`)
}

export async function createOrder(params: {
  product_id: string
  denomination: number
  currency: string
  email?: string
}) {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 700))
    return { ...MOCK_ORDER, product_id: params.product_id, denomination: params.denomination, currency: params.currency, mock: true }
  }
  return bitrefillFetch('/orders', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function confirmPurchase(params: { order_id: string }) {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 800))
    return { ...MOCK_CONFIRMATION, order_id: params.order_id, mock: true }
  }
  return bitrefillFetch(`/orders/${params.order_id}/confirm`, { method: 'POST' })
}

// ─── Dispatcher — called by agent loop ────────────────────────────────────────

export async function executeTool(name: string, input: Record<string, unknown>) {
  switch (name) {
    case 'search_products':
      return searchProducts(input as Parameters<typeof searchProducts>[0])
    case 'get_product_details':
      return getProductDetails(input as Parameters<typeof getProductDetails>[0])
    case 'create_order':
      return createOrder(input as Parameters<typeof createOrder>[0])
    case 'confirm_purchase':
      return confirmPurchase(input as Parameters<typeof confirmPurchase>[0])
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

export { MOCK_MODE }
