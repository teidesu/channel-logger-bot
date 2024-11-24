const API_ID = parseInt(process.env.API_ID!)
const API_HASH = process.env.API_HASH!
const BOT_TOKEN = process.env.BOT_TOKEN!

if (isNaN(API_ID) || !API_HASH) {
    throw new Error('API_ID or API_HASH not set!')
}

const CHANNEL_ADMINS = new Map<number, Set<number>>()
const ANTISPAM_ENABLED = new Set<number>(process.env.ANTISPAM_ENABLED?.split(',').map(Number))
const LEAVE_MESSAGES_ENABLED = new Set<number>(process.env.LEAVE_MESSAGES_ENABLED?.split(',').map(Number))

for (const key of Object.keys(process.env)) {
    if (!key.startsWith('ADMINS_')) continue
    
    // docker .env doesn't support hyphens
    let str = key.slice(7)
    if (str[0] === '_') str = '-' + str.slice(1)
    
    const id = parseInt(str)
    
    if (isNaN(id)) {
        console.warn('Invalid admin ID:', key)
        continue
    }

    const admins = new Set(
        process.env[key]!
            .split(',')
            .map(Number)
            .filter(it => !isNaN(it))
    )

    if (admins.size) {
        CHANNEL_ADMINS.set(id, admins)
    }
}

export { API_HASH, API_ID, BOT_TOKEN, ANTISPAM_ENABLED, CHANNEL_ADMINS, LEAVE_MESSAGES_ENABLED }
