// The small controls every inspector section is made of.
import * as React from "react"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"

export function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-border/60 px-3 py-3 last:border-0", className)}>
      <div className="mb-2 flex h-5 items-center justify-between">
        <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

/** A slider with its number beside it. Drag the slider, or type the exact value. */
export function Dial({ label, value, min = 0, max = 1, step = 0.01, onChange, unit, digits }: {
  label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; unit?: string; digits?: number
}) {
  const d = digits ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : 2)
  const [text, setText] = React.useState<string | null>(null)
  const commit = () => { if (text !== null) { const v = parseFloat(text); if (isFinite(v)) onChange(Math.min(max, Math.max(min, v))); setText(null) } }
  return (
    <label className="grid grid-cols-[84px_1fr_52px] items-center gap-2 text-[12.5px]">
      <span className="truncate text-foreground/80">{label}</span>
      <Slider value={[Math.min(max, Math.max(min, value))]} min={min} max={max} step={step} onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))} aria-label={label} />
      <input
        className="h-6 w-full rounded-sm bg-muted/60 px-1.5 text-right font-mono text-[11px] text-foreground/90 tabular-nums outline-none focus:ring-1 focus:ring-ring"
        value={text ?? `${value.toFixed(d)}${unit ?? ""}`} inputMode="decimal" aria-label={`${label} value`}
        onFocus={(e) => { setText(value.toFixed(d)); requestAnimationFrame(() => e.target.select()) }}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setText(null); (e.target as HTMLInputElement).blur() } }}
      />
    </label>
  )
}

export function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[12.5px]">
      <span className="text-foreground/80">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted-foreground uppercase">{value}</span>
        <span className="color-well relative size-6 overflow-hidden rounded-full ring-1 ring-border" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute -inset-2 size-12 cursor-pointer opacity-0" aria-label={label} />
        </span>
      </span>
    </label>
  )
}
export function Colors({ items }: { items: { label: string; value: string; onChange: (v: string) => void }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2">
      {items.map((c) => (
        <label key={c.label} className="flex items-center gap-1.5 text-[12px] text-foreground/80">
          <span className="color-well relative size-6 overflow-hidden rounded-full ring-1 ring-border" style={{ background: c.value }}>
            <input type="color" value={c.value} onChange={(e) => c.onChange(e.target.value)} className="absolute -inset-2 size-12 cursor-pointer opacity-0" aria-label={c.label} />
          </span>
          {c.label}
        </label>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (T | { value: T; label: string })[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-muted/60 p-0.5">
      {options.map((o) => { const v = typeof o === "string" ? o : o.value, l = typeof o === "string" ? o : o.label
        return (
          <button key={v} role="radio" aria-checked={v === value} onClick={() => onChange(v)}
            className={cn("h-6 flex-1 rounded-[5px] px-2 text-[12px] capitalize text-muted-foreground transition-colors", v === value && "glass-control bg-(--glass-control) text-foreground")}>
            {l}
          </button>
        ) })}
    </div>
  )
}

/** A grid of looks to pick from: each is a little painted tile with its name under it. */
export function Looks<T extends { name: string }>({ items, paint, active, onPick, round }: { items: readonly T[]; paint: (t: T) => string; active?: string; onPick: (t: T, i: number) => void; round?: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {items.map((it, i) => (
        <button key={it.name} title={it.name} onClick={() => onPick(it, i)} aria-label={it.name} aria-pressed={active === it.name}
          className={cn("group relative aspect-square overflow-hidden ring-1 ring-border transition-transform hover:scale-[1.06] active:scale-95", round ? "rounded-full" : "rounded-md", active === it.name && "ring-2 ring-foreground")}
          style={{ background: paint(it) }} />
      ))}
    </div>
  )
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex min-h-6 items-center justify-between gap-2 text-[12.5px]"><span className="text-foreground/80">{label}</span>{children}</div>
}
