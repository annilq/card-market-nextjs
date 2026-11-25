import { createAdminT } from '@/lib/admin/i18n'

import { AdminLanguageSwitcher } from './AdminLanguageSwitcher'

/**
 * 登录页标题区（渲染在 Payload 登录表单上方）。
 *
 * 这里只回答一个问题：「这是哪个站的后台」。牌子由 graphics.Logo 渲染，
 * 站名按当前界面语言取。后台是长时间盯表单与列表的场合，装饰色会和内容
 * 抢注意力，也会和状态色混淆，所以只留文字。
 *
 * 右侧的语言切换是本区唯一的交互。未登录的人先选界面语言再登录，
 * 否则只能等登录后去顶栏改。
 */
export function LoginIntro({ i18n }: { i18n: { language: string } }) {
  const t = createAdminT(i18n.language)
  return (
    <div className="admin-login">
      <h1 className="admin-login__title">{t('login.title')}</h1>
      <AdminLanguageSwitcher />
    </div>
  )
}
