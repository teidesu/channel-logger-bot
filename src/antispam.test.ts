import { createStub } from '@mtcute/test'
import { describe, it, expect } from 'vitest'

import { shouldAutomaticallyBan } from './antispam.js'
import { User } from '@mtcute/node'

describe('shouldAutomaticallyBan', () => {
    it.each([
        ['chinese', '最新活动出锅啦！', '新^澳^综^合'],
        ['chinese', '专线服务器', '稳定好'],
        ['chinese', 'p1', '久久鸭货专'],
        ['chinese', '每日鲜🍻', ''],
        ['chinese', '玩家手机📱配', ''],
        ['chinese', '于永义', ''],
        ['chinese', '曲奇！！！', ''],
        ['word: rahul', 'Rahul Gachar', 'Rahul Gachar'],
    ])('rule "%s" should ban %s %s', (rule, firstName, lastName) => {
        const stub = createStub('user', { 
            firstName,
            lastName: lastName === '' ? undefined : lastName,
        })
        
        expect(shouldAutomaticallyBan(new User(stub))).toEqual({ ban: true, reason: rule })
    })
})