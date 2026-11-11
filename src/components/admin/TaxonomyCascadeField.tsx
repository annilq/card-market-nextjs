'use client'

/**
 * 卡牌编辑页的「IP / 大类 → 系列 → 子系列」三级关联选择增强。
 *
 * Payload 原生的 relationship 字段只做两件事：按 `filterOptions` 缩窄下拉候选、
 * 把选中值写回表单。它不会在父级变化时清掉已选的子级，父级为空时下拉直接是
 * 一片空白，运营既看不出原因也没法得到提示。这里复用原生 `RelationshipField`
 * 的 UI（标签、必填星号、错误、react-select 全部保留），在外面补三层行为：
 *
 *   1. 本字段值发生「用户级」变化时，清空 `clearPaths` 里的下级字段并 toast；
 *   2. 前置字段（prerequisites）没选时，字段可点击但被一层透明按钮接管，
 *      点击弹出「请先选择 X」的 toast，同时常驻一条说明；
 *   3. 常态下显示一行说明，告诉运营当前下拉是按哪个上级筛出来的。
 *
 * 所有路径都用表单里的字段路径（不是数据库列名），配置通过 `clientProps.cascade`
 * 从集合定义传入，三个字段共用一个组件。
 */

import React, { useEffect, useRef } from 'react'

import {
  RelationshipField,
  toast,
  useForm,
  useFormFields,
  useFormInitializing,
  useTranslation,
} from '@payloadcms/ui'
import type { RelationshipFieldClientProps, StaticLabel } from 'payload'

type Localized = string | { en: string; ja: string; zh: string }

export type CascadePrerequisite = {
  /** 上级字段路径，如 'ip' / 'series'。 */
  path: string
  /** 提示里显示的字段名，可直接给三语对象。 */
  label: Localized
}

export type CascadeConfig = {
  /** 从大到小排列。第一个未选中的上级决定锁定提示。IP 字段留空。 */
  prerequisites?: CascadePrerequisite[]
  /** 本字段值变化时自动清空的下级字段路径。 */
  clearPaths?: string[]
}

export type CascadingRelationshipFieldProps = RelationshipFieldClientProps & {
  cascade?: CascadeConfig
}

const EMPTY_PREREQUISITES: CascadePrerequisite[] = []
const EMPTY_PATHS: string[] = []

/** 表单里 relationship 的值可能是裸 ID、带 id 的对象，或 polymorphic 的 {value}。 */
const toId = (value: unknown): string | null => {
  if (value == null || value === '' || value === false) return null
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if ('id' in record) return toId(record.id)
    if ('value' in record) return toId(record.value)
    return null
  }
  return String(value)
}

/** 后台语言是 zh / en / ja；字段标签本身就是三语对象，提示沿用同一套。 */
const labelText = (label: StaticLabel | Localized | undefined, lang: string): string => {
  if (!label) return ''
  if (typeof label === 'string') return label
  const record = label as Record<string, string>
  return record[lang] ?? record.zh ?? record.en ?? Object.values(record)[0] ?? ''
}

export function CascadingRelationshipField(props: CascadingRelationshipFieldProps) {
  const { cascade, ...fieldProps } = props
  const { i18n } = useTranslation()
  const lang = i18n.language

  const formState = useFormFields(([fields]) => fields)
  const dispatchFields = useFormFields(([, dispatch]) => dispatch)
  const { setModified } = useForm()
  const initializing = useFormInitializing()

  const config = cascade ?? {}
  const prerequisites = config.prerequisites ?? EMPTY_PREREQUISITES
  const clearPaths = config.clearPaths ?? EMPTY_PATHS
  const path = props.path || props.field.name
  const fieldLabel = labelText(props.field.label, lang)

  // 只在「表单初始化完成之后」的值变化才当作用户操作：
  //   - 编辑已有卡牌时 ip 会从 undefined 变成已存的值，那一次不能清掉合法的子级；
  //   - initializing 由 Edit 视图的 isInitializing 驱动，加载文档时为 true，
  //     加载完成翻 false 时重新记录基线。
  // 这三个分类字段都没有 localized，切换后台语言时它们的值不变（不会误判成
  // 用户改动）；复制 / 另存会换路由重新挂载组件，基线自然重置。
  const settled = useRef(false)
  const previousValue = useRef<string | null>(null)
  const currentValue = toId(formState[path]?.value)

  const missing = prerequisites.find((item) => toId(formState[item.path]?.value) === null)
  const missingLabel = missing ? labelText(missing.label, lang) : ''
  const selfHasValue = toId(formState[path]?.value) !== null
  // 子级已有值、父级却缺失（历史脏数据）时不加覆盖层：仍要允许运营把它清掉，
  // 但常驻提示照常显示，避免看起来像「已经选好了」。
  const needsPrerequisite = Boolean(missing) && !props.readOnly
  const locked = needsPrerequisite && !selfHasValue

  const lastParentLabel = prerequisites.length
    ? labelText(prerequisites[prerequisites.length - 1].label, lang)
    : ''
  const hint = prerequisites.length
    ? `仅显示所选「${lastParentLabel}」下的${fieldLabel}`
    : `切换「${fieldLabel}」会自动清空已选的下级分类`
  const reminder = `请先选择「${missingLabel}」，再选择「${fieldLabel}」`
  const clearedMessage = `已切换「${fieldLabel}」，下级分类已清空，请重新选择`

  useEffect(() => {
    if (initializing) {
      settled.current = false
      return
    }
    if (!settled.current) {
      settled.current = true
      previousValue.current = currentValue
      return
    }
    if (previousValue.current === currentValue || clearPaths.length === 0) return
    previousValue.current = currentValue

    // 下级本来就是空的时候不打扰：新建卡牌第一次选 IP 不该弹 toast。
    const stalePaths = clearPaths.filter((p) => toId(formState[p]?.value) !== null)
    if (stalePaths.length === 0) return

    // 与 useField.setValue 保持一致：只改 value，不擅自把 required 字段判为 valid
    // （必填校验本来就在提交时由服务端做）。只派发真正需要清的字段，减少副作用。
    for (const childPath of stalePaths) {
      dispatchFields({ type: 'UPDATE', path: childPath, value: null })
    }
    setModified(true)
    // 固定 id：IP 与系列同一次改动可能各自触发一次清空，sonner 会覆盖同一条
    // toast 而不是叠两条。
    toast.info(clearedMessage, { id: 'taxonomy-cascade-clear' })
  }, [clearedMessage, clearPaths, currentValue, dispatchFields, formState, initializing, setModified])

  // 宽度原本挂在字段自己的根节点上（--field-width: 33%）。多包一层后它就成了
  // flex item，必须把宽度透传到外层，并让里层恢复成 100% 填充，否则三列会散掉。
  const width = props.field.admin?.width
  const wrapperStyle = { '--field-width': width ?? '100%' } as React.CSSProperties
  const innerField = {
    ...props.field,
    admin: {
      ...props.field.admin,
      width: undefined,
      style: { ...props.field.admin?.style, flex: undefined },
    },
  } as RelationshipFieldClientProps['field']

  return (
    <div
      className={`cascade-field${locked ? ' cascade-field--locked' : ''}`}
      style={wrapperStyle}
    >
      <div className="cascade-field__control" inert={locked || undefined}>
        <RelationshipField {...fieldProps} field={innerField} />
      </div>

      {locked ? (
        // 透明按钮接管整个字段：鼠标、键盘（Enter / Space）都能触发提醒。
        <button
          aria-label={reminder}
          className="cascade-field__overlay"
          onClick={() => toast.warning(reminder, { id: 'taxonomy-cascade-reminder' })}
          title={reminder}
          type="button"
        />
      ) : null}

      {needsPrerequisite ? (
        <p className="cascade-field__notice" role="status">
          <span aria-hidden="true">⚠</span>
          {reminder}
        </p>
      ) : (
        <p className="cascade-field__hint">{hint}</p>
      )}
    </div>
  )
}

export default CascadingRelationshipField
