// 访客留言的写入口（Server Action）。
//
// 与 Directus 版本的架构差异：那边前端必须带着 Public 角色的 token 去 POST
// `/items/messages`，等价于把「集合可写」这件事开给整个互联网；这里的写入
// 发生在 Server Action 内部，经 Payload Local API 直接进库，
// 对外不暴露任何 REST 创建端点。留言表单刻意对匿名访客开放（转化路径），
// 但攻击面收敛到这一个函数：没有可枚举的公开写接口，字段也在函数内被裁剪。
'use server'

import { getPayloadClient } from '@/lib/payload'

/** 与 collections/Messages.ts 的 maxLength / beforeChange 保持一致（2000）。 */
const MAX_CONTENT_LENGTH = 2000
const MAX_NAME_LENGTH = 120
const MAX_CONTACT_LENGTH = 200

interface SubmitMessageInput {
  content: string
  contactName?: string
  contactInfo?: string
  cardId?: number | null
}

type SubmitMessageResult = { ok: true } | { ok: false; error: string }

/** 去空白并截断；空串一律当成「没填」，不写空字符串进库。 */
function cleanText(value: string | undefined, max: number): string | null {
  const trimmed = (value ?? '').toString().trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/** URL 来的卡牌 id：只接受正整数，其余（NaN / 0 / 负数 / 小数）一律丢掉。 */
function normalizeCardId(value: number | null | undefined): number | null {
  if (value == null) return null
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export async function submitMessage(input: SubmitMessageInput): Promise<SubmitMessageResult> {
  const content = (input?.content ?? '').toString().trim()
  if (!content) return { ok: false, error: '留言内容不能为空' }
  if (content.length > MAX_CONTENT_LENGTH) {
    return { ok: false, error: `留言内容不能超过 ${MAX_CONTENT_LENGTH} 个字符` }
  }

  const requestedCardId = normalizeCardId(input?.cardId)
  const data = {
    content,
    contactName: cleanText(input?.contactName, MAX_NAME_LENGTH),
    contactInfo: cleanText(input?.contactInfo, MAX_CONTACT_LENGTH),
    card: null as number | null,
  }

  try {
    const payload = await getPayloadClient()
    // 卡牌上下文是「顺带」的信息：id 来自 URL，可能是过期的（卡已下架）。
    // 先确认它还在，不存在就丢掉关联而不是让整条留言写入失败——
    // 访客写了一段话，不该因为外键冲突而全部丢失。
    if (requestedCardId) {
      try {
        await payload.findByID({
          collection: 'cards',
          id: requestedCardId,
          depth: 0,
          overrideAccess: true,
        })
        data.card = requestedCardId
      } catch {
        data.card = null
      }
    }

    await payload.create({
      collection: 'messages',
      data: {
        content: data.content,
        contactName: data.contactName,
        contactInfo: data.contactInfo,
        card: data.card ?? null,
        // status 在集合里有 default，但生成的类型是必填；显式给出还有一个副作用上的好处：
        // beforeChange 只对匿名提交强制写 'new'，登录用户（如在后台补录）走原样返回分支。
        status: 'new',
      },
      overrideAccess: true,
    })
    return { ok: true }
  } catch (error) {
    // 具体原因只进服务端日志：访客需要的是「发生了什么 + 下一步做什么」，
    // 不是数据库驱动抛出的原始信息。
    console.error('[message] submit failed', error)
    return { ok: false, error: 'message create failed' }
  }
}
