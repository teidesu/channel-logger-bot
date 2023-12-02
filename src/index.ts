import { CallbackDataBuilder, Dispatcher, filters } from '@mtcute/dispatcher'
import { BotKeyboard, NodeTelegramClient, html } from '@mtcute/node'

import * as env from './env.js'
import { shouldAutomaticallyBan } from './antispam.js'

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
const UnbanCallback = new CallbackDataBuilder('unban', 'id')

dp.onChatMemberUpdate(
    filters.and(
        filters.chatId(env.CHANNEL_ID), 
        filters.chatMember('joined')
    ),
    async (update) => {
        const decision = shouldAutomaticallyBan(update.user)

        if (decision.ban) {
            await tg.banChatMember({ chatId: env.CHANNEL_ID, participantId: update.user.id })
            await tg.sendText(
                env.ADMIN_ID,
                html`Banned ${update.user.mention()} (ID <code>${update.user.id}</code>). Reason - ${decision.reason}`,
                {
                    replyMarkup: BotKeyboard.inline([
                        [BotKeyboard.callback('Unban', UnbanCallback.build({ id: String(update.user.id) }))]
                    ]),
                    silent: true,
                }
            )

            return
        }

        await tg.sendText(
            env.ADMIN_ID,
            html`New user joined: ${update.user.mention()} (ID <code>${update.user.id}</code>)`,
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

dp.onCallbackQuery(BanCallback.filter(), async (query) => {
    await tg.banChatMember({ chatId: env.CHANNEL_ID, participantId: parseInt(query.match.id) })
    await query.answer({ text: 'Banned!' })
    
    await query.editMessageWith(async (msg) => ({
        text: html`
            ${msg.textWithEntities}
            <br /><br/>
            Banned!
        `,
    }))
})

dp.onCallbackQuery(UnbanCallback.filter(), async (query) => {
    await tg.unbanChatMember({ chatId: env.CHANNEL_ID, participantId: parseInt(query.match.id) })
    await query.answer({ text: 'Banned!' })
    
    await query.editMessageWith(async (msg) => ({
        text: html`
            ${msg.textWithEntities}
            <br /><br/>
            Unbanned!
        `,
    }))
})

tg.run(
    { botToken: env.BOT_TOKEN },
    async (user) => {
        console.log('Logged in as', user.username)
    },
)
