import { describe, expect, it } from 'vitest'
import { isPrivilegedKey, publicEnvProblem } from './keyGuard'

const jwt = (role: string) => {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, iss: 'supabase' })}.firma`
}

describe('keyGuard', () => {
  it('reconoce claves de administrador de Supabase', () => {
    expect(isPrivilegedKey(jwt('service_role'))).toBe(true)
    expect(isPrivilegedKey('sb_secret_abc123')).toBe(true)
  })

  it('acepta las claves públicas', () => {
    expect(isPrivilegedKey(jwt('anon'))).toBe(false)
    expect(isPrivilegedKey('sb_publishable_abc123')).toBe(false)
    expect(isPrivilegedKey('cualquier-cosa')).toBe(false)
  })

  it('bloquea la service_role puesta como anon key', () => {
    expect(publicEnvProblem('VITE_SUPABASE_ANON_KEY', jwt('service_role'))).toMatch(/administrador/)
    expect(publicEnvProblem('VITE_SUPABASE_ANON_KEY', jwt('anon'))).toBeNull()
  })

  it('bloquea variables públicas con pinta de secreto', () => {
    expect(publicEnvProblem('VITE_ANTHROPIC_API_KEY', 'sk-ant-xxx')).toMatch(/secreto/)
    expect(publicEnvProblem('VITE_OPENAI_KEY', 'x')).toMatch(/secreto/)
    expect(publicEnvProblem('VITE_SUPABASE_URL', 'https://x.supabase.co')).toBeNull()
  })
})
