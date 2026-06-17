import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from './system-prompt'

export type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; tool: string; input: Record<string, unknown> }
  | { type: 'done'; summary: string }
  | { type: 'error'; message: string }

export async function* runAgent(goal: string): AsyncGenerator<AgentEvent> {
  const client = new Anthropic()
  const apiKey = process.env.BITREFILL_API_KEY
  if (!apiKey) {
    yield {
      type: 'error',
      message: 'BITREFILL_API_KEY is not set. Add it to .env.local to run the agent.',
    }
    return
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await (client.beta.messages as any).create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      mcp_servers: [
        {
          type: 'url',
          url: `https://api.bitrefill.com/mcp/${apiKey}`,
          name: 'bitrefill',
        },
      ],
      messages: [{ role: 'user', content: goal }],
      stream: true,
      betas: ['mcp-client-2025-04-04'],
    })

    let blockType: string | null = null
    let textBuffer = ''
    let toolName = ''
    let toolInputBuffer = ''
    // Holds the most recent completed text block — emitted as 'thinking' only
    // when the NEXT block arrives, so the final text block goes to 'done' instead.
    let pendingThinking: string | null = null

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start': {
          const block = event.content_block
          // Flush pending thinking when a new block starts
          if (pendingThinking !== null) {
            yield { type: 'thinking', text: pendingThinking }
            pendingThinking = null
          }
          blockType = block.type
          if (blockType === 'text') {
            textBuffer = ''
          } else if (blockType === 'tool_use') {
            toolName = block.name ?? ''
            toolInputBuffer = ''
          }
          break
        }

        case 'content_block_delta': {
          const delta = event.delta
          if (delta.type === 'text_delta') {
            textBuffer += delta.text
          } else if (delta.type === 'input_json_delta') {
            toolInputBuffer += delta.partial_json ?? ''
          }
          break
        }

        case 'content_block_stop': {
          if (blockType === 'text' && textBuffer.trim()) {
            pendingThinking = textBuffer.trim()
            textBuffer = ''
          } else if (blockType === 'tool_use' && toolName) {
            let input: Record<string, unknown> = {}
            try {
              input = JSON.parse(toolInputBuffer || '{}')
            } catch {
              // leave input as empty object
            }
            yield { type: 'tool_call', tool: toolName, input }
            toolName = ''
            toolInputBuffer = ''
          }
          blockType = null
          break
        }
      }
    }

    // The last text block becomes the receipt — emit as 'done', not 'thinking'
    yield { type: 'done', summary: pendingThinking ?? '' }
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}
