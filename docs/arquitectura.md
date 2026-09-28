# Rímac 21 — Sistema del Área de Instrucción

## Arquitectura

Monolito modular:

```
React + Vite (frontend/)  →  REST + WebSocket  →  NestJS (backend/)  →  TypeORM  →  SQL Server
```

Base de datos: **Rimac21Instruccion** (SQL Server, esquema administrado por scripts en `/database/scripts`).
TypeORM opera en modo estructura de solo lectura: `synchronize: false`, sin migraciones automáticas.

## Decisiones técnicas relevantes

### 1. Conexión a SQL Server — Windows Authentication

- Servidor local `localhost,1433` (SQLEXPRESS, TCP/IP habilitado).
- El backend corre bajo una cuenta Windows con acceso a la BD (driver `msnodesqlv8` con `trustedConnection`).
- No hay credenciales SQL en el repo.

### 2. Regla de timestamps (IMPORTANTE)

El driver `msnodesqlv8` con `useUTC: false` **desfasa los objetos `Date` de JavaScript al escribir**
(guarda el reloj UTC como si fuera local). Por eso:

- **Nunca** pasar `new Date()` como parámetro a una columna `datetime2`.
- Los timestamps los pone SQL Server: `GETDATE()` en los `INSERT`/`UPDATE`.
- Las fechas/horas de negocio (p. ej. hora programada de una jornada) se envían como **cadena ISO** `'YYYY-MM-DDTHH:mm:ss'` — el driver las almacena sin desfase.
- Las lecturas con `useUTC: false` interpretan el reloj de la BD como hora local: consistente con `GETDATE()`.

### 3. TypeORM con msnodesqlv8

- Array directo en `find({ where: { col: [a,b,c] } })` **no** genera `IN` — usar siempre el operador `In([...])`.
- Las columnas `bigint` llegan como string a la API → los DTOs usan `@Type(() => Number)`.

### 4. Auth

- Access token JWT de 15 min: solo identifica (`sub`, `username`).
- Refresh token en cookie `HttpOnly`, `SameSite=Lax`, con **rotación** y hash Argon2 en `sesiones`.
- Contraseñas: Argon2id.
- Autorización: `JwtAuthGuard` (identidad + cuenta activa) + `PermissionsGuard` (permisos ACTUALES en BD, cache 30s invalidable). El JWT nunca transporta permisos.
- Encargado de grupo: autorización adicional validando asignación ACTIVA en `grupo_encargados` (ver `GroupsService.validarEncargadoActivo`).

### 5. Realtime

- Gateway Socket.IO en namespace `/realtime`, autenticado con el access token.
- Los eventos (`asistencia.registrada`, `jornada.abierta/cerrada`, `dashboard.actualizar`) se emiten **después** de confirmar la escritura en SQL Server.

## Estructura backend

```
backend/src/
├── config/            configuracion tipada (.env)
├── database/          data-source, seeds, verify-schema.ts
├── common/            enums (valores = CHECK constraints de la BD) y constantes
└── modules/
    ├── auth/          login, refresh (rotación), logout, guards, decoradores
    ├── roles/         authz.service (resolución de permisos en BD)
    ├── users/         entidades usuarios + usuario_roles
    ├── persons/       personas + persona_etapas + catálogos (compañía/etapa/sede)
    ├── groups/        grupos, integrantes, encargados dinámicos
    ├── sessions/      jornadas + programaciones (horarios)
    ├── attendance/    asistencias (entrada/salida; Fase 2: casos de uso completos)
    ├── dashboard/     GET /api/dashboard/today
    ├── audit/         bitácora append-only (auditoria)
    └── realtime/      gateway WebSocket + emisión de eventos
```

## Semillas (solo desarrollo)

| Usuario | Rol | Se crea en producción |
|---|---|---|
| `admin` | ADMIN_SISTEMA | Sí |
| `jefe.instruccion` | JEFE_INSTRUCCION | No (demo) |
| `encargado.postulantes` | ENCARGADO_GRUPO (grupo Postulantes 2026-II) | No (demo) |

Ninguna contraseña está en el código. Al crear cada cuenta se usa
`SEED_ADMIN_PASSWORD`, `SEED_JEFE_PASSWORD` o `SEED_ENCARGADO_PASSWORD` (mínimo
12 caracteres) o, si no existe, se genera una aleatoria que se imprime una sola
vez. Con `NODE_ENV=production` no se crean datos de demostración.
Ejecutar: `npm run seed` (idempotente).

## Comandos

```powershell
# backend
cd backend; npm run start:dev        # API en http://localhost:3000/api (Swagger en /api/docs)

# frontend
cd frontend; npm start                # http://localhost:4200 (Vite)
```

## Estado Fase 1

- [x] Login / refresh / logout con auditoría
- [x] Permisos actuales desde BD en cada request
- [x] Personas, grupos, encargados dinámicos, jornadas (crear/abrir/cerrar)
- [x] Asistencia mínima: entrada (1 clic) y salida
- [x] `GET /api/dashboard/today` con datos reales
- [x] WebSocket `dashboard.actualizar` verificado E2E
- [x] Frontend: login, layout con sidebar dinámico, Inicio del Jefe, responsive

## Estado Fase 2 — Asistencia completa

Casos de uso implementados (22/22 pruebas E2E en verde, `backend/fase2-e2e.js`):

| Endpoint | Caso de uso |
|---|---|
| `POST /attendance/entry` | RegistrarEntrada (1 clic, hora del servidor, geo) |
| `POST /attendance/exit` | RegistrarSalida (requiere entrada previa) |
| `POST /attendance/manual-entry` | Registro manual (hora + motivo, tipo MANUAL) |
| `POST /attendance/justified-absence` | Falta justificada (+ justificaciones.tipo FALTA) |
| `POST /attendance/early-exit` | Salida anticipada con motivo |
| `PATCH /attendance/:id/manual-adjust` | Ajuste manual de horas (solo `attendance.update`) |
| `PATCH /attendance/:id/observation` | Observación |
| `POST /attendance/:id/annul` | Anular (solo `attendance.cancel`, nunca borrado) |
| `GET /attendance/board/:jornadaId` | Pizarra (pendientes primero) |
| `GET /attendance/sessions/:id/pending` | Pendientes de la jornada |
| `POST /attendance/sessions/:id/close` | CerrarJornada (pendientes → FALTA_INJUSTIFICADA con confirmación 422) |

### Reglas de negocio confirmadas

- **UQ(jornada, persona)**: una fila por persona por jornada. Tras anular, la fila se **reactiva** (no se crea otra) — auditoría conserva el ciclo completo.
- Una persona no puede tener dos registros activos en la jornada (409).
- Registro en jornada CERRADA → 422.
- Geolocalización por evento en `asistencia_ubicaciones` (Haversine vs. geocerca de la sede).
- Cierre: si hay pendientes, la API responde 422 con la lista y la UI pide confirmación explícita.

### Frontend

- `/asistencia`: pizarra operativa (pendientes primero, entrada 1-clic, menú contextual, cierre de jornada, captura GPS del dispositivo).
- `/mi-grupo`: vista del encargado con integrantes y jefe de turno.
- Actualización en vivo por WebSocket en pizarra y dashboard.

## Estado Fase 3 — Seguimiento, Formación, Reportes, Auditoría

Pruebas E2E: `backend/fase3-e2e.js` (12/12 PASS).

| Endpoint | Caso de uso |
|---|---|
| `GET /tracking?grupoId&desde&hasta&orden` | Métricas reales por integrante; orden: faltas_injustificadas / menor_asistencia / salidas_anticipadas / horas |
| `POST /formation/promote` | Promueve persona a etapa superior (sin duplicar; cierra etapa activa y crea nueva fila) |
| `GET /formation/personas/:id/historial` | Toda la trayectoria de etapas de una persona |
| `GET /formation/historial` | Historial general |
| `POST /reports/generate` | PDF o Excel (estado general / detalle individual / jornada) + registro en `reportes_generados` + hash SHA-256 |
| `GET /audit?modulo&accion&desde&hasta&pagina` | Auditoría paginada, solo `audit.view_full` |

### Frontend
- `/seguimiento`, `/formacion/personas` (con historial + promover), `/formacion/grupos`, `/formacion/historial`, `/reportes`, `/auditoria` — todas **datos reales, sin mocks**.

## Reglas de negocio reforzadas (migración a React)

- **Fecha de negocio**: nunca `toISOString().slice(0, 10)` (es UTC: en Lima ya es "mañana" desde las 19:00). Backend usa `fechaServidor()` / `fechaLocalIso()` de `common/utils/fecha.util.ts`; el frontend, `fechaLocalIso()` de `shared/utils/format.ts`.
- **Horas programadas**: se insertan con SQL directo y cadena ISO. `repository.save()` con cadena ISO las guarda +5 h. Para corregir datos existentes: `database/scripts/correccion_horarios_jornadas.sql`.
- **Apertura**: solo jornadas `PROGRAMADA` de hoy o anteriores; emite `jornada.abierta`.
- **Horas manuales**: formato `HH:mm` válido, nunca futuras; en un ajuste la salida debe quedar después de la entrada, y agregar salida a un `PRESENTE` lo deja `FINALIZADO`.
- **Salida / salida anticipada**: si la entrada registrada es posterior a la hora actual se rechaza con 422 (antes fallaba en silencio).
- **Cierre**: valida que el usuario sea encargado del grupo (o tenga vista global); pendientes → `FALTA_INJUSTIFICADA`; quienes siguen `PRESENTE` reciben su salida (hora de fin programada o la actual, la menor). `GET /attendance/sessions/:id/close-summary` anticipa ambos grupos.
- **Dashboard**: `GET /dashboard/today?fecha=YYYY-MM-DD`; incluye jornadas sin abrir/sin cerrar, justificaciones por revisar, próxima jornada e indicadores reales del mes por grupo.
- **Reportes**: `formato` acepta `PDF` o `EXCEL`; los grupos solo son obligatorios en `ESTADO_GENERAL`; `GET /reports/recent` lista los últimos generados y su formato.
- **Promoción**: el grupo destino debe estar activo y pertenecer a la etapa destino.
- **Integrantes de un grupo**: sin vista global, solo el encargado activo del grupo.

## Gestión de grupos (CRUD)

Pantallas: `/formacion/grupos` (lista con filtros por estado/etapa y búsqueda) y `/formacion/grupos/:id` (detalle: integrantes, encargado, datos, ex integrantes). Los grupos no eligen sede: siempre usan la sede principal (Rímac 21) para la geocerca (`grupos_formacion.sede_id` queda en NULL).

| Permiso (vía rol) | Qué habilita |
| --- | --- |
| `formation.view` | Ver lista y detalle (modo consulta) |
| `formation.manage_groups` | Crear, editar, cerrar/cancelar, reactivar, eliminar, asignar o quitar encargado |
| `formation.manage_groups` + `formation.manage_people` | Agregar, transferir y dar de baja integrantes |
| `attendance.view_assigned_group` | Requisito para **ser designado** encargado (rol «Encargado de grupo») |

Endpoints (`/groups`): `GET /`, `GET /catalogos`, `GET /:id`, `GET /:id/candidatos?q=`, `POST /`, `PATCH /:id`, `POST /:id/estado`, `POST /:id/reactivar`, `DELETE /:id`, `POST /:id/managers`, `POST /:id/managers/finalizar`, `POST /:id/members`, `POST /:id/members/:personaId/retirar`.

Reglas:

- **Crear** genera la programación reglamentaria: voluntaria diaria 08:00–18:30 y, para Postulante y Aspirante de compañía, obligatorias miércoles/viernes 19:30 y domingo 07:30 (`horarioReglamentario()` en `reglas-asistencia.ts`). Código único por compañía, normalizado a mayúsculas; fin ≥ inicio.
- **Editar** solo grupos `ACTIVO`. La **etapa** solo cambia mientras el grupo no tenga historia (integrantes o asistencias); al cambiarla se regenera la programación.
- **Cerrar** (fin del periodo) o **cancelar**: exige motivo y que no haya jornadas `ABIERTA`. Finaliza integrantes activos (conservan su etapa), encargado y programación, y cancela las jornadas `PROGRAMADA` desde hoy.
- **Reactivar** (cerrado/cancelado → activo): exige motivo; quita la fecha de fin, genera una programación nueva desde hoy, repone las jornadas futuras que canceló el cierre y, opcionalmente, reincorpora a quienes salieron en el último cierre salvo que hoy estén en otro grupo, en otra etapa o retirados (se informan como omitidos). El encargado se asigna de nuevo.
- **Eliminar** (borrado físico) solo si el grupo nunca tuvo integrantes, asistencias ni reportes (grupo creado por error); si no, usar cerrar/cancelar.
- **Encargado**: un usuario encarga un solo grupo activo; moverlo desde otro grupo requiere `reasignar: true`. Las asignaciones anteriores quedan en el historial con su motivo.
- **Elegir encargado entre los integrantes**: `GET /:id/candidatos-encargado` lista primero a los integrantes activos del grupo (con o sin cuenta) y luego a otros usuarios ya habilitados. Al asignar un integrante (`personaId`): si tiene cuenta con el rol se usa; si no tiene el rol se le otorga **solo** `ENCARGADO_GRUPO` (`ROLE_GRANTED`); si no tiene cuenta se crea con el usuario indicado y una contraseña temporal (argon2) que se devuelve una sola vez (`USER_CREATED`). Solo se crean cuentas u otorgan roles a integrantes activos del grupo, y se invalida la caché de permisos del usuario. Pendiente: que el usuario pueda cambiar su contraseña desde la UI.
- **Integrantes**: una persona integra un solo grupo activo y siempre de su etapa vigente. Sin etapa → se abre la del grupo; misma etapa en otro grupo → `transferir: true` (cierra el tramo anterior en `persona_etapas`); otra etapa → se rechaza (usar «Promover»).
- **Baja**: `QUITAR` (error de registro o reubicación) o `RETIRO` (abandona la formación: su etapa pasa a `RETIRADO`). Con `QUITAR`, si la etapa vigente **nació al ingresar a ese grupo** (observación «Ingreso al grupo…»: no tenía etapa antes) se cierra y la persona queda **sin etapa**; si ya la tenía (promoción, transferencia, «Cambio al grupo…») se cierra ese tramo y sigue en la etapa **sin grupo**. Siempre queda constancia en `persona_etapas.observacion` («Quitado del grupo X: motivo») y en los ex integrantes. Las asistencias se conservan. También se puede quitar desde la ficha de la persona.
- Auditoría: `GROUP_CREATED/UPDATED/CLOSED/CANCELLED/REACTIVATED/DELETED`, `MANAGER_ASSIGNED/REMOVED`, `MEMBER_ADDED/TRANSFERRED/REMOVED/RETIRED`.
- `jornadas` tiene un trigger: en SQL Server no admite `UPDATE … OUTPUT` sin `INTO` (se usa `@@ROWCOUNT`).

## Gestión de personas (CRUD)

Pantalla `/formacion/personas`: búsqueda, combo de **categoría** con conteo (Todas las personas · Postulante · Aspirante de compañía · Aspirante en formación ESBAS · **Instrucción**) y estado (por defecto **todos**), columna Estado siempre visible, tabla paginada con **filas por página 10/25/50/100** (se recuerda por navegador) y filtros en la URL. Ficha única para crear/editar con acciones de desactivar, reactivar y eliminar.

**Instrucción** = personal del sistema: tiene cuenta con rol y no tiene etapa ni grupo como integrante (jefatura, encargados, administración). Un encargado **no** es integrante del grupo que encarga: la grilla lo muestra como «Encargado · grupo».

| Permiso (vía rol) | Qué habilita |
| --- | --- |
| `formation.view` | Listar, filtrar por grupo y ver historial |
| `formation.manage_people` | Registrar, editar, desactivar/reactivar y eliminar |
| `+ formation.manage_groups` | Incorporar a un grupo al registrar |
| `formation.promote` | Promover de etapa: **solo Jefe de Instrucción** (ni el administrador) |

Endpoints (`/persons`): `GET /?q&pagina&tamano&grupoId&etapa&estado` (`etapa=INSTRUCCION` = personal, `etapa=SIN_ETAPA` = alumnos sin etapa; `grupoId=0` sin grupo, `-1` personal; `estado` por defecto `TODOS`), `GET /resumen?estado` (conteo por etapa, Instrucción y grupos activos), `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/estado`, `DELETE /:id`.

Reglas:

- DNI de 8 dígitos y único; teléfono y correo validados; en la edición `''`/`null` borra el dato.
- **Desactivar** (motivo obligatorio): se rechaza si está PRESENTE en una jornada abierta; sale de su grupo (`RETIRADO`), su etapa vigente queda `RETIRADO`, y si tiene cuenta esta pasa a `INACTIVA` y deja de ser encargado.
- **Reactivar**: vuelve a `ACTIVO`; el grupo se reasigna desde Grupos y la cuenta la reactiva un administrador.
- **Eliminar** solo sin etapas, grupos, asistencias ni cuenta (borra también su QR).
- `personas` tiene trigger (crea el QR): los INSERT usan `SCOPE_IDENTITY()`, no `OUTPUT`.
- `UQ_personas_compania_dni` admite **una sola** persona sin DNI; la API lo informa. Script opcional: `database/scripts/20260927_personas_dni_opcional.sql` (índice único filtrado).
- Promover solo aplica a personas con etapa vigente (no al personal de Instrucción).
- Script `database/scripts/20260927_promover_solo_jefe_y_quitar_integrante.sql` (aplicado): deja `formation.promote` solo en `JEFE_INSTRUCCION` y corrige etapas que quedaron ligadas a un grupo del que se quitó a la persona.
- Auditoría: `PERSON_CREATED/UPDATED/DEACTIVATED/REACTIVATED/DELETED`.

## Pendiente / Fase 4

- Administración de usuarios desde la UI (crear usuario, asignar roles) hoy solo vía seed/API
- Despliegue en Windows Server: nest como servicio, frontend compilado (`npm run build` → `frontend/dist`) + IIS proxy
- Configuración de sede (geocerca) desde UI
- Aprobación de justificaciones en la UI del Jefe
