import { CallbackDataBuilder, Dispatcher, UpdateContext } from '@mtcute/dispatcher'
import { BotKeyboard, Chat, ChatMemberUpdate, html, TelegramClient, User } from '@mtcute/node'
// @ts-expect-error no typings
import figlet from 'figlet'

const fonts = [
    '4max',
    'ANSI Regular',
    'ANSI Shadow',
    'Banner',
    'Basic',
    'Bell',
    'Big',
    'Broadway KB',
    'Chunky',
    'Computer',
    'DiamFont',
    'Doom',
    'Rectangles',
    'Slant',
    'Small',
    'Standard',
    'Dr Pepper',
]

export const CaptchaCallback = new CallbackDataBuilder('captcha', 'userId', 'captcha')

async function generateCaptcha(userId: number) {
    const string = Math.random().toString(36).slice(2, 5)
    const font = fonts[Math.floor(Math.random() * fonts.length)]
    let captcha: string = await figlet.text(string, { font })

    // figlet sometimes returns preceding/trailing whitespace lines
    const lines = captcha.split('\n')
    captcha = lines.filter((line) => line.trim()).join('\n')
    
    const options = [
        string,
        Math.random().toString(36).slice(2, 5),
        Math.random().toString(36).slice(2, 5),
        Math.random().toString(36).slice(2, 5),
    ].sort(() => Math.random() - 0.5)

    const mkButton = (index: number) => {
        const value = options[index]
        return BotKeyboard.callback(value, CaptchaCallback.build({
            userId: String(userId),
            captcha: value,
        }))
    } 

    return {
        font,
        captcha,
        solution: string,
        keyboard: BotKeyboard.inline(
            [
                [mkButton(0), mkButton(1)],
                [mkButton(2), mkButton(3)]
            ]
        )
    }
}

interface CaptchaState {
    solution: string
    chat: Chat
    user: User
    msgId: number
    timer: NodeJS.Timeout
    attempt: number
}
const captchaStates = new Map<string, CaptchaState>()

async function onCaptchaTimeout(client: TelegramClient, key: string) {
    const state = captchaStates.get(key)
    if (!state) return

    await client.editMessage({
        chatId: state.chat,
        message: state.msgId,
        text: html`💔 ${state.user.mention()} failed to complete captcha and was banned`,
    })
    captchaStates.delete(key)
    clearTimeout(state.timer)

    await client.banChatMember({
        chatId: state.chat,
        participantId: state.user
    })

    setTimeout(() => {
        client.deleteMessagesById(state.chat, [state.msgId]).catch(console.error)
    })
}

function buildCaptchaText(captcha: string, state: CaptchaState) {
    const hi = state.attempt === 0 
        ? html`👋 hey ${state.user.mention()}, welcome to ${state.chat.displayName}!` 
        : html`⚠️ you have ${3 - state.attempt} attempts left`
    return html`
        ${hi}
        <br /><br />
        please solve the captcha below within 2 minutes to continue:
        <br /><br />
        <pre>${captcha}</pre>
        <br />
        thanks!
    `
}

export async function handleCaptchaJoin(ctx: UpdateContext<ChatMemberUpdate>) {
    const captcha = await generateCaptcha(ctx.user.id)
    const captchaKey = `${ctx.chat.id}:${ctx.user.id}`

    await ctx.client.restrictChatMember({
        chatId: ctx.chat.id,
        userId: ctx.user.id,
        restrictions: {
            sendMessages: true,
        }
    })

    const state: CaptchaState = {
        solution: captcha.solution,
        timer: setTimeout(() => onCaptchaTimeout(ctx.client as TelegramClient, captchaKey), 120_000),
        msgId: 0,
        attempt: 0,
        chat: ctx.chat,
        user: ctx.user,
    }

    const msg = await ctx.client.sendText(
        ctx.chat.id,
        buildCaptchaText(captcha.captcha, state),
        {
            replyMarkup: captcha.keyboard
        }
    )

    state.msgId = msg.id
    captchaStates.set(captchaKey, state)
}

const dp = Dispatcher.child()

dp.onCallbackQuery(CaptchaCallback.filter(), async (ctx) => {
    const captchaKey = `${ctx.chat.id}:${ctx.match.userId}`
    const state = captchaStates.get(captchaKey)
    if (!state) return

    if (ctx.user.id !== state.user.id) {
        await ctx.answer({ text: 'this is not your captcha' })
        return
    }

    if (state.solution === ctx.match.captcha) {
        await ctx.answer({ text: 'thanks! enjoy your stay :3' })

        await ctx.client.deleteMessagesById(ctx.chat.id, [state.msgId])
        captchaStates.delete(captchaKey)
        clearTimeout(state.timer)

        await ctx.client.unrestrictChatMember({
            chatId: ctx.chat.id,
            participantId: ctx.user.id,
        })
        return
    }

    state.attempt += 1

    if (state.attempt === 3) {
        await onCaptchaTimeout(ctx.client as TelegramClient, captchaKey)
        await ctx.answer({
            text: 'sorry, you have been banned for spamming. please contact admins for unban', 
            alert: true
        })
        return
    }

    await ctx.answer({ text: 'incorrect captcha, please try again', alert: true })
    const newCaptcha = await generateCaptcha(ctx.user.id)

    state.solution = newCaptcha.solution
    await ctx.editMessage({
        text: buildCaptchaText(newCaptcha.captcha, state),
        replyMarkup: newCaptcha.keyboard
    })
})

export { dp as captchaDp }