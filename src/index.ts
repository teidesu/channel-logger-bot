import { CallbackDataBuilder, Dispatcher, filters } from '@mtcute/dispatcher'
import { BotKeyboard, ParametersSkip1, TelegramClient, User, html } from '@mtcute/node'

import * as env from './env.js'
import { shouldAutomaticallyBan } from './antispam.js'

const tg = new TelegramClient({
    apiId: env.API_ID,
    apiHash: env.API_HASH,
    storage: 'bot-data/session',
})

const dp = Dispatcher.for(tg)

dp.onNewMessage(filters.start, async (msg) => {
    await msg.answerText('Hello, world!')
})

const BanCallback = new CallbackDataBuilder('ban', 'chatId', 'userId')
const UnbanCallback = new CallbackDataBuilder('unban', 'chatId', 'userId')

// chatId -> expires
const confirms = new Map<number, number>()

async function sendToAllAdminsExcept(
    chatId: number, 
    except: number | null,
    ...params: ParametersSkip1<TelegramClient['sendText']>
) {
    const admins = env.CHANNEL_ADMINS.get(chatId)
    if (!admins?.size) return

    await Promise.all(
        [...admins]
            .filter((id) => id !== except)
            .map((id) => tg.sendText(id, ...params))
    )
}

async function sendToAllAdmins(
    chatId: number, 
    ...params: ParametersSkip1<TelegramClient['sendText']>
) {
    await sendToAllAdminsExcept(chatId, null, ...params)
}

function mentionUser(user: User) {
    if (user.username) {
        return html`${user.mention(null)} (@${user.username}, ID <code>${user.id}</code>)`
    }

    return html`${user.mention(null)} (ID <code>${user.id}</code>)`
}

dp.onChatMemberUpdate(
    filters.and(
        filters.chatId([...env.CHANNEL_ADMINS.keys()]), 
        filters.chatMember(['added', 'joined'])
    ),
    async (update) => {
        const decision = env.ANTISPAM_ENABLED.has(update.chat.id) 
            ? shouldAutomaticallyBan(update.user) 
            : null

        if (decision?.ban) {
            await tg.banChatMember({ 
                chatId: update.chat.id, 
                participantId: update.user.id
            })
            await sendToAllAdmins(
                update.chat.id,
                html`Banned ${mentionUser(update.user)} in ${update.chat.mention()}. Reason - ${decision.reason}`,
                {
                    replyMarkup: BotKeyboard.inline([
                        [BotKeyboard.callback('Unban', UnbanCallback.build({ 
                            chatId: String(update.chat.id),
                            userId: String(update.user.id) 
                        }))]
                    ]),
                    silent: true,
                }
            )

            return
        }

        await sendToAllAdmins(
            update.chat.id,
            html`New user joined ${update.chat.mention()}: ${mentionUser(update.user)}`,
            {
                replyMarkup: BotKeyboard.inline([
                    [BotKeyboard.callback('Ban', BanCallback.build({
                        chatId: String(update.chat.id),
                        userId: String(update.user.id) 
                    }))]
                ])
            }
        )
    }
)

dp.onChatMemberUpdate(
    filters.and(
        filters.chatId([...env.CHANNEL_ADMINS.keys()]), 
        filters.chatMember('left')
    ),
    async (update) => {
        const text = html`User left ${update.chat.mention()}: ${mentionUser(update.user)}`
        await sendToAllAdmins(update.chat.id, text)

        if (env.LEAVE_MESSAGES_ENABLED.has(update.chat.id)) {
            await tg.sendText(update.chat.id, text)
        }
    }
)

dp.onChatMemberUpdate(
    filters.and(
        filters.chatMemberSelf,
        filters.chatMember(['added', 'joined']),
        filters.not(
            filters.chatId([...env.CHANNEL_ADMINS.keys()])
        )
    ),
    async (update) => {
        await update.client.leaveChat(update.chat.id)
    }
)

dp.onCallbackQuery(BanCallback.filter(), async (query) => {
    const chatId = parseInt(query.match.chatId)

    if (!env.CHANNEL_ADMINS.get(chatId)?.has(query.user.id)) {
        await query.answer({ text: 'You are not an admin!' })
        return
    }

    const confirmExpires = confirms.get(query.user.id)
    if (!confirmExpires || confirmExpires < Date.now()) {
        await query.answer({ text: 'Click the button again within 1 minute to confirm' })
        confirms.set(query.user.id, Date.now() + 1000 * 60)
        return
    }
    
    confirms.delete(query.user.id)
    await tg.banChatMember({ chatId, participantId: parseInt(query.match.userId) })
    await query.answer({ text: 'Banned!' })
    
    await query.editMessageWith(async (msg) => ({
        text: html`
            ${msg.textWithEntities}
            <br /><br/>
            Banned!
        `,
    }))
    await sendToAllAdminsExcept(
        chatId,
        query.user.id,
        html`${query.user.mention()} banned ${query.match.userId} in ${query.chat.mention()}`
    )
})

dp.onCallbackQuery(UnbanCallback.filter(), async (query) => {
    const chatId = parseInt(query.match.chatId)

    if (!env.CHANNEL_ADMINS.get(chatId)?.has(query.user.id)) {
        await query.answer({ text: 'You are not an admin!' })
        return
    }

    const confirmExpires = confirms.get(query.user.id)
    if (!confirmExpires || confirmExpires < Date.now()) {
        await query.answer({ text: 'Click the button again within 1 minute to confirm' })
        confirms.set(query.user.id, Date.now() + 1000 * 60)
        return
    }

    confirms.delete(query.user.id)
    await tg.unbanChatMember({ chatId, participantId: parseInt(query.match.userId) })
    await query.answer({ text: 'Unbanned!' })
    
    await query.editMessageWith(async (msg) => ({
        text: html`
            ${msg.textWithEntities}
            <br /><br/>
            Unbanned!
        `,
    }))
    await sendToAllAdminsExcept(
        chatId,
        query.user.id,
        html`${query.user.mention()} unbanned ${query.match.userId} in ${query.chat.mention()}`
    )
})

tg.run(
    { botToken: env.BOT_TOKEN },
    async (user) => {
        console.log('Logged in as', user.username)
    },
)
