/* Regla de negocio: asistencia obligatoria y voluntaria por jornada. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

/* ESBAS siempre es voluntaria, incluso para datos creados anteriormente. */
UPDATE j
SET j.tipo_jornada = 'VOLUNTARIA'
FROM dbo.jornadas j
JOIN dbo.grupos_formacion g ON g.grupo_id = j.grupo_id
JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
WHERE e.codigo = 'ASPIRANTE_ESBAS' AND j.tipo_jornada = 'OBLIGATORIA';

UPDATE pd
SET pd.tipo_jornada = 'VOLUNTARIA'
FROM dbo.programacion_detalles pd
JOIN dbo.programaciones pr ON pr.programacion_id = pd.programacion_id
JOIN dbo.grupos_formacion g ON g.grupo_id = pr.grupo_id
JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
WHERE e.codigo = 'ASPIRANTE_ESBAS' AND pd.tipo_jornada = 'OBLIGATORIA';

/* Una obligatoria fuera de miércoles/viernes/domingo se reclasifica como voluntaria. */
UPDATE j
SET j.tipo_jornada = 'VOLUNTARIA'
FROM dbo.jornadas j
WHERE j.tipo_jornada = 'OBLIGATORIA'
  AND ((DATEDIFF(DAY, '19000101', j.fecha) % 7) + 1) NOT IN (3,5,7);

/* Horas reglamentarias: miércoles/viernes 19:30; domingo 07:30. */
UPDATE j
SET fecha_hora_inicio_programada =
  DATEADD(MINUTE,
    CASE WHEN ((DATEDIFF(DAY, '19000101', j.fecha) % 7) + 1) = 7 THEN 450 ELSE 1170 END,
    CAST(j.fecha AS datetime2))
FROM dbo.jornadas j
JOIN dbo.grupos_formacion g ON g.grupo_id = j.grupo_id
JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
WHERE j.tipo_jornada = 'OBLIGATORIA'
  AND e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA');

UPDATE pd
SET hora_inicio = CASE WHEN pd.dia_semana = 7 THEN '07:30' ELSE '19:30' END,
    hora_fin = NULL
FROM dbo.programacion_detalles pd
JOIN dbo.programaciones pr ON pr.programacion_id = pd.programacion_id
JOIN dbo.grupos_formacion g ON g.grupo_id = pr.grupo_id
JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
WHERE pd.tipo_jornada = 'OBLIGATORIA'
  AND e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA')
  AND pd.dia_semana IN (3,5,7);

UPDATE dbo.jornadas
SET fecha_hora_fin_programada = NULL
WHERE tipo_jornada = 'OBLIGATORIA';

/* Todo grupo dispone de contexto voluntario independiente todos los días. */
;WITH dias AS (
  SELECT 1 AS dia UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
)
INSERT INTO dbo.programacion_detalles
  (programacion_id, dia_semana, hora_inicio, hora_fin, tipo_jornada, estado)
SELECT pr.programacion_id, d.dia, '08:00', '18:30', 'VOLUNTARIA', 'ACTIVO'
FROM dbo.programaciones pr
CROSS JOIN dias d
WHERE pr.estado = 'ACTIVO'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.programacion_detalles pd
    WHERE pd.programacion_id = pr.programacion_id
      AND pd.dia_semana = d.dia AND pd.tipo_jornada = 'VOLUNTARIA'
  );

/* Horario operativo uniforme para los contextos voluntarios generados. */
UPDATE dbo.programacion_detalles
SET hora_inicio = '08:00', hora_fin = '18:30'
WHERE tipo_jornada = 'VOLUNTARIA' AND estado = 'ACTIVO';

UPDATE j
SET fecha_hora_inicio_programada = DATEADD(MINUTE, 480, CAST(j.fecha AS datetime2)),
    fecha_hora_fin_programada = DATEADD(MINUTE, 1110, CAST(j.fecha AS datetime2))
FROM dbo.jornadas j
WHERE j.tipo_jornada = 'VOLUNTARIA' AND j.estado = 'PROGRAMADA'
  AND NOT EXISTS (SELECT 1 FROM dbo.asistencias a WHERE a.jornada_id = j.jornada_id);

COMMIT TRANSACTION;
GO

/* La BD impide que cualquier canal cree una obligación inválida. */
CREATE OR ALTER TRIGGER dbo.TR_jornadas_regla_obligatoria
ON dbo.jornadas
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
    FROM inserted j
    JOIN dbo.grupos_formacion g ON g.grupo_id = j.grupo_id
    JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
    WHERE j.tipo_jornada = 'OBLIGATORIA'
      AND (
        e.codigo NOT IN ('POSTULANTE','ASPIRANTE_COMPANIA')
        OR ((DATEDIFF(DAY, '19000101', j.fecha) % 7) + 1) NOT IN (3,5,7)
        OR CONVERT(time(0), j.fecha_hora_inicio_programada) <>
           CASE WHEN ((DATEDIFF(DAY, '19000101', j.fecha) % 7) + 1) = 7
                THEN CONVERT(time(0), '07:30') ELSE CONVERT(time(0), '19:30') END
      )
  )
    THROW 51001, 'Jornada obligatoria inválida para la etapa, fecha u hora reglamentaria.', 1;
END;
GO

CREATE OR ALTER VIEW dbo.vw_asistencia_resumen
AS
SELECT
    a.asistencia_id, a.jornada_id, j.grupo_id, gf.nombre AS grupo_nombre,
    j.fecha, j.tipo_jornada, a.persona_id,
    CONCAT(p.nombres, N' ', p.apellido_paterno, N' ', ISNULL(p.apellido_materno, N'')) AS persona_nombre,
    a.fecha_hora_entrada, a.fecha_hora_salida, a.estado_asistencia,
    CASE WHEN a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
         THEN DATEDIFF(MINUTE, a.fecha_hora_entrada, a.fecha_hora_salida) END AS minutos_permanencia,
    CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
         THEN DATEDIFF(MINUTE, a.fecha_hora_entrada, a.fecha_hora_salida) ELSE 0 END AS minutos_obligatorios,
    CASE WHEN j.tipo_jornada = 'VOLUNTARIA' AND a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
         THEN DATEDIFF(MINUTE, a.fecha_hora_entrada, a.fecha_hora_salida) ELSE 0 END AS minutos_voluntarios,
    a.registrado_por_usuario_id
FROM dbo.asistencias a
JOIN dbo.jornadas j ON j.jornada_id = a.jornada_id
JOIN dbo.grupos_formacion gf ON gf.grupo_id = j.grupo_id
JOIN dbo.personas p ON p.persona_id = a.persona_id;
GO
