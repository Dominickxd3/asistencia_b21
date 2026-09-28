/* ============================================================
   Geocerca poligonal por sede
   ------------------------------------------------------------
   - sedes: dirección, tipo de geocerca, validación activa,
     tolerancia, precisión máxima y sede principal.
   - sede_geocerca_vertices: vértices ordenados del perímetro.
   - asistencia_ubicaciones: sede, jornada, hora del dispositivo,
     tolerancia aplicada y nuevos resultados de validación.
   - grupos_formacion.sede_id (opcional): sede donde se instruye
     el grupo; si es NULL se usa la sede principal de la compañía.

   NO inserta vértices: el perímetro real se dibuja desde
   Configuración → Sede y geocerca. Script idempotente.
   ============================================================ */

USE Rimac21Instruccion;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

/* ---------- 1. sedes ---------- */
IF COL_LENGTH('dbo.sedes', 'direccion') IS NULL
    ALTER TABLE dbo.sedes ADD direccion NVARCHAR(250) NULL;

IF COL_LENGTH('dbo.sedes', 'tipo_geocerca') IS NULL
    ALTER TABLE dbo.sedes ADD tipo_geocerca VARCHAR(20) NOT NULL
        CONSTRAINT DF_sedes_tipo_geocerca DEFAULT 'POLYGON';

IF COL_LENGTH('dbo.sedes', 'validacion_geografica_activa') IS NULL
    ALTER TABLE dbo.sedes ADD validacion_geografica_activa BIT NOT NULL
        CONSTRAINT DF_sedes_validacion_activa DEFAULT 1;

IF COL_LENGTH('dbo.sedes', 'tolerancia_metros') IS NULL
    ALTER TABLE dbo.sedes ADD tolerancia_metros DECIMAL(8,2) NOT NULL
        CONSTRAINT DF_sedes_tolerancia DEFAULT 0;

IF COL_LENGTH('dbo.sedes', 'precision_maxima_metros') IS NULL
    ALTER TABLE dbo.sedes ADD precision_maxima_metros DECIMAL(8,2) NOT NULL
        CONSTRAINT DF_sedes_precision_maxima DEFAULT 100;

IF COL_LENGTH('dbo.sedes', 'es_principal') IS NULL
    ALTER TABLE dbo.sedes ADD es_principal BIT NOT NULL
        CONSTRAINT DF_sedes_es_principal DEFAULT 0;

IF COL_LENGTH('dbo.sedes', 'fecha_actualizacion') IS NULL
    ALTER TABLE dbo.sedes ADD fecha_actualizacion DATETIME2(0) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_sedes_tipo_geocerca')
    ALTER TABLE dbo.sedes ADD CONSTRAINT CK_sedes_tipo_geocerca
        CHECK (tipo_geocerca IN ('POLYGON', 'CIRCLE'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_sedes_tolerancias')
    ALTER TABLE dbo.sedes ADD CONSTRAINT CK_sedes_tolerancias
        CHECK (tolerancia_metros >= 0 AND precision_maxima_metros > 0);
GO

/* ---------- 2. vértices del polígono ---------- */
IF OBJECT_ID('dbo.sede_geocerca_vertices', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sede_geocerca_vertices (
        vertice_id  INT IDENTITY(1,1) PRIMARY KEY,
        sede_id     INT NOT NULL,
        orden       INT NOT NULL,
        latitud     DECIMAL(10,7) NOT NULL,
        longitud    DECIMAL(10,7) NOT NULL,
        CONSTRAINT FK_vertices_sede FOREIGN KEY (sede_id) REFERENCES dbo.sedes(sede_id),
        CONSTRAINT UQ_vertices_sede_orden UNIQUE (sede_id, orden),
        CONSTRAINT CK_vertices_latitud CHECK (latitud BETWEEN -90 AND 90),
        CONSTRAINT CK_vertices_longitud CHECK (longitud BETWEEN -180 AND 180),
        CONSTRAINT CK_vertices_orden CHECK (orden >= 1)
    );
END;
GO

/* ---------- 3. evidencia geográfica de cada movimiento ---------- */
IF COL_LENGTH('dbo.asistencia_ubicaciones', 'sede_id') IS NULL
    ALTER TABLE dbo.asistencia_ubicaciones ADD sede_id INT NULL
        CONSTRAINT FK_ubicaciones_sede FOREIGN KEY REFERENCES dbo.sedes(sede_id);

IF COL_LENGTH('dbo.asistencia_ubicaciones', 'jornada_id') IS NULL
    ALTER TABLE dbo.asistencia_ubicaciones ADD jornada_id BIGINT NULL
        CONSTRAINT FK_ubicaciones_jornada FOREIGN KEY REFERENCES dbo.jornadas(jornada_id);

IF COL_LENGTH('dbo.asistencia_ubicaciones', 'fecha_captura_dispositivo') IS NULL
    ALTER TABLE dbo.asistencia_ubicaciones ADD fecha_captura_dispositivo DATETIME2(0) NULL;

IF COL_LENGTH('dbo.asistencia_ubicaciones', 'tolerancia_aplicada_metros') IS NULL
    ALTER TABLE dbo.asistencia_ubicaciones ADD tolerancia_aplicada_metros DECIMAL(8,2) NULL;
GO

-- Nuevos resultados: PRECISION_INSUFICIENTE y SIN_GEOCERCA (sede sin polígono o validación desactivada)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ubicaciones_estado')
    ALTER TABLE dbo.asistencia_ubicaciones DROP CONSTRAINT CK_ubicaciones_estado;
GO
ALTER TABLE dbo.asistencia_ubicaciones ADD CONSTRAINT CK_ubicaciones_estado
    CHECK (estado_geografico IN
      ('DENTRO_ZONA', 'FUERA_ZONA', 'PRECISION_INSUFICIENTE', 'NO_DISPONIBLE', 'SIN_GEOCERCA'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ubicaciones_estado_fecha')
    CREATE INDEX IX_ubicaciones_estado_fecha
        ON dbo.asistencia_ubicaciones (estado_geografico, fecha_captura) INCLUDE (sede_id, jornada_id);
GO

/* ---------- 4. sede opcional por grupo ---------- */
IF COL_LENGTH('dbo.grupos_formacion', 'sede_id') IS NULL
    ALTER TABLE dbo.grupos_formacion ADD sede_id INT NULL
        CONSTRAINT FK_grupos_sede FOREIGN KEY REFERENCES dbo.sedes(sede_id);
GO

/* ---------- 5. sede institucional Rímac 21 ---------- */
DECLARE @compania_id INT = (SELECT TOP 1 compania_id FROM dbo.companias WHERE codigo = 'RIMAC21');
DECLARE @sede_id INT = (SELECT TOP 1 sede_id FROM dbo.sedes WHERE compania_id = @compania_id ORDER BY sede_id);

IF @sede_id IS NULL
BEGIN
    -- Centro de referencia publicado para el cuartel. No define el perímetro:
    -- los vértices reales se dibujan y guardan desde la interfaz administrativa.
    INSERT INTO dbo.sedes (compania_id, nombre, direccion, latitud, longitud,
                           tipo_geocerca, politica_fuera_zona,
                           estado, es_principal, validacion_geografica_activa)
    VALUES (@compania_id, N'Rímac 21', N'Jr. Trujillo 836, Rímac, Lima', -12.036180, -77.028260,
            'POLYGON', 'BLOQUEAR',
            'ACTIVO', 1, 1);
END
ELSE
BEGIN
    -- Solo completa el centro de referencia si aún no existe. Nunca crea vértices ficticios.
    UPDATE dbo.sedes
    SET nombre = N'Rímac 21',
        direccion = N'Jr. Trujillo 836, Rímac, Lima',
        latitud = COALESCE(latitud, -12.036180),
        longitud = COALESCE(longitud, -77.028260),
        tipo_geocerca = 'POLYGON',
        tolerancia_metros = 0,
        politica_fuera_zona = 'BLOQUEAR',
        es_principal = 1,
        fecha_actualizacion = SYSDATETIME()
    WHERE sede_id = @sede_id;
END;

COMMIT TRANSACTION;
GO

SELECT sede_id, nombre, direccion, tipo_geocerca, validacion_geografica_activa,
       tolerancia_metros, precision_maxima_metros, politica_fuera_zona, es_principal,
       (SELECT COUNT(*) FROM dbo.sede_geocerca_vertices v WHERE v.sede_id = s.sede_id) AS vertices
FROM dbo.sedes s;
GO
