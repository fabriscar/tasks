/**
 * Todo lo que empieza con VITE_ termina escrito en el JavaScript público de la app.
 * Estas funciones evitan que una clave con poderes de administrador (o la de cualquier otro
 * servicio) se publique por error.
 */

/** Variables VITE_ permitidas: ambas son públicas por diseño. */
export const PUBLIC_ENV_ALLOWED = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])

/** Nombres que indican un secreto: si aparecen en una variable VITE_, el build falla. */
export const SECRET_ENV_NAME = /(SERVICE|SECRET|PRIVATE|ANTHROPIC|CLAUDE|OPENAI|TOKEN|PASSWORD|API_?KEY)/i

/** Detecta claves de Supabase con permisos de administrador (service_role o sb_secret_…). */
export function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const parts = key.split('.')
  if (parts.length !== 3) return false
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))) as { role?: string }
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

/** Devuelve el motivo por el que una variable VITE_ no debe publicarse, o null si está bien. */
export function publicEnvProblem(name: string, value: string): string | null {
  if (name === 'VITE_SUPABASE_ANON_KEY' && isPrivilegedKey(value)) {
    return 'es una clave de administrador (service_role / secret). Usá la clave "anon" o "publishable".'
  }
  if (!PUBLIC_ENV_ALLOWED.has(name) && SECRET_ENV_NAME.test(name)) {
    return 'parece un secreto y quedaría visible para cualquiera que abra la app. Los secretos no pueden vivir en el frontend.'
  }
  return null
}
