import { NextRequest } from 'next/server'
import { runAgent } from '@/lib/agent'

export async function POST(req: NextRequest) {
  const { goal } = await req.json()

  if (!goal?.trim()) {
    return new Response('Goal is required', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAgent(goal)) {
          const line = JSON.stringify(event) + '\n'
          controller.enqueue(encoder.encode(line))
        }
      } catch (err) {
        const error = JSON.stringify({ type: 'error', message: String(err) }) + '\n'
        controller.enqueue(encoder.encode(error))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
