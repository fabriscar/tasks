# Tareas

App personal para anotar y seguir tareas, pensada para reemplazar el cuaderno. Funciona en el iPhone y en Windows como app instalable (PWA), sin conexión, y sincroniza entre dispositivos.

Hoy incluye **tareas** y **hábitos**. El resto de los módulos (salud, finanzas, metas…) se agregan después sobre la misma base (ver [Estructura](#estructura)).

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
- **Hábitos** (pestaña *Hábitos*), como la tabla del cuaderno:
  - Una tabla por mes: los días en filas, tus hábitos en columnas y una **X** por cada día cumplido. Un toque marca o desmarca; también se pueden completar días pasados. Los días futuros no se pueden marcar.
  - **Gráfico en zigzag** al lado: cada renglón es un día y la línea muestra cuántos hábitos cumpliste ese día (0 a la cantidad de hábitos).
  - **Totales** por hábito al pie (`27/31`) y el promedio de hábitos por día.
  - **Hecho relevante** de cada día, con la lista del mes como en la hoja de “Hechos relevantes”. Se carga tocando el número del día o desde *Hoy*.
  - En *Hoy* aparece el bloque **Hábitos de hoy** para marcar todo sin entrar a la tabla.
  - **Mis hábitos:** agregar, renombrar, reordenar y quitar. *Quitar* hace que el hábito deje de aparecer desde el mes que viene y conserva el historial (se puede volver a usar). *Borrar* elimina el hábito con todos sus días. La primera vez podés cargar los de tu cuaderno (Leer, Gimnasio, Dejar vicios, Estudiar, Dormir 8 horas, Celular <3hs, Escribir).
  - Navegación entre meses para revisar los anteriores.
- **Seguridad de la cuenta:** cambiar contraseña, cerrar sesión y borrar los datos de un dispositivo, o cerrar sesión en todos los dispositivos si perdés uno.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # parser, repetición, vistas, sincronización y seguridad de la base (RLS)
npm run typecheck
npm run build      # genera dist/
```

## Activar la sincronización (Supabase, plan gratuito)

1. Crear una cuenta y un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegar y ejecutar el contenido de [`supabase/schema.sql`](supabase/schema.sql). Si ya lo habías ejecutado antes, volvé a ejecutarlo completo: se puede repetir sin problema y agrega las tablas de hábitos sin tocar tus tareas. Mientras falte, la app avisa “Falta actualizar la base de datos” y las tareas siguen sincronizando.
3. En **Authentication > Providers**, dejar habilitado Email. Si lo dejás con confirmación por mail, en **Authentication > URL Configuration** poné como *Site URL* la dirección donde publiques la app.
4. En **Project Settings > API** copiar la *Project URL* y la clave *anon public*.
5. Para probar en local: copiar `.env.example` a `.env.local` y completar los dos valores.
6. Para la versión publicada: en GitHub, **Settings > Secrets and variables > Actions > Variables**, crear `SUPABASE_URL` y `SUPABASE_ANON_KEY` con esos valores.

La clave *anon* es pública por diseño. Lo que protege tus datos es la política de seguridad por fila de `schema.sql`: cada usuario solo lee y escribe sus propias tareas. No uses nunca la clave *service_role* ni *secret* en esta app: si la ponés por error, el build falla a propósito y la app se niega a usarla. La app no usa ninguna clave de IA; el detalle de qué está protegido y qué tenés que configurar vos está en [SECURITY.md](SECURITY.md).

Después, en la app: ícono de nube > **Crear cuenta** (una vez, con contraseña de al menos 10 caracteres) y **Iniciar sesión** en cada dispositivo. **Cuando tengas tu cuenta, desactivá el registro de usuarios nuevos** en Supabase (ver [SECURITY.md](SECURITY.md)): es una app personal y no debería poder crear cuentas cualquiera.

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
    tasks/            # tareas: parser, repositorio, vistas y componentes
    habits/           # hábitos: tabla del mes, gráfico, hechos relevantes
supabase/schema.sql   # tabla y seguridad del servidor
```

Cada módulo nuevo (hábitos, salud, finanzas…) va en su propia carpeta de `modules/`, reutilizando `core/`. Para sincronizar una tabla nueva se agrega su esquema en `supabase/` y se reutiliza el mismo mecanismo de `core/sync.ts`.

## Pendiente a propósito

- **Recordatorios y notificaciones:** en iPhone solo funcionan para apps instaladas en la pantalla de inicio (iOS 16.4 o superior) y necesitan un pequeño servidor que las envíe. Es el siguiente paso natural.
- **Captura por voz o Siri:** hoy se puede dictar con el micrófono del teclado del iPhone. Un atajo de Siri que anote sin abrir la app requiere un endpoint propio.
- Estadísticas de hábitos más allá del mes (rachas, comparación entre meses) y pasar a la app los meses ya escritos en el cuaderno.
- El resto de los módulos de vida en general.
