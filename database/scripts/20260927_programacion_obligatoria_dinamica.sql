SET XACT_ABORT ON;
GO

/* La programación activa del grupo es la fuente de verdad. Los días y horas
   obligatorios pueden cambiar sin modificar código ni recrear el grupo. */
+CREATE OR ALTER TRIGGER dbo.TR_jornadas_regla_obligatoria
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
