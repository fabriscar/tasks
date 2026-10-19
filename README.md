# Tareas

App personal para anotar y seguir tareas, pensada para reemplazar el cuaderno. Funciona en el iPhone y en Windows como app instalable (PWA), sin conexión, y sincroniza entre dispositivos.

Hoy incluye la **fase 1: tareas**. Los hábitos y el resto de los módulos se agregan después sobre la misma base (ver [Estructura](#estructura)).

## Qué hace

- **Captura rápida:** una barra siempre visible abajo. Se escribe como se habla y la app entiende fecha, hora, repetición, prioridad y etiquetas:

  | Escribís | Se guarda |
  |---|---|
  | `Pagar la luz mañana a las 18 !alta #casa` | mañana 18:00, prioridad alta, etiqueta casa |
  | `Dentista el jueves 10:30` | próximo jueves 10:30 |
  | `Regar plantas cada lunes y jueves` | repetición semanal lunes y jueves |
  | `Tomar vitaminas todos los días` | repetición diaria |
  | `Cumple de Ana 3 de noviembre` / `el 25/10` / `en 2 semanas` | fecha concreta |
  | `Comprar regalo` | sin fecha: va a la **Bandeja** |

  Más abreviaturas: `!1`, `!2`, `!3` o `!baja`, `!media`, `!alta` para la prioridad. Cada anotación muestra “Deshacer” unos segundos. En la compu, `n` o `/` llevan directo a la barra.
- **Hoy, Próximas, Bandeja, Hechas.** Lo atrasado se marca en rojo; la Bandeja tiene atajos “Hoy” y “Mañana” para ubicar lo que anotaste sin fecha.
- **Repetición:** al completar una tarea repetitiva se crea la siguiente.
- **Sincronización** entre dispositivos con Supabase (opcional, ver abajo). Funciona sin conexión y sube los cambios cuando vuelve internet.
- **Copia de seguridad** en JSON desde el panel de sincronización (ícono de nube).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # parser de frases, repetición, vistas y sincronización
npm run build      # genera dist/
```

## Activar la sincronización (Supabase, plan gratuito)

1. Crear una cuenta y un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegar y ejecutar el contenido de [`supabase/schema.sql`](supabase/schema.sql).
3. En **Authentication > Providers**, dejar habilitado Email. Si no querés confirmar el mail al crear la cuenta, desactivá “Confirm email”. Si lo dejás activo, en **Authentication > URL Configuration** poné como *Site URL* la dirección donde publiques la app.
4. En **Project Settings > API** copiar la *Project URL* y la clave *anon public*.
5. Para probar en local: copiar `.env.example` a `.env.local` y completar los dos valores.
6. Para la versión publicada: en GitHub, **Settings > Secrets and variables > Actions > Variables**, crear `SUPABASE_URL` y `SUPABASE_ANON_KEY` con esos valores.

La clave *anon* es pública por diseño. Lo que protege tus datos es la política de seguridad por fila de `schema.sql`: cada usuario solo lee y escribe sus propias tareas. No uses nunca la clave *service_role* en esta app.

Después, en la app: ícono de nube > **Crear cuenta** (una vez) y **Iniciar sesión** en cada dispositivo.

Cómo se resuelven los conflictos: si editás la misma tarea en dos dispositivos, gana la edición más reciente de esa tarea. Esto depende de que los relojes de los dispositivos estén en hora.

## Publicarla y usarla en el celular y la compu

El workflow [`deploy.yml`](.github/workflows/deploy.yml) publica en GitHub Pages cada vez que se actualiza `main`. Hay que activarlo una vez en **Settings > Pages > Source: GitHub Actions**. (En repositorios privados, GitHub Pages requiere un plan pago; en ese caso sirve igual cualquier hosting estático gratuito como Cloudflare Pages o Netlify con `npm run build` y la carpeta `dist`.)

- **iPhone:** abrir la dirección en **Safari** > Compartir > **Agregar a pantalla de inicio**. Abrirla desde ese ícono, no desde Safari: la app instalada guarda sus datos aparte de las pestañas del navegador, así que hay que iniciar sesión también ahí.
- **Windows:** abrir la dirección en Edge o Chrome > ícono de instalar en la barra de direcciones.

## Estructura

```text
src/
  core/               # base local (IndexedDB), sincronización, fechas, repetición
  modules/
    tasks/            # fase 1: parser, repositorio, vistas y componentes
supabase/schema.sql   # tabla y seguridad del servidor
```

Cada módulo nuevo (hábitos, salud, finanzas…) va en su propia carpeta de `modules/`, reutilizando `core/`. Para sincronizar una tabla nueva se agrega su esquema en `supabase/` y se reutiliza el mismo mecanismo de `core/sync.ts`.

## Pendiente a propósito

- **Recordatorios y notificaciones:** en iPhone solo funcionan para apps instaladas en la pantalla de inicio (iOS 16.4 o superior) y necesitan un pequeño servidor que las envíe. Es el siguiente paso natural.
- **Captura por voz o Siri:** hoy se puede dictar con el micrófono del teclado del iPhone. Un atajo de Siri que anote sin abrir la app requiere un endpoint propio.
- Hábitos, estadísticas y el resto de los módulos.
