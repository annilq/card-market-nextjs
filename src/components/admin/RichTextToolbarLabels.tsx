'use client'

/**
 * 给富文本工具条的按钮补上名字。
 *
 * Payload 3.92 的工具条按钮只有图标（`data-button-key="bold"` 之类），
 * **既没有 aria-label 也没有 title**——鼠标悬停没有提示，读屏念出来是「按钮」。
 * 工具条是这次才打开的，所以这个缺口也一并补上：按 `data-button-key`
 * 从下面这张小表里取名字，同时写进 `aria-label` 与 `title`。
 *
 * Payload 自带的 lexical 词典里没有这些按钮的文案（只有占位符和斜杠菜单的
 * 组名），所以这里自带一份三语表，跟随当前界面语言。
 *
 * 工具条是「聚焦编辑器才挂载」的，所以用 MutationObserver 跟着；
 * 编辑时 DOM 变动很密，加了个节流。
 */

import { useTranslation } from '@payloadcms/ui'
import { useEffect } from 'react'

const LABELS: Record<string, Record<string, string>> = {
  en: {
    'add dropdown': 'Insert',
    'align dropdown': 'Alignment',
    bold: 'Bold',
    indentDecrease: 'Decrease indent',
    indentIncrease: 'Increase indent',
    inlineCode: 'Inline code',
    italic: 'Italic',
    link: 'Link',
    strikethrough: 'Strikethrough',
    subscript: 'Subscript',
    superscript: 'Superscript',
    'text dropdown': 'Paragraph and headings',
    underline: 'Underline',
  },
  ja: {
    'add dropdown': '挿入',
    'align dropdown': '配置',
    bold: '太字',
    indentDecrease: 'インデントを減らす',
    indentIncrease: 'インデントを増やす',
    inlineCode: 'インラインコード',
    italic: '斜体',
    link: 'リンク',
    strikethrough: '打ち消し線',
    subscript: '下付き文字',
    superscript: '上付き文字',
    'text dropdown': '段落と見出し',
    underline: '下線',
  },
  zh: {
    'add dropdown': '插入',
    'align dropdown': '对齐',
    bold: '加粗',
    indentDecrease: '减少缩进',
    indentIncrease: '增加缩进',
    inlineCode: '行内代码',
    italic: '斜体',
    link: '链接',
    strikethrough: '删除线',
    subscript: '下标',
    superscript: '上标',
    'text dropdown': '段落与标题',
    underline: '下划线',
  },
}

const SELECTOR =
  '.fixed-toolbar [data-button-key], .inline-toolbar-popup [data-button-key], .fixed-toolbar button[aria-label$="dropdown"]'

export function RichTextToolbarLabels() {
  const { i18n } = useTranslation()

  useEffect(() => {
    const dict = LABELS[i18n?.language ?? 'zh'] ?? LABELS.zh

    const apply = () => {
      const nodes = document.querySelectorAll(SELECTOR)
      for (const el of Array.from(nodes)) {
        const key =
          el.getAttribute('data-button-key') ?? el.getAttribute('aria-label') ?? ''
        const label = dict[key]
        if (!label) continue
        if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', label)
        if (!el.getAttribute('title')) el.setAttribute('title', label)
      }
    }

    apply()

    let timer: number | undefined
    const schedule = () => {
      if (timer) return
      timer = window.setTimeout(() => {
        timer = undefined
        apply()
      }, 200)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (timer) window.clearTimeout(timer)
    }
  }, [i18n?.language])

  return null
}
