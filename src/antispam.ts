import { User } from "@mtcute/node";
import emojiRegex from 'emoji-regex'

export type AutoBanDecision = 
    | { ban: false }
    | { ban: true, reason: string }

const PUNCTUATION = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~\s\uFF01\uFF1F\uFF61\u3002」﹂”』’》）］｝〕〗〙〛〉】]/.source

const allRegex = (regex: RegExp) => new RegExp(`^(${regex.source}|${PUNCTUATION}|${emojiRegex().source})+$`, 'i')

// holy shit - https://stackoverflow.com/questions/21109011/javascript-unicode-string-chinese-character-but-no-punctuation
const CHINESE_REGEX = allRegex(/[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]|[\u4e00-\u9fa5]/)
const ARAB_REGEX = allRegex(/[\u0600-\u06FF]/)
const HINDI_REGEX = allRegex(/[\u0900-\u097F]/)

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
]

export function shouldAutomaticallyBan(user: User) {
    const { firstName, lastName, username, id } = user

    if (firstName.match(CHINESE_REGEX) || lastName?.match(CHINESE_REGEX)) {
        return { ban: true, reason: 'chinese' }
    }

    if (firstName.match(ARAB_REGEX) || lastName?.match(ARAB_REGEX)) {
        return { ban: true, reason: 'arab' }
    }

    if (firstName.match(HINDI_REGEX) || lastName?.match(HINDI_REGEX)) {
        return { ban: true, reason: 'india' }
    }

    for (const word of BANNED_WORDS) {
        if (firstName.includes(word) || lastName?.includes(word)) {
            return { ban: true, reason: `word: ${word}` }
        }
    }

    return { ban: false }
}