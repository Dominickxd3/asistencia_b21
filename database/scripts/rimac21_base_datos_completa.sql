/*
    RIMAC 21 - Sistema de Instrucción y Asistencia
    SQL Server
    Esquema inicial integral
*/

SET NOCOUNT ON;
GO

IF DB_ID(N'Rimac21Instruccion') IS NULL
BEGIN
    CREATE DATABASE Rimac21Instruccion;
END
GO

USE Rimac21Instruccion;
GO

/* ============================================================
   1. ORGANIZACIÓN
   ============================================================ */

CREATE TABLE dbo.companias (
    compania_id            INT IDENTITY(1,1) PRIMARY KEY,
    nombre                 NVARCHAR(150) NOT NULL,
    codigo                 NVARCHAR(50) NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion    DATETIME2(0) NULL,
    CONSTRAINT CK_companias_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);
GO

CREATE TABLE dbo.areas (
    area_id                INT IDENTITY(1,1) PRIMARY KEY,
    compania_id            INT NOT NULL,
    nombre                 NVARCHAR(120) NOT NULL,
    descripcion            NVARCHAR(300) NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_areas_compania FOREIGN KEY (compania_id)
        REFERENCES dbo.companias(compania_id),
    CONSTRAINT CK_areas_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);
GO

/* ============================================================
   2. PERSONAS Y USUARIOS
   ============================================================ */

CREATE TABLE dbo.personas (
    persona_id             INT IDENTITY(1,1) PRIMARY KEY,
    compania_id            INT NOT NULL,
    dni                    VARCHAR(20) NULL,
    nombres                NVARCHAR(100) NOT NULL,
    apellido_paterno       NVARCHAR(80) NOT NULL,
    apellido_materno       NVARCHAR(80) NULL,
    telefono               VARCHAR(30) NULL,
    correo                 NVARCHAR(150) NULL,
    fecha_nacimiento       DATE NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion    DATETIME2(0) NULL,
    CONSTRAINT FK_personas_compania FOREIGN KEY (compania_id)
        REFERENCES dbo.companias(compania_id),
    CONSTRAINT UQ_personas_compania_dni UNIQUE (compania_id, dni),
    CONSTRAINT CK_personas_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);
GO

CREATE TABLE dbo.usuarios (
    usuario_id             INT IDENTITY(1,1) PRIMARY KEY,
    persona_id             INT NOT NULL,
    username               NVARCHAR(80) NOT NULL,
    password_hash          NVARCHAR(500) NOT NULL,
    estado_cuenta          VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    ultimo_login_at        DATETIME2(0) NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion    DATETIME2(0) NULL,
    CONSTRAINT FK_usuarios_persona FOREIGN KEY (persona_id)
        REFERENCES dbo.personas(persona_id),
    CONSTRAINT UQ_usuarios_username UNIQUE (username),
    CONSTRAINT UQ_usuarios_persona UNIQUE (persona_id),
    CONSTRAINT CK_usuarios_estado CHECK (estado_cuenta IN ('ACTIVA','BLOQUEADA','INACTIVA'))
);
GO

CREATE TABLE dbo.persona_qr (
    persona_qr_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    persona_id             INT NOT NULL,
    codigo                 VARCHAR(36) NOT NULL DEFAULT CONVERT(VARCHAR(36), NEWID()),
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    generado_por_usuario_id INT NULL,
    fecha_generacion       DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion    DATETIME2(0) NULL,
    CONSTRAINT FK_persona_qr_persona FOREIGN KEY (persona_id)
        REFERENCES dbo.personas(persona_id),
    CONSTRAINT FK_persona_qr_usuario FOREIGN KEY (generado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT UQ_persona_qr_persona UNIQUE (persona_id),
    CONSTRAINT UQ_persona_qr_codigo UNIQUE (codigo),
    CONSTRAINT CK_persona_qr_estado CHECK (estado IN ('ACTIVO','REVOCADO'))
);
GO

CREATE OR ALTER TRIGGER dbo.TR_personas_crear_qr
ON dbo.personas
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.persona_qr (persona_id, codigo, estado)
    SELECT i.persona_id, CONVERT(VARCHAR(36), NEWID()), 'ACTIVO'
    FROM inserted i;
END;
GO

/* ============================================================
   3. ROLES Y PERMISOS
   ============================================================ */

CREATE TABLE dbo.roles (
    rol_id                 INT IDENTITY(1,1) PRIMARY KEY,
    codigo                 VARCHAR(60) NOT NULL,
    nombre                 NVARCHAR(120) NOT NULL,
    descripcion            NVARCHAR(300) NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT UQ_roles_codigo UNIQUE (codigo),
    CONSTRAINT CK_roles_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);
GO

CREATE TABLE dbo.permisos (
    permiso_id             INT IDENTITY(1,1) PRIMARY KEY,
    codigo                 VARCHAR(120) NOT NULL,
    nombre                 NVARCHAR(150) NOT NULL,
    modulo                 NVARCHAR(80) NOT NULL,
    descripcion            NVARCHAR(300) NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT UQ_permisos_codigo UNIQUE (codigo),
    CONSTRAINT CK_permisos_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);
GO

CREATE TABLE dbo.rol_permisos (
    rol_id                 INT NOT NULL,
    permiso_id             INT NOT NULL,
    fecha_asignacion       DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    PRIMARY KEY (rol_id, permiso_id),
    CONSTRAINT FK_rolpermisos_rol FOREIGN KEY (rol_id)
        REFERENCES dbo.roles(rol_id),
    CONSTRAINT FK_rolpermisos_permiso FOREIGN KEY (permiso_id)
        REFERENCES dbo.permisos(permiso_id)
);
GO

CREATE TABLE dbo.usuario_roles (
    usuario_rol_id         INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id             INT NOT NULL,
    rol_id                 INT NOT NULL,
    fecha_inicio           DATE NOT NULL,
    fecha_fin              DATE NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    asignado_por_usuario_id INT NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_usuario_roles_usuario FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT FK_usuario_roles_rol FOREIGN KEY (rol_id)
        REFERENCES dbo.roles(rol_id),
    CONSTRAINT FK_usuario_roles_asignado_por FOREIGN KEY (asignado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_usuario_roles_estado CHECK (estado IN ('ACTIVO','FINALIZADO'))
);
GO

/* ============================================================
   4. CUADRO DEL ÁREA DE INSTRUCCIÓN
   Jefe / Subjefe / Adjuntos, con vigencia histórica
   ============================================================ */

CREATE TABLE dbo.cargos_area (
    cargo_area_id          INT IDENTITY(1,1) PRIMARY KEY,
    area_id                INT NOT NULL,
    codigo                 VARCHAR(60) NOT NULL,
    nombre                 NVARCHAR(120) NOT NULL,
    nivel_jerarquico       INT NOT NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT FK_cargos_area_area FOREIGN KEY (area_id)
        REFERENCES dbo.areas(area_id),
    CONSTRAINT UQ_cargos_area_codigo UNIQUE (area_id, codigo),
    CONSTRAINT CK_cargos_area_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);
GO

CREATE TABLE dbo.usuario_cargos_area (
    usuario_cargo_area_id  INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id             INT NOT NULL,
    cargo_area_id          INT NOT NULL,
    fecha_inicio           DATE NOT NULL,
    fecha_fin              DATE NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    asignado_por_usuario_id INT NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_usuario_cargos_usuario FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT FK_usuario_cargos_cargo FOREIGN KEY (cargo_area_id)
        REFERENCES dbo.cargos_area(cargo_area_id),
    CONSTRAINT FK_usuario_cargos_asignado_por FOREIGN KEY (asignado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_usuario_cargos_estado CHECK (estado IN ('ACTIVO','FINALIZADO'))
);
GO

/* ============================================================
   5. ETAPAS DE FORMACIÓN
   ============================================================ */

CREATE TABLE dbo.etapas_formacion (
    etapa_id               INT IDENTITY(1,1) PRIMARY KEY,
    codigo                 VARCHAR(60) NOT NULL,
    nombre                 NVARCHAR(150) NOT NULL,
    orden                  INT NOT NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT UQ_etapas_codigo UNIQUE (codigo),
    CONSTRAINT UQ_etapas_orden UNIQUE (orden),
    CONSTRAINT CK_etapas_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);
GO

/* ============================================================
   6. GRUPOS / COHORTES
   ============================================================ */

CREATE TABLE dbo.grupos_formacion (
    grupo_id               INT IDENTITY(1,1) PRIMARY KEY,
    compania_id            INT NOT NULL,
    etapa_id               INT NOT NULL,
    codigo                 VARCHAR(60) NOT NULL,
    nombre                 NVARCHAR(150) NOT NULL,
    periodo                NVARCHAR(30) NOT NULL,
    fecha_inicio           DATE NOT NULL,
    fecha_fin              DATE NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    creado_por_usuario_id  INT NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion    DATETIME2(0) NULL,
    CONSTRAINT FK_grupos_compania FOREIGN KEY (compania_id)
        REFERENCES dbo.companias(compania_id),
    CONSTRAINT FK_grupos_etapa FOREIGN KEY (etapa_id)
        REFERENCES dbo.etapas_formacion(etapa_id),
    CONSTRAINT FK_grupos_creado_por FOREIGN KEY (creado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT UQ_grupos_codigo UNIQUE (compania_id, codigo),
    CONSTRAINT CK_grupos_estado CHECK (estado IN ('ACTIVO','CERRADO','CANCELADO'))
);
GO

CREATE TABLE dbo.grupo_integrantes (
    grupo_integrante_id    INT IDENTITY(1,1) PRIMARY KEY,
    grupo_id               INT NOT NULL,
    persona_id             INT NOT NULL,
    fecha_inicio           DATE NOT NULL,
    fecha_fin              DATE NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    motivo_salida          NVARCHAR(300) NULL,
    creado_por_usuario_id  INT NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_grupo_integrantes_grupo FOREIGN KEY (grupo_id)
        REFERENCES dbo.grupos_formacion(grupo_id),
    CONSTRAINT FK_grupo_integrantes_persona FOREIGN KEY (persona_id)
        REFERENCES dbo.personas(persona_id),
    CONSTRAINT FK_grupo_integrantes_creado_por FOREIGN KEY (creado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_grupo_integrantes_estado CHECK (estado IN ('ACTIVO','FINALIZADO','RETIRADO','SUSPENDIDO'))
);
GO

CREATE INDEX IX_grupo_integrantes_persona_estado
ON dbo.grupo_integrantes(persona_id, estado);
GO

/* ============================================================
   7. HISTORIAL DE ETAPAS
   ============================================================ */

CREATE TABLE dbo.persona_etapas (
    persona_etapa_id       INT IDENTITY(1,1) PRIMARY KEY,
    persona_id             INT NOT NULL,
    etapa_id               INT NOT NULL,
    grupo_id               INT NULL,
    fecha_inicio           DATE NOT NULL,
    fecha_fin              DATE NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    observacion            NVARCHAR(500) NULL,
    registrado_por_usuario_id INT NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_persona_etapas_persona FOREIGN KEY (persona_id)
        REFERENCES dbo.personas(persona_id),
    CONSTRAINT FK_persona_etapas_etapa FOREIGN KEY (etapa_id)
        REFERENCES dbo.etapas_formacion(etapa_id),
    CONSTRAINT FK_persona_etapas_grupo FOREIGN KEY (grupo_id)
        REFERENCES dbo.grupos_formacion(grupo_id),
    CONSTRAINT FK_persona_etapas_registrado_por FOREIGN KEY (registrado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_persona_etapas_estado CHECK (estado IN ('ACTIVO','FINALIZADO','RETIRADO','SUSPENDIDO'))
);
GO

/* ============================================================
   8. ENCARGADOS DINÁMICOS DE GRUPO
   ============================================================ */

CREATE TABLE dbo.grupo_encargados (
    grupo_encargado_id     INT IDENTITY(1,1) PRIMARY KEY,
    grupo_id               INT NOT NULL,
    usuario_id             INT NOT NULL,
    fecha_inicio           DATETIME2(0) NOT NULL,
    fecha_fin              DATETIME2(0) NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    asignado_por_usuario_id INT NULL,
    motivo_finalizacion    NVARCHAR(300) NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_grupo_encargados_grupo FOREIGN KEY (grupo_id)
        REFERENCES dbo.grupos_formacion(grupo_id),
    CONSTRAINT FK_grupo_encargados_usuario FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT FK_grupo_encargados_asignado_por FOREIGN KEY (asignado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_grupo_encargados_estado CHECK (estado IN ('ACTIVO','FINALIZADO'))
);
GO

CREATE INDEX IX_grupo_encargados_activos
ON dbo.grupo_encargados(grupo_id, usuario_id, estado);
GO

/* ============================================================
   9. PROGRAMACIONES / HORARIOS
   ============================================================ */

CREATE TABLE dbo.programaciones (
    programacion_id        INT IDENTITY(1,1) PRIMARY KEY,
    grupo_id               INT NOT NULL,
    fecha_inicio           DATE NOT NULL,
    fecha_fin              DATE NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    creado_por_usuario_id  INT NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_programaciones_grupo FOREIGN KEY (grupo_id)
        REFERENCES dbo.grupos_formacion(grupo_id),
    CONSTRAINT FK_programaciones_creado_por FOREIGN KEY (creado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_programaciones_estado CHECK (estado IN ('ACTIVO','FINALIZADO'))
);
GO

CREATE TABLE dbo.programacion_detalles (
    programacion_detalle_id INT IDENTITY(1,1) PRIMARY KEY,
    programacion_id        INT NOT NULL,
    dia_semana             TINYINT NOT NULL,
    hora_inicio            TIME(0) NULL,
    hora_fin               TIME(0) NULL,
    tipo_jornada           VARCHAR(20) NOT NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    CONSTRAINT FK_programacion_detalles_programacion FOREIGN KEY (programacion_id)
        REFERENCES dbo.programaciones(programacion_id),
    CONSTRAINT CK_programacion_dia CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT CK_programacion_tipo CHECK (tipo_jornada IN ('OBLIGATORIA','VOLUNTARIA')),
    CONSTRAINT CK_programacion_detalle_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);
GO

/* ============================================================
   10. JORNADAS
   La asistencia se registra contra una jornada concreta.
   ============================================================ */

CREATE TABLE dbo.jornadas (
    jornada_id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    grupo_id               INT NOT NULL,
    programacion_detalle_id INT NULL,
    fecha                  DATE NOT NULL,
    fecha_hora_inicio_programada DATETIME2(0) NULL,
    fecha_hora_fin_programada    DATETIME2(0) NULL,
    tipo_jornada           VARCHAR(20) NOT NULL,
    origen                 VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADA',
    titulo                 NVARCHAR(180) NULL,
    observacion            NVARCHAR(500) NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADA',
    abierta_por_usuario_id INT NULL,
    cerrada_por_usuario_id INT NULL,
    fecha_apertura         DATETIME2(0) NULL,
    fecha_cierre           DATETIME2(0) NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_jornadas_grupo FOREIGN KEY (grupo_id)
        REFERENCES dbo.grupos_formacion(grupo_id),
    CONSTRAINT FK_jornadas_programacion_detalle FOREIGN KEY (programacion_detalle_id)
        REFERENCES dbo.programacion_detalles(programacion_detalle_id),
    CONSTRAINT FK_jornadas_abierta_por FOREIGN KEY (abierta_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT FK_jornadas_cerrada_por FOREIGN KEY (cerrada_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_jornadas_tipo CHECK (tipo_jornada IN ('OBLIGATORIA','VOLUNTARIA')),
    CONSTRAINT CK_jornadas_origen CHECK (origen IN ('PROGRAMADA','EXTRAORDINARIA')),
    CONSTRAINT CK_jornadas_estado CHECK (estado IN ('PROGRAMADA','ABIERTA','CERRADA','CANCELADA'))
);
GO

CREATE INDEX IX_jornadas_grupo_fecha
ON dbo.jornadas(grupo_id, fecha);
GO

/* ============================================================
   11. ASISTENCIAS
   ============================================================ */

CREATE TABLE dbo.asistencias (
    asistencia_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    jornada_id             BIGINT NOT NULL,
    persona_id             INT NOT NULL,
    fecha_hora_entrada     DATETIME2(0) NULL,
    fecha_hora_salida      DATETIME2(0) NULL,
    estado_asistencia      VARCHAR(30) NOT NULL,
    tipo_registro          VARCHAR(20) NOT NULL DEFAULT 'AUTOMATICO',
    motivo_registro_manual NVARCHAR(500) NULL,
    observacion            NVARCHAR(500) NULL,
    registrado_por_usuario_id INT NOT NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion    DATETIME2(0) NULL,
    anulado_por_usuario_id INT NULL,
    fecha_anulacion        DATETIME2(0) NULL,
    motivo_anulacion       NVARCHAR(500) NULL,
    CONSTRAINT FK_asistencias_jornada FOREIGN KEY (jornada_id)
        REFERENCES dbo.jornadas(jornada_id),
    CONSTRAINT FK_asistencias_persona FOREIGN KEY (persona_id)
        REFERENCES dbo.personas(persona_id),
    CONSTRAINT FK_asistencias_registrado_por FOREIGN KEY (registrado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT FK_asistencias_anulado_por FOREIGN KEY (anulado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT UQ_asistencias_jornada_persona UNIQUE (jornada_id, persona_id),
    CONSTRAINT CK_asistencias_estado CHECK (
        estado_asistencia IN (
            'PENDIENTE',
            'PRESENTE',
            'FINALIZADO',
            'FALTA_JUSTIFICADA',
            'FALTA_INJUSTIFICADA',
            'SALIDA_ANTICIPADA',
            'ANULADO'
        )
    ),
    CONSTRAINT CK_asistencias_tipo_registro CHECK (tipo_registro IN ('AUTOMATICO','MANUAL')),
    CONSTRAINT CK_asistencias_horas CHECK (
        fecha_hora_salida IS NULL
        OR fecha_hora_entrada IS NULL
        OR fecha_hora_salida >= fecha_hora_entrada
    )
);
GO

CREATE INDEX IX_asistencias_persona
ON dbo.asistencias(persona_id, jornada_id);
GO

CREATE INDEX IX_asistencias_estado
ON dbo.asistencias(estado_asistencia);
GO

/* ============================================================
   12. JUSTIFICACIONES
   ============================================================ */

CREATE TABLE dbo.justificaciones (
    justificacion_id       BIGINT IDENTITY(1,1) PRIMARY KEY,
    asistencia_id          BIGINT NOT NULL,
    tipo                   VARCHAR(30) NOT NULL DEFAULT 'FALTA',
    descripcion            NVARCHAR(1000) NOT NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'APROBADA',
    registrado_por_usuario_id INT NOT NULL,
    aprobado_por_usuario_id INT NULL,
    fecha_registro         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    fecha_resolucion       DATETIME2(0) NULL,
    CONSTRAINT FK_justificaciones_asistencia FOREIGN KEY (asistencia_id)
        REFERENCES dbo.asistencias(asistencia_id),
    CONSTRAINT FK_justificaciones_registrado_por FOREIGN KEY (registrado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT FK_justificaciones_aprobado_por FOREIGN KEY (aprobado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_justificaciones_tipo CHECK (tipo IN ('FALTA','SALIDA_ANTICIPADA','OTRA')),
    CONSTRAINT CK_justificaciones_estado CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA'))
);
GO

/* ============================================================
   13. GEOLOCALIZACIÓN DE REGISTROS
   ============================================================ */

CREATE TABLE dbo.asistencia_ubicaciones (
    ubicacion_id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    asistencia_id          BIGINT NOT NULL,
    usuario_id             INT NOT NULL,
    tipo_evento            VARCHAR(30) NOT NULL,
    latitud                DECIMAL(9,6) NULL,
    longitud               DECIMAL(9,6) NULL,
    precision_metros       DECIMAL(10,2) NULL,
    distancia_sede_metros  DECIMAL(12,2) NULL,
    estado_geografico      VARCHAR(30) NOT NULL DEFAULT 'NO_DISPONIBLE',
    fecha_captura          DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_asistencia_ubicaciones_asistencia FOREIGN KEY (asistencia_id)
        REFERENCES dbo.asistencias(asistencia_id),
    CONSTRAINT FK_asistencia_ubicaciones_usuario FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_ubicaciones_evento CHECK (tipo_evento IN ('ENTRADA','SALIDA','MODIFICACION','ANULACION')),
    CONSTRAINT CK_ubicaciones_estado CHECK (estado_geografico IN ('DENTRO_ZONA','FUERA_ZONA','NO_DISPONIBLE'))
);
GO

/* ============================================================
   14. CONFIGURACIÓN MÍNIMA DE SEDE / GEOCERCA
   Solo para administración técnica.
   ============================================================ */

CREATE TABLE dbo.sedes (
    sede_id                INT IDENTITY(1,1) PRIMARY KEY,
    compania_id            INT NOT NULL,
    nombre                 NVARCHAR(150) NOT NULL,
    latitud                DECIMAL(9,6) NULL,
    longitud               DECIMAL(9,6) NULL,
    radio_geocerca_metros  DECIMAL(10,2) NULL,
    politica_fuera_zona    VARCHAR(30) NOT NULL DEFAULT 'BLOQUEAR',
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_sedes_compania FOREIGN KEY (compania_id)
        REFERENCES dbo.companias(compania_id),
    CONSTRAINT CK_sedes_politica CHECK (politica_fuera_zona IN ('ADVERTIR','JUSTIFICAR','BLOQUEAR')),
    CONSTRAINT CK_sedes_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
);
GO

/* ============================================================
   15. SESIONES / AUTH
   ============================================================ */

CREATE TABLE dbo.sesiones (
    sesion_id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    usuario_id             INT NOT NULL,
    refresh_token_hash     NVARCHAR(500) NOT NULL,
    ip_address             VARCHAR(64) NULL,
    user_agent             NVARCHAR(500) NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    fecha_expiracion       DATETIME2(0) NOT NULL,
    fecha_revocacion       DATETIME2(0) NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    CONSTRAINT FK_sesiones_usuario FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_sesiones_estado CHECK (estado IN ('ACTIVA','REVOCADA','EXPIRADA'))
);
GO

/* ============================================================
   16. AUDITORÍA
   ============================================================ */

CREATE TABLE dbo.auditoria (
    auditoria_id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    usuario_id             INT NULL,
    accion                 VARCHAR(80) NOT NULL,
    modulo                 VARCHAR(80) NOT NULL,
    entidad                VARCHAR(100) NULL,
    entidad_id             NVARCHAR(100) NULL,
    valor_anterior_json    NVARCHAR(MAX) NULL,
    valor_nuevo_json       NVARCHAR(MAX) NULL,
    descripcion            NVARCHAR(1000) NULL,
    ip_address             VARCHAR(64) NULL,
    user_agent             NVARCHAR(500) NULL,
    latitud                DECIMAL(9,6) NULL,
    longitud               DECIMAL(9,6) NULL,
    fecha_hora             DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_auditoria_usuario FOREIGN KEY (usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_auditoria_json_anterior CHECK (valor_anterior_json IS NULL OR ISJSON(valor_anterior_json) = 1),
    CONSTRAINT CK_auditoria_json_nuevo CHECK (valor_nuevo_json IS NULL OR ISJSON(valor_nuevo_json) = 1)
);
GO

CREATE INDEX IX_auditoria_fecha
ON dbo.auditoria(fecha_hora DESC);
GO

CREATE INDEX IX_auditoria_usuario
ON dbo.auditoria(usuario_id, fecha_hora DESC);
GO

/* ============================================================
   17. REPORTES GENERADOS
   No guarda obligatoriamente el PDF; guarda la trazabilidad.
   ============================================================ */

CREATE TABLE dbo.reportes_generados (
    reporte_id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    codigo_reporte         VARCHAR(80) NOT NULL,
    tipo_reporte           VARCHAR(50) NOT NULL,
    fecha_desde            DATE NOT NULL,
    fecha_hasta            DATE NOT NULL,
    filtros_json           NVARCHAR(MAX) NULL,
    generado_por_usuario_id INT NOT NULL,
    fecha_generacion       DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    hash_documento         VARCHAR(128) NULL,
    CONSTRAINT UQ_reportes_codigo UNIQUE (codigo_reporte),
    CONSTRAINT FK_reportes_usuario FOREIGN KEY (generado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_reportes_filtros_json CHECK (filtros_json IS NULL OR ISJSON(filtros_json) = 1),
    CONSTRAINT CK_reportes_fechas CHECK (fecha_hasta >= fecha_desde)
);
GO

CREATE TABLE dbo.reporte_grupos (
    reporte_id             BIGINT NOT NULL,
    grupo_id               INT NOT NULL,
    PRIMARY KEY (reporte_id, grupo_id),
    CONSTRAINT FK_reporte_grupos_reporte FOREIGN KEY (reporte_id)
        REFERENCES dbo.reportes_generados(reporte_id),
    CONSTRAINT FK_reporte_grupos_grupo FOREIGN KEY (grupo_id)
        REFERENCES dbo.grupos_formacion(grupo_id)
);
GO

/* ============================================================
   18. CITACIONES
   Separadas de la asistencia de formación.
   No participan en porcentajes de asistencia.
   ============================================================ */

CREATE TABLE dbo.citaciones (
    citacion_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    compania_id            INT NOT NULL,
    titulo                 NVARCHAR(200) NOT NULL,
    descripcion            NVARCHAR(1000) NULL,
    fecha_hora_inicio      DATETIME2(0) NOT NULL,
    fecha_hora_fin         DATETIME2(0) NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADA',
    creado_por_usuario_id  INT NULL,
    fecha_creacion         DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_citaciones_compania FOREIGN KEY (compania_id)
        REFERENCES dbo.companias(compania_id),
    CONSTRAINT FK_citaciones_creado_por FOREIGN KEY (creado_por_usuario_id)
        REFERENCES dbo.usuarios(usuario_id),
    CONSTRAINT CK_citaciones_estado CHECK (estado IN ('PROGRAMADA','FINALIZADA','CANCELADA'))
);
GO

/* ============================================================
   19. DATOS BASE
   ============================================================ */

INSERT INTO dbo.companias (nombre, codigo)
VALUES (N'Compañía de Bomberos Voluntarios Rímac N.º 21', 'RIMAC21');
GO

DECLARE @compania_id INT = (SELECT TOP 1 compania_id FROM dbo.companias WHERE codigo = 'RIMAC21');

INSERT INTO dbo.areas (compania_id, nombre, descripcion)
VALUES (@compania_id, N'Área de Instrucción', N'Área responsable de formación, seguimiento y asistencia.');
GO

INSERT INTO dbo.etapas_formacion (codigo, nombre, orden)
VALUES
('POSTULANTE', N'Postulante', 1),
('ASPIRANTE_COMPANIA', N'Aspirante de compañía', 2),
('ASPIRANTE_ESBAS', N'Aspirante en formación ESBAS', 3);
GO

INSERT INTO dbo.roles (codigo, nombre, descripcion)
VALUES
('ADMIN_SISTEMA', N'Administrador del sistema', N'Administración técnica del sistema.'),
('JEFE_INSTRUCCION', N'Jefe de Instrucción', N'Supervisión operativa total del Área de Instrucción.'),
('SUBJEFE_INSTRUCCION', N'Subjefe de Instrucción', N'Supervisión operativa del Área de Instrucción.'),
('ADJUNTO_INSTRUCCION', N'Adjunto de Instrucción', N'Operación y apoyo del Área de Instrucción.'),
('ENCARGADO_GRUPO', N'Encargado de grupo', N'Acceso operativo únicamente mientras tenga una asignación activa.');
GO

INSERT INTO dbo.permisos (codigo, nombre, modulo)
VALUES
('inicio.view', N'Ver inicio', N'Inicio'),

('attendance.view', N'Ver asistencia', N'Asistencia'),
('attendance.register', N'Registrar asistencia', N'Asistencia'),
('attendance.update', N'Modificar asistencia', N'Asistencia'),
('attendance.cancel', N'Anular asistencia', N'Asistencia'),
('attendance.justify', N'Registrar justificaciones', N'Asistencia'),
('attendance.view_all_groups', N'Ver asistencia de todos los grupos', N'Asistencia'),
('attendance.view_assigned_group', N'Ver asistencia del grupo asignado', N'Asistencia'),

('tracking.view', N'Ver seguimiento', N'Seguimiento'),

('formation.view', N'Ver formación', N'Formación'),
('formation.manage_groups', N'Gestionar grupos', N'Formación'),
('formation.manage_people', N'Gestionar personas', N'Formación'),
('formation.promote', N'Promover personas entre etapas', N'Formación'),

('reports.view', N'Ver reportes', N'Reportes'),
('reports.generate', N'Generar reportes PDF', N'Reportes'),

('audit.view_operational', N'Ver auditoría operativa', N'Auditoría'),
('audit.view_full', N'Ver auditoría completa', N'Auditoría'),

('users.manage', N'Gestionar usuarios', N'Administración'),
('roles.manage', N'Gestionar roles y permisos', N'Administración'),
('settings.manage', N'Gestionar configuración técnica', N'Administración');
GO

/* ============================================================
   20. VISTAS ÚTILES
   ============================================================ */

CREATE VIEW dbo.vw_grupo_encargados_activos
AS
SELECT
    ge.grupo_encargado_id,
    ge.grupo_id,
    gf.nombre AS grupo_nombre,
    ge.usuario_id,
    p.nombres,
    p.apellido_paterno,
    p.apellido_materno,
    ge.fecha_inicio,
    ge.fecha_fin
FROM dbo.grupo_encargados ge
INNER JOIN dbo.grupos_formacion gf ON gf.grupo_id = ge.grupo_id
INNER JOIN dbo.usuarios u ON u.usuario_id = ge.usuario_id
INNER JOIN dbo.personas p ON p.persona_id = u.persona_id
WHERE
    ge.estado = 'ACTIVO'
    AND gf.estado = 'ACTIVO'
    AND (ge.fecha_fin IS NULL OR ge.fecha_fin >= SYSDATETIME());
GO

CREATE VIEW dbo.vw_persona_etapa_actual
AS
SELECT
    pe.persona_id,
    pe.etapa_id,
    ef.codigo AS etapa_codigo,
    ef.nombre AS etapa_nombre,
    pe.grupo_id,
    gf.nombre AS grupo_nombre,
    pe.fecha_inicio
FROM dbo.persona_etapas pe
INNER JOIN dbo.etapas_formacion ef ON ef.etapa_id = pe.etapa_id
LEFT JOIN dbo.grupos_formacion gf ON gf.grupo_id = pe.grupo_id
WHERE
    pe.estado = 'ACTIVO'
    AND pe.fecha_fin IS NULL;
GO

CREATE VIEW dbo.vw_asistencia_resumen
AS
SELECT
    a.asistencia_id,
    a.jornada_id,
    j.grupo_id,
    gf.nombre AS grupo_nombre,
    j.fecha,
    j.tipo_jornada,
    a.persona_id,
    CONCAT(p.nombres, N' ', p.apellido_paterno, N' ', ISNULL(p.apellido_materno, N'')) AS persona_nombre,
    a.fecha_hora_entrada,
    a.fecha_hora_salida,
    a.estado_asistencia,
    CASE
        WHEN a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
        THEN DATEDIFF(MINUTE, a.fecha_hora_entrada, a.fecha_hora_salida)
        ELSE NULL
    END AS minutos_permanencia,
    CASE
        WHEN j.tipo_jornada = 'OBLIGATORIA'
         AND a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
        THEN DATEDIFF(MINUTE, a.fecha_hora_entrada, a.fecha_hora_salida)
        ELSE 0
    END AS minutos_obligatorios,
    CASE
        WHEN j.tipo_jornada = 'VOLUNTARIA'
         AND a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
        THEN DATEDIFF(MINUTE, a.fecha_hora_entrada, a.fecha_hora_salida)
        ELSE 0
    END AS minutos_voluntarios,
    a.registrado_por_usuario_id
FROM dbo.asistencias a
INNER JOIN dbo.jornadas j ON j.jornada_id = a.jornada_id
INNER JOIN dbo.grupos_formacion gf ON gf.grupo_id = j.grupo_id
INNER JOIN dbo.personas p ON p.persona_id = a.persona_id;
GO

/* Defensa final: la obligación debe pertenecer a la programación vigente del
   grupo. Las jornadas extraordinarias siguen requiriendo una etapa habilitada. */
CREATE OR ALTER TRIGGER dbo.TR_jornadas_regla_obligatoria
ON dbo.jornadas
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted j
        INNER JOIN dbo.grupos_formacion g ON g.grupo_id = j.grupo_id
        INNER JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
        WHERE j.tipo_jornada = 'OBLIGATORIA'
          AND (
              NOT EXISTS (SELECT 1 FROM deleted d WHERE d.jornada_id = j.jornada_id)
              OR EXISTS (
                  SELECT 1 FROM deleted d
                  WHERE d.jornada_id = j.jornada_id
                    AND (
                        d.grupo_id <> j.grupo_id
                        OR d.fecha <> j.fecha
                        OR d.tipo_jornada <> j.tipo_jornada
                        OR d.origen <> j.origen
                        OR ISNULL(d.programacion_detalle_id, -1) <> ISNULL(j.programacion_detalle_id, -1)
                        OR ISNULL(d.fecha_hora_inicio_programada, '19000101') <>
                           ISNULL(j.fecha_hora_inicio_programada, '19000101')
                    )
              )
          )
          AND (
              e.codigo NOT IN ('POSTULANTE','ASPIRANTE_COMPANIA')
              OR j.fecha_hora_inicio_programada IS NULL
              OR (
                  j.origen = 'PROGRAMADA'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM dbo.programacion_detalles pd
                      INNER JOIN dbo.programaciones pr
                          ON pr.programacion_id = pd.programacion_id
                      WHERE pd.programacion_detalle_id = j.programacion_detalle_id
                        AND pr.grupo_id = j.grupo_id
                        AND pr.estado = 'ACTIVO'
                        AND pd.estado = 'ACTIVO'
                        AND pd.tipo_jornada = 'OBLIGATORIA'
                        AND pd.dia_semana = ((DATEDIFF(DAY, '19000101', j.fecha) % 7) + 1)
                        AND pd.hora_inicio = CONVERT(TIME(0), j.fecha_hora_inicio_programada)
                        AND j.fecha >= pr.fecha_inicio
                        AND (pr.fecha_fin IS NULL OR j.fecha <= pr.fecha_fin)
                  )
              )
          )
    )
        THROW 51001, 'Jornada obligatoria inválida para la etapa o la programación vigente.', 1;
END;
GO

/* ============================================================
   FIN
   ============================================================ */
