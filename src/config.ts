import { readFileSync } from 'fs'
import { parse } from 'smol-toml'
import { z } from 'zod'

const rawConfig = parse(readFileSync(process.env.CONFIG_FILE ?? 'config.toml', 'utf-8'))

const ChatSchema = z.object({
    admins: z.array(z.number()).transform((admins) => new Set(admins)),
    antispam: z.boolean().optional(),
    captcha: z.boolean().optional(),
    adminCommands: z.boolean().optional(),
    leaveMessages: z.boolean().optional(),
    bannedInlineBots: z.array(z.string()).optional().transform((bots) => bots ? new Set(bots) : null),
})
export type ChatConfig = z.infer<typeof ChatSchema>

export const config = z.object({
    apiId: z.number(),
    apiHash: z.string(),
    botToken: z.string(),
    chats: z.record(z.coerce.number(), ChatSchema),
}).parse(rawConfig)
