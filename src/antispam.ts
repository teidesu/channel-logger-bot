import { User } from "@mtcute/node";
import emojiRegex from 'emoji-regex'

export type AutoBanDecision = 
    | { ban: false }
    | { ban: true, reason: string }

const PUNCTUATION = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~\s\uFF01\uFF1F\uFF61\u3002」﹂”』’》）］｝〕〗〙〛〉】]/.source
const PUNCTUATION_OR_EMOJI = `${PUNCTUATION}|${emojiRegex().source}`
const ALL_PUNCTUATION_OR_EMOJI = new RegExp(`^(${PUNCTUATION_OR_EMOJI})+$`, 'i')

const allRegex = (regex: RegExp) => new RegExp(`^(${regex.source}|${PUNCTUATION_OR_EMOJI})+$`, 'i')

// holy shit - https://stackoverflow.com/questions/21109011/javascript-unicode-string-chinese-character-but-no-punctuation
const CHINESE_REGEX = allRegex(/[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]|[\u4e00-\u9fa5]/)
const ARAB_REGEX = allRegex(/[\u0600-\u06FF]/)
const HINDI_REGEX = allRegex(/[\u0900-\u097F]/)

function isBad(regex: RegExp, str?: string | null) {
    if (!str) return false

    return str.match(regex) && !str.match(ALL_PUNCTUATION_OR_EMOJI)
}

const BANNED_WORDS = [
    'Rahul',
    'Pawan',
    'Sardaar',
    'Gurjar',
    'Sunil',
    'Prajapati',
    'Ankit',
    'Abhishek',
    'Meena',
    'Pratap',
    'Chauhan',
    'Azhari',
    'Tasleem',
    'KHUSHAL',
    'KHAN',
    'Sharma',
    'Parmar',
    'Harmanjot',
    'Mishra',
    'Gobinda',
    'Kumar',
    'Khaliq',
    'Ankush',
    'Rajnat',
    'Sarfaraj',
    'Rakesh'
].map(x => x.toLowerCase())

export function shouldAutomaticallyBan(user: User) {
    const { firstName, lastName } = user

    if (isBad(CHINESE_REGEX, firstName) || isBad(CHINESE_REGEX, lastName)) {
        return { ban: true, reason: 'chinese' }
    }

    if (isBad(ARAB_REGEX, firstName) || isBad(ARAB_REGEX, lastName)) {
        return { ban: true, reason: 'arab' }
    }

    if (isBad(HINDI_REGEX, firstName) || isBad(HINDI_REGEX, lastName)) {
        return { ban: true, reason: 'india' }
    }

    for (const word of BANNED_WORDS) {
        if (firstName.toLowerCase().includes(word) || lastName?.toLowerCase().includes(word)) {
            return { ban: true, reason: `word: ${word}` }
        }
    }

    return { ban: false }
}