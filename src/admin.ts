import { Dispatcher, filters, MessageContext, PropagationAction } from "@mtcute/dispatcher";
import { html, InputPeerLike } from "@mtcute/node";
import { config } from "./config.js";

const dp = Dispatcher.child()

const cachedAdmins = new Map<string, boolean>()

async function verifyAdmin(ctx: MessageContext): Promise<boolean> {
    if (!config.chats[ctx.chat.id]?.adminCommands) return false
    if (ctx.sender.id === ctx.chat.id) return false

    const adminKey = `${ctx.chat.id}:${ctx.sender.id}`
    let cached = cachedAdmins.get(adminKey)
    if (cached === undefined) {
        const member = await ctx.client.getChatMember({ chatId: ctx.chat, userId: ctx.sender })
        cached = member != null && member.permissions?.banUsers === true
        cachedAdmins.set(adminKey, cached)
    }

    if (!cached) {
        await ctx.replyText('you are not an admin')
        return false
    }

    return true
}

dp.onNewMessage(filters.command(['kick', 'ban']), async (ctx) => {
    if (!(await verifyAdmin(ctx))) return

    const isKick = ctx.command[0] === 'kick'
    let idOrUsername: InputPeerLike = ctx.command[1]

    if (!idOrUsername) {
        if (ctx.replyToMessage != null) {
            const repliedMsg = await ctx.getReplyTo()
            if (!repliedMsg) return
            idOrUsername = repliedMsg.sender.id
        } else {
            await ctx.replyText('no user specified')
            return
        }
    }

    if (typeof idOrUsername === 'string' && idOrUsername.match(/^\d+$/)) {
        idOrUsername = Number(idOrUsername)
    }

    let msg
    if (isKick) {
        msg = await ctx.client.kickChatMember({ chatId: ctx.chat, userId: idOrUsername })
    } else {
        msg = await ctx.client.banChatMember({ chatId: ctx.chat, participantId: idOrUsername })
    }

    if (!msg) {
        await ctx.replyText(html`💔 <code>${idOrUsername}</code> was ${isKick ? 'kicked' : 'banned'} from the chat`)
    }
})

export { dp as adminDp }