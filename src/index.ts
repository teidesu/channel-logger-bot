import { CallbackDataBuilder, Dispatcher, filters } from '@mtcute/dispatcher'
import { BotKeyboard, ParametersSkip1, TelegramClient, User, html } from '@mtcute/node'

import { config } from './config.js'
import { captchaDp, handleCaptchaJoin } from './captcha.js'
import { shouldAutomaticallyBan } from './antispam.js'
import { adminDp } from './admin.js'
import { asNonNull } from '@fuman/utils'

const tg = new TelegramClient({
    apiId: config.apiId,
    apiHash: config.apiHash,
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
    const admins = config.chats[chatId]?.admins
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
        filters.chatId(Object.keys(config.chats)),
        filters.chatMember(['added', 'joined'])
    ),
    async (ctx) => {
        const chatConfig = config.chats[ctx.chat.id]

        const decision = chatConfig.antispam
            ? shouldAutomaticallyBan(ctx.user) 
            : null

        if (decision?.ban) {
            await tg.banChatMember({ 
                chatId: ctx.chat.id, 
                participantId: ctx.user.id
            })
            await sendToAllAdmins(
                ctx.chat.id,
                html`Banned ${mentionUser(ctx.user)} in ${ctx.chat.mention()}. Reason - ${decision.reason}`,
                {
                    replyMarkup: BotKeyboard.inline([
                        [BotKeyboard.callback('Unban', UnbanCallback.build({ 
                            chatId: String(ctx.chat.id),
                            userId: String(ctx.user.id) 
                        }))]
                    ]),
                    silent: true,
                }
            )

            return
        }

        if (chatConfig.captcha) {
            await handleCaptchaJoin(ctx)

            return
        }

        await sendToAllAdmins(
            ctx.chat.id,
            html`New user joined ${ctx.chat.mention()}: ${mentionUser(ctx.user)}`,
            {
                replyMarkup: BotKeyboard.inline([
                    [BotKeyboard.callback('Ban', BanCallback.build({
                        chatId: String(ctx.chat.id),
                        userId: String(ctx.user.id) 
                    }))]
                ])
            }
        )
    }
)

dp.onChatMemberUpdate(
    filters.and(
        filters.chatId(Object.keys(config.chats)),
        filters.chatMember('left')
    ),
    async (update) => {
        const text = html`User left ${update.chat.mention()}: ${mentionUser(update.user)}`
        await sendToAllAdmins(update.chat.id, text)

        const chatConfig = config.chats[update.chat.id]

        if (chatConfig.leaveMessages) {
            await tg.sendText(update.chat.id, text)
        }
    }
)

dp.onChatMemberUpdate(
    filters.and(
        filters.chatMemberSelf,
        filters.chatMember(['added', 'joined']),
        filters.not(
            filters.chatId(Object.keys(config.chats))
        )
    ),
    async (update) => {
        await update.client.leaveChat(update.chat.id)
    }
)

dp.onCallbackQuery(BanCallback.filter(), async (query) => {
    const chatId = parseInt(query.match.chatId)

    if (!config.chats[chatId]?.admins?.has(query.user.id)) {
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

    if (!config.chats[chatId]?.admins?.has(query.user.id)) {
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

dp.extend(captchaDp)
dp.extend(adminDp)

tg.run(
    { botToken: config.botToken },
    async (user) => {
        console.log('Logged in as', user.username)
    },
)