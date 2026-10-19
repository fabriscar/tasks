type Listener = () => void
const listeners = new Set<Listener>()

/** Avisa que hubo un cambio local (para disparar la sincronización). */
export const emitLocalChange = () => listeners.forEach((l) => l())

export function onLocalChange(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
