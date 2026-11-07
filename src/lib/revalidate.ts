import { revalidateTag } from 'next/cache'
// 用于在调用前判断当前是否处于 Next 请求渲染上下文。脚本（seed / 迁移 / 控制台）
// 里这个 store 为空，revalidateTag 会抛 Invariant，需要先跳过。
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external'

import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
} from 'payload'

/**
 * 后台内容变更后，主动让对应的 Data Cache 标签失效，使前台在下次请求时立即回源重取，
 * 而不是等 TTL 自然过期。配合 src/lib/data.ts 里被调大（甚至 1 天）的 unstable_cache，
 * 既保证了「改完秒级生效」，又避免了重复请求的数据库压力。
 *
 * 注意：revalidateTag 只能在 Next 的请求渲染上下文里调用。集合 / 全局的 afterChange /
 * afterDelete 钩子都是在处理请求的线程里触发的，因此在这里调用是安全的。
 * 但 Payload Local API 在脚本里（seed.ts / 迁移）被调用时不存在这个上下文，
 * revalidateTag 会抛 Invariant: static generation store missing，所以先探测再跳过。
 */
export function revalidateOnChange(tags: string[]): void {
  // 非 Next 渲染上下文（脚本）直接跳过缓存失效，不影响数据写入。
  if (!workAsyncStorage.getStore()) return
  // 第二个参数 'max'：失效后采用 stale-while-revalidate，旧内容先立即返回、
  // 后台静默回源刷新。后台改完到前台看到新内容有极短延迟，对卡牌目录 / 公告这类
  // 内容完全可接受，同时避免了 updateTag 的「写后即读」阻塞。
  for (const tag of tags) {
    revalidateTag(tag, 'max')
  }
}

/** 生成一个集合用的 afterChange / afterDelete 钩子：变更后失效给定标签。 */
export function revalidateHook(...tags: string[]): CollectionAfterChangeHook & CollectionAfterDeleteHook {
  const hook: CollectionAfterChangeHook & CollectionAfterDeleteHook = () => {
    revalidateOnChange(tags)
  }
  return hook
}

/** 生成一个全局（Global）用的 afterChange 钩子：变更后失效给定标签。 */
export function revalidateGlobalHook(...tags: string[]): GlobalAfterChangeHook {
  return () => {
    revalidateOnChange(tags)
  }
}
