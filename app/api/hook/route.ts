import { z } from 'zod'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import TelegramBot from 'node-telegram-bot-api'
import OpenAI from 'openai'
import prompt from '@/ai/prompt'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const WebHookSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean(),
      first_name: z.string(),
      username: z.string(),
      language_code: z.string(),
    }),
    chat: z.object({
      id: z.number(),
      first_name: z.string(),
      username: z.string(),
      type: z.string(),
    }),
    date: z.number(),
    text: z.string(),
  }),
})

type WebHook = z.infer<typeof WebHookSchema>

async function complete(messages: OpenAI.ChatCompletionMessageParam[]) {
  const completion = await openai.chat.completions.create({ messages, model: 'gpt-4o-2024-05-13' })
  return completion.choices[0].message.content ?? undefined
}

const commands = ['code', 'menu', 'q']
const commandsRegex = new RegExp(`^\/(${ commands.join('|') })`)
const CommandSchema = z.object({
  label: z.string(),
  content: z.string(),
})
type Command = z.infer<typeof CommandSchema>
function parseCommand(text: string) {
  return CommandSchema.parse({
    label: text.match(commandsRegex)?.[1] ?? 'default',
    content: text.replace(commandsRegex, '').trim()
  })
}

async function fetchCode(owner: string, repo: string, branch: string, path: string) {
  const response = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
    { headers: { Authorization: `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}` } }
  )
  return response.text()
}

const handlers : { 
  [index: string]: (hook: WebHook, command: Command) => Promise<string | undefined>
} = {
  default: async () => undefined,

  code: async (hook: WebHook, command: Command) => {
    const code_path = 'app/api/hook/route.ts'
    const code = await fetchCode('murderteeth', 'botbot', 'main', code_path)
    return complete([
      { role: 'system', content: prompt.system.default },
      { role: 'user', content: prompt.user.code({
        message: JSON.stringify({
        ...hook.message, text: command.content
        }),
        code_path, code
      }) }
    ])
  },

  menu: async () => 'menu',

  q: async (hook: WebHook, command: Command) => {
    return complete([
      { role: 'system', content: prompt.system.default },
      { role: 'user', content: prompt.user.default({ message: JSON.stringify({
        ...hook.message, text: command.content
      }) }) }
    ])
  }
}

export async function POST(request: NextRequest) {
  const hook = WebHookSchema.parse(await request.json())
  const bot = new TelegramBot(process.env.TELEGRAM_TOKEN ?? '')
  await bot.sendChatAction(hook.message.chat.id, 'typing')

  const command = parseCommand(hook.message.text)
  const response = await handlers[command.label](hook, command)
  if (response) {
    await bot.sendMessage(hook.message.chat.id, response, { parse_mode: 'Markdown' })
  }

  return NextResponse.json({ ok: 'ok' })
}
