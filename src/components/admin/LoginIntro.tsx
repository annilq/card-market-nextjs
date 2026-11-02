/**
 * 登录页标题区（渲染在 Payload 登录表单上方）。
 *
 * 这里只回答一个问题：「这是哪个站的后台」。牌子由 graphics.Logo 渲染，
 * 这里给中文站名。孟菲斯的几何原件与三色细线已按需求移除——后台是长时间
 * 盯表单与列表的场合，装饰色会和内容抢注意力，也会和状态色混淆。
 *
 * 纯展示、无交互，键盘与读屏行为仍由 Payload 自己的表单决定。
 */
export function LoginIntro() {
  return (
    <div className="admin-login">
      <h1 className="admin-login__title">卡牌回购站 · 内容后台</h1>
    </div>
  )
}
