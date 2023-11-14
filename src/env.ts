const API_ID = parseInt(process.env.API_ID!)
const API_HASH = process.env.API_HASH!
const BOT_TOKEN = process.env.BOT_TOKEN!

if (isNaN(API_ID) || !API_HASH) {
    throw new Error('API_ID or API_HASH not set!')
}

const CHANNEL_ID = parseInt(process.env.CHANNEL_ID!)
const ADMIN_ID = parseInt(process.env.ADMIN_ID!)

if (isNaN(CHANNEL_ID) || isNaN(ADMIN_ID)) {
    throw new Error('CHANNEL_ID or ADMIN_ID not set!')
}

export { API_HASH, API_ID, ADMIN_ID, BOT_TOKEN, CHANNEL_ID }
