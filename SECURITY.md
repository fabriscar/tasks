# Seguridad

## Qué hay (y qué no hay) en esta app

- **No hay ninguna clave de Claude, Anthropic ni de ningún servicio de IA.** La app no usa IA. Si algún día se agrega una función con IA, la clave **nunca** puede ir en el frontend: todo lo que empieza con `VITE_` queda escrito en el JavaScript público. Tendría que vivir como secreto en un servidor (por ejemplo una Edge Function de Supabase), detrás del login y con límite de uso.
- El único dato de conexión que llega al navegador es la **URL** de tu proyecto de Supabase y su clave **anon/publishable**. Es pública por diseño: la protección real de los datos es la seguridad por fila (RLS) de `supabase/schema.sql`, que impide que una cuenta lea o toque tareas de otra.
- La clave **service_role / secret** da acceso total a la base. No va en la app, ni en el repositorio, ni en variables de GitHub de esta app, ni en el chat con ningún asistente.

## Defensas incluidas en el código

| Riesgo | Defensa |
|---|---|
| Pegar por error una clave de administrador | El build falla si `VITE_SUPABASE_ANON_KEY` es `service_role` o `sb_secret_…`, y la app se niega a usarla en ejecución |
| Publicar un secreto en una variable `VITE_*` | El build falla si el nombre sugiere un secreto (`SECRET`, `TOKEN`, `ANTHROPIC`, `OPENAI`, `API_KEY`…) |
| Código inyectado (XSS) | Política de contenido (CSP) estricta: solo código propio y solo conexión a tu Supabase. React escapa todo el texto. No se usa `innerHTML`, `eval` ni similares |
| Robo de datos entre cuentas | RLS en la tabla; el rol `anon` no tiene permisos; pruebas automáticas en `supabase/schema.test.ts` |
| Mezcla de datos si otra persona inicia sesión en el mismo equipo | Al cambiar de cuenta se descartan los datos locales de la anterior |
| Equipo compartido o perdido | “Cerrar sesión y borrar datos de este dispositivo” y “Cerrar sesión en todos mis dispositivos” (panel de la nube > Seguridad de la cuenta) |
| Saturar la base o colgar la app con textos enormes | Topes de tamaño en la app y en la base de datos |
| Sesión robada desde un enlace | No se inicia sesión a partir de tokens en la URL |
| Dependencias vulnerables o comprometidas | `npm audit` en CI, instalación sin scripts, Dependabot semanal |
| Permisos de GitHub Actions | Solo lectura por defecto; escritura de Pages solo en el job de publicar |

## Lo que tenés que configurar vos (no se puede hacer desde el código)

**En Supabase** (Authentication y Project Settings):

1. Crear tu cuenta desde la app y **después desactivar el registro**: Authentication > Sign In / Providers > desactivar “Allow new users to sign up”. Es una app personal: sin esto cualquiera que encuentre la dirección puede crear cuentas en tu proyecto y gastar tu cuota.
2. Dejar activada la confirmación de email, o desactivar el registro como en el punto 1.
3. Authentication > Policies: largo mínimo de contraseña de **10 o más** y requerir letras y números.
4. Authentication > URL Configuration: *Site URL* con la dirección de la app y en *Redirect URLs* solo esa dirección.
5. Revisar que las claves de **Project Settings > API** usadas en la app sean la `anon`/`publishable`. Si alguna vez una clave secreta se pegó en un chat, un archivo o un repositorio, regenerala desde ahí.
6. Opcional: activar CAPTCHA y, en planes que lo tengan, la protección contra contraseñas filtradas.

**En GitHub** (Settings del repositorio):

1. Security > **Secret scanning** y **Push protection**: activarlos. Bloquean el push si alguien incluye una clave.
2. Branches: proteger `main` (exigir pull request y que pasen las revisiones).
3. Pages: usar “GitHub Actions” como fuente y, si el repositorio es privado, tener en cuenta que el sitio publicado igual es público.
4. Cuenta: activar verificación en dos pasos.

**En el iPhone y la compu:** usar código de bloqueo. Las tareas se guardan en el dispositivo sin cifrar por la app; la protección es la del propio equipo.

## Si se filtra una clave

1. Regenerarla de inmediato en el panel del proveedor (Supabase > Project Settings > API; Anthropic > Console > API keys).
2. Actualizar la variable en GitHub (Settings > Secrets and variables) y volver a publicar.
3. Si fue la `service_role`, además cerrar todas las sesiones y revisar la tabla `tasks`.
