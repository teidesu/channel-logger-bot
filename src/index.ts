import { CallbackDataBuilder, Dispatcher, filters } from '@mtcute/dispatcher'
import { BotKeyboard, NodeTelegramClient, html } from '@mtcute/node'

import * as env from './env.js'

const tg = new NodeTelegramClient({
    apiId: env.API_ID,
    apiHash: env.API_HASH,
    storage: 'bot-data/session',
})

const dp = Dispatcher.for(tg)

dp.onNewMessage(filters.start, async (msg) => {
    await msg.answerText('Hello, world!')
})

const BanCallback = new CallbackDataBuilder('ban', 'id')

dp.onChatMemberUpdate(
    filters.and(
        filters.chatId(env.CHANNEL_ID), 
        filters.chatMember('joined')
    ),
    async (update) => {
        await tg.sendText(
            env.ADMIN_ID,
            html`New user joined: ${update.user.mention()}`,
            {
                replyMarkup: BotKeyboard.inline([
                    [BotKeyboard.callback('Ban', BanCallback.build({ id: String(update.user.id) }))]
                ])
            }
        )
    }
)

dp.onChatMemberUpdate(
    filters.and(
        filters.chatId(env.CHANNEL_ID), 
        filters.chatMember('left')
    ),
    async (update) => {
        await tg.sendText(
            env.ADMIN_ID,
            html`User left: ${update.user.mention()}`
        )
    }
)

dp.onCallbackQuery(BanCallback.filter({}), async (query) => {
    await tg.banChatMember({ chatId: env.CHANNEL_ID, participantId: parseInt(query.match.id) })
    await query.answer({ text: 'Banned!' })
})

tg.run(
    { botToken: env.BOT_TOKEN },
    async (user) => {
        console.log('Logged in as', user.username)
    },
)
