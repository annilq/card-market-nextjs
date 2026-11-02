// 富文本渲染：Payload 存的是 Lexical 的结构化 JSON（不是任意 HTML 字符串），
// 这里在数据边界转成 HTML，页面组件只认字符串。
//
// 与 Directus 版本的差别值得记一笔：那边 body 是 Markdown/HTML 混合文本，
// 必须 markdown-it 解析 + DOMPurify 清洗；这边输入是结构化的，
// 输出的标签集合由转换器决定，没有「管理员粘贴一段 <script>」这条路径。
import { convertLexicalToHTML, defaultHTMLConverters } from '@payloadcms/richtext-lexical/html'

type LexicalState = { root?: unknown } | null | undefined

export function renderRichText(data: LexicalState): string {
  if (!data || !data.root) return ''
  try {
    return convertLexicalToHTML({
      converters: defaultHTMLConverters,
      data: data as never,
    })
  } catch {
    return ''
  }
}
