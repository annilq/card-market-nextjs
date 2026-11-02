// 冒烟：直接调用留言 Server Action（与浏览器提交同一条代码路径）
import { submitMessage } from '../src/lib/actions'

const ok = await submitMessage({ content: '冒烟测试留言（可删）', contactName: 'smoke' })
console.log('正常提交 →', ok)
const bad = await submitMessage({ content: '   ' })
console.log('空内容 →', bad)
process.exit(0)
