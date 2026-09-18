# Rímac 21 — Sistema del Área de Instrucción

## Arquitectura

Monolito modular:

```
Angular (frontend/)  →  REST + WebSocket  →  NestJS (backend/)  →  TypeORM  →  SQL Server
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

| Usuario | Clave | Rol |
|---|---|---|
| `admin` | `R21#Admin2026` | ADMIN_SISTEMA |
| `jefe.instruccion` | `R21#Jefe2026` | JEFE_INSTRUCCION |
| `encargado.postulantes` | `R21#Enc2026` | ENCARGADO_GRUPO (grupo Postulantes 2026-II) |

Cambiar antes de producción. Ejecutar: `npm run seed` (idempotente).

## Comandos

```powershell
# backend
cd backend; npm run start:dev        # API en http://localhost:3000/api (Swagger en /api/docs)

# frontend
cd frontend; npx ng serve            # http://localhost:4200
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
| `POST /reports/generate` | PDF descargable (estado general / detalle individual / jornada) + registro en `reportes_generados` + hash SHA-256 |
| `GET /audit?modulo&accion&desde&hasta&pagina` | Auditoría paginada, solo `audit.view_full` |

### Frontend
- `/seguimiento`, `/formacion/personas` (con historial + promover), `/formacion/grupos`, `/formacion/historial`, `/reportes`, `/auditoria` — todas **datos reales, sin mocks**.

## Pendiente / Fase 4

- Administración de usuarios desde la UI (crear usuario, asignar roles) hoy solo vía seed/API
- Despliegue en Windows Server: nest como servicio, Angular compilado + IIS proxy
- Configuración de sede (geocerca) desde UI
- Aprobación de justificaciones en la UI del Jefe
