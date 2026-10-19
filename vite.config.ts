import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { publicEnvProblem } from './src/core/keyGuard.ts'

/** Política de contenido: la app solo puede cargar código propio y hablar con su propio Supabase. */
function contentSecurityPolicy(supabaseUrl: string | undefined, forHeaders: boolean): string {
  let supabaseOrigin = ''
  try {
    if (supabaseUrl) supabaseOrigin = new URL(supabaseUrl).origin
  } catch {
    /* URL inválida: queda solo 'self' y la app avisa que no hay sincronización */
  }
  const directives = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin}`.trim(),
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ]
  // frame-ancestors solo funciona como cabecera HTTP, no como <meta>.
  if (forHeaders) directives.push("frame-ancestors 'none'")
  return directives.join('; ')
}

function security(env: Record<string, string>): Plugin[] {
  return [
    {
      name: 'tareas:secret-guard',
      buildStart() {
        for (const [name, value] of Object.entries(env)) {
          const problem = publicEnvProblem(name, value)
          if (problem) this.error(`${name} ${problem} Se canceló el build para que no se publique.`)
        }
      },
    },
    {
      name: 'tareas:csp',
      apply: 'build',
      transformIndexHtml() {
        return [
          { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(env.VITE_SUPABASE_URL, false) }, injectTo: 'head-prepend' },
          { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
        ]
      },
      // Cloudflare Pages y Netlify leen este archivo y aplican las cabeceras reales.
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: '_headers',
          source: [
            '/*',
            '  X-Content-Type-Options: nosniff',
            '  X-Frame-Options: DENY',
            '  Referrer-Policy: no-referrer',
            '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
            '  Cross-Origin-Opener-Policy: same-origin',
            '  Strict-Transport-Security: max-age=63072000; includeSubDomains',
            `  Content-Security-Policy: ${contentSecurityPolicy(env.VITE_SUPABASE_URL, true)}`,
            '',
          ].join('\n'),
        })
      },
    },
  ]
}

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE ?? '/'
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    base,
    plugins: [
      react(),
      ...security(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'icon.svg'],
        manifest: {
          name: 'Tareas',
          short_name: 'Tareas',
          description: 'Mis tareas del día, en un cuaderno que siempre tengo a mano.',
          lang: 'es-AR',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#fbfcfe',
          theme_color: '#fbfcfe',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    test: {
      environment: 'node',
      setupFiles: ['src/test/setup.ts'],
    },
  }
})
