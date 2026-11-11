'use client'

import React, { useId } from 'react'

import type { TaxonomyOption } from './batch-state'

export type { TaxonomyOption }

export type TaxonomySelectProps = {
  label: string
  value: number | null
  options: TaxonomyOption[]
  onChange: (value: number | null) => void
  placeholder: string
  disabled?: boolean
  error?: string
}

export function TaxonomySelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  error,
}: TaxonomySelectProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <select
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={`h-9 w-full rounded-md border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
          error ? 'border-destructive' : 'border-input'
        }`}
        disabled={disabled}
        id={id}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw ? Number(raw) : null)
        }}
        value={value ?? ''}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {error ? (
        <span className="text-[11px] text-destructive" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

export default TaxonomySelect
