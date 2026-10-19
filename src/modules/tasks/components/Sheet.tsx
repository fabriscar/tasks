import { useEffect, useRef, type ReactNode } from 'react'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Panel que sube desde abajo. Usa <dialog> para tener foco, Escape y fondo bloqueado gratis. */
export function Sheet({ title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="sheet-dialog"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="sheet-body">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="link" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
