import Anthropic from '@anthropic-ai/sdk'

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_products',
    description:
      'Search Bitrefill catalog for products matching a query. Use this to find eSIMs, gift cards, mobile top-ups, or any digital product. Filter by country when relevant.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term e.g. "Japan eSIM", "Netflix Germany", "Spotify gift card"',
        },
        country: {
          type: 'string',
          description: 'ISO 2-letter country code to filter results e.g. "JP", "DE", "US"',
        },
        category: {
          type: 'string',
          enum: ['esim', 'topup', 'giftcard', 'utility'],
          description: 'Product category to narrow the search',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_details',
    description:
      'Get full details for a specific product: available denominations, prices, validity, and any purchase instructions.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID returned from search_products',
        },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'create_order',
    description:
      'Create a purchase order for a specific product and denomination. Returns an order ID and payment details.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID to purchase',
        },
        denomination: {
          type: 'number',
          description: 'The value/amount to purchase (in the product\'s currency)',
        },
        currency: {
          type: 'string',
          description: 'Currency code for the denomination e.g. "EUR", "USD"',
        },
        email: {
          type: 'string',
          description: 'Email address to deliver the product to (optional)',
        },
      },
      required: ['product_id', 'denomination', 'currency'],
    },
  },
  {
    name: 'confirm_purchase',
    description:
      'Confirm and complete a pending order. This executes the actual purchase. Only call this after create_order.',
    input_schema: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'The order ID returned from create_order',
        },
      },
      required: ['order_id'],
    },
  },
]
