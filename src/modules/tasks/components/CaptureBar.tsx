import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { relativeDate, todayISO } from '../../../core/dates'
import { repeatLabel } from '../../../core/recurrence'
import { MAX_INPUT, parseQuickTask, type ParsedTask } from '../parse'
import { SendIcon } from './icons'

interface CaptureBarProps {
  onAdd: (task: ParsedTask) => void
}

const PRIORITY_LABEL = ['', 'prioridad baja', 'prioridad media', 'prioridad alta']

export function CaptureBar({ onAdd }: CaptureBarProps) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => (text.trim() ? parseQuickTask(text) : null), [text])

  // En la compu, "n" o "/" llevan directo a escribir, desde cualquier lado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (target.closest('input, textarea, select, dialog')) return
      if (e.key === 'n' || e.key === '/') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    if (window.matchMedia('(pointer: fine)').matches) input.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!parsed) return
    onAdd(parsed)
    setText('')
    input.current?.focus()
  }

  const today = todayISO()
  const chips: string[] = []
  if (parsed) {
    if (parsed.dueDate) chips.push(relativeDate(parsed.dueDate, today))
    if (parsed.dueTime) chips.push(parsed.dueTime)
    if (parsed.repeat) chips.push(repeatLabel(parsed.repeat))
    if (parsed.priority) chips.push(PRIORITY_LABEL[parsed.priority])
    for (const tag of parsed.tags) chips.push(`#${tag}`)
  }

  return (
    <form className="capture" onSubmit={submit}>
      {chips.length > 0 && (
        <ul className="chips" aria-label="Lo que entendí">
          {chips.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <div className="capture-field">
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          type="text"
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck
          maxLength={MAX_INPUT}
          placeholder="Anotá una tarea…"
          aria-label="Nueva tarea"
        />
        <button
          type="submit"
          aria-label="Anotar tarea"
          disabled={!parsed}
          // Evita que el teclado se cierre al tocar el botón en el celular.
          onPointerDown={(e) => e.preventDefault()}
        >
          <SendIcon />
        </button>
      </div>
    </form>
  )
}
