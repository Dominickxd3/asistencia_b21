# Despliegue en producción

Guía para instalar el sistema en un servidor Windows de la compañía. Un solo
proceso Node.js sirve la API, el WebSocket y la web; delante va un proxy HTTPS.

```
Navegador ──HTTPS──▶ Proxy (IIS / Caddy) ──HTTP──▶ Node :3000 ──▶ SQL Server
                     certificado TLS              API + web + WebSocket
```

HTTPS no es opcional: sin él los celulares no permiten usar el GPS ni la cámara
(escáner QR), y la cookie de sesión (`COOKIE_SECURE=true`) no se envía.

## 1. Requisitos del servidor

- Windows Server o Windows 10/11 con SQL Server (Express sirve).
- Node.js 24 LTS.
- Driver ODBC 17 u 18 para SQL Server (lo usa `msnodesqlv8`).
- Un dominio o subdominio que apunte al servidor (p. ej. `asistencia.ejemplo.pe`).

## 2. Base de datos

1. Crear la BD con `database/scripts/rimac21_base_datos_completa.sql`.
2. Aplicar, en este orden, los scripts `database/scripts/20260927_*.sql`
   (usar `sqlcmd -I` para que `QUOTED_IDENTIFIER` quede activo):
   geocerca_poligonal, credenciales_qr, personas_dni_opcional,
   regla_asistencia_por_jornada, esbas_disponible_todo_el_dia,
   salida_dinamica_corte_diario, jornada_automatica_y_reglas_citacion,
   programacion_obligatoria_dinamica, promover_solo_jefe_y_quitar_integrante.
3. La cuenta de Windows con la que correrá el servicio necesita acceso a la BD
   (lectura y escritura; `db_datareader` + `db_datawriter` + `EXECUTE`).
4. Programar una copia de seguridad diaria de la BD.

## 3. Compilar

```powershell
cd frontend
npm ci
npm run build            # genera frontend\dist

cd ..\backend
npm ci
npm run build            # genera backend\dist
```

## 4. Configurar

```powershell
cd backend
copy .env.production.example .env
```

Completar `.env`:

| Variable | Valor |
|---|---|
| `DB_HOST`, `DB_NAME` | Servidor e instancia de SQL Server |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Dos valores **nuevos** y distintos (comando en el archivo) |
| `CORS_ORIGIN` | `https://` + el dominio público |
| `TRUST_PROXY` | `loopback` si el proxy está en el mismo equipo |
| `COOKIE_SECURE` | `true` |

Si algo es inseguro (secretos cortos o iguales, `COOKIE_SECURE=false`), el
backend **no arranca** y dice qué corregir.

## 5. Cuenta inicial

```powershell
$env:NODE_ENV="production"; npm run seed
```

En producción solo crea los permisos y la cuenta `admin`, sin datos de
demostración. La contraseña se imprime **una sola vez**: anotarla y cambiarla al
entrar (menú del perfil → *Cambiar mi contraseña*). Luego, desde *Usuarios y
permisos*, crear las cuentas del personal.

## 6. Ejecutar como servicio de Windows

Con [NSSM](https://nssm.cc) (o el Programador de tareas):

```powershell
nssm install Rimac21 "C:\Program Files\nodejs\node.exe" "dist\main.js"
nssm set Rimac21 AppDirectory C:\rimac21\backend
nssm set Rimac21 ObjectName ".\CuentaServicio" "contraseña"   # cuenta con acceso a SQL Server
nssm set Rimac21 AppStdout C:\rimac21\logs\salida.log
nssm set Rimac21 AppStderr C:\rimac21\logs\errores.log
nssm start Rimac21
```

Comprobar: `http://localhost:3000/api/health` responde `{"status":"ok"}`.

## 7. Proxy HTTPS

**Opción simple — Caddy** (obtiene y renueva el certificado solo). `Caddyfile`:

```
asistencia.ejemplo.pe {
    reverse_proxy localhost:3000
}
```

**Opción IIS**: instalar *URL Rewrite* y *Application Request Routing*, activar
el proxy en ARR, activar **WebSocket Protocol** (característica de Windows),
crear un sitio HTTPS con el certificado y una regla de reescritura
`(.*)` → `http://localhost:3000/{R:1}`.

En ambos casos solo deben quedar abiertos al exterior los puertos 80 y 443;
el 3000 y SQL Server, cerrados en el firewall.

## 8. Jornadas automáticas

Con `JORNADAS_AUTOMATICAS=true` las jornadas se crean, abren y cierran solas a
medianoche, y se generan las faltas de las fechas obligatorias. **Antes de
activarlo**, fijar en *Formación → Grupos* la fecha de inicio real de cada
grupo: se generan faltas desde esa fecha.

## 9. Actualizar a una versión nueva

```powershell
nssm stop Rimac21
git pull
cd frontend; npm ci; npm run build
cd ..\backend; npm ci; npm run build
# aplicar los scripts SQL nuevos de database/scripts, si los hay
nssm start Rimac21
```

Las pestañas abiertas con la versión anterior se recargan solas al navegar.

## Comportamiento de la sesión

- Tras **5 minutos sin uso** se avisa y la sesión se cierra
  (`SESSION_IDLE_MINUTES`). Con la cámara QR abierta no cuenta como inactividad.
- Si se cierra la pestaña, la sesión muere sola en el servidor en ~6 minutos.
- Cerrar sesión en una pestaña la cierra en todas.
