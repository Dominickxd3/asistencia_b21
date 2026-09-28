/*
  ESBAS registra participación voluntaria durante todo el día.
  No tiene una ventana programada de 08:00 a 18:30.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE pd
SET pd.hora_inicio = NULL,
    pd.hora_fin = NULL
FROM dbo.programacion_detalles pd
JOIN dbo.programaciones pr ON pr.programacion_id = pd.programacion_id
JOIN dbo.grupos_formacion g ON g.grupo_id = pr.grupo_id
JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
WHERE e.codigo = 'ASPIRANTE_ESBAS'
  AND pd.tipo_jornada = 'VOLUNTARIA';

UPDATE j
SET j.fecha_hora_inicio_programada = NULL,
    j.fecha_hora_fin_programada = NULL
FROM dbo.jornadas j
JOIN dbo.grupos_formacion g ON g.grupo_id = j.grupo_id
JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
WHERE e.codigo = 'ASPIRANTE_ESBAS'
  AND j.tipo_jornada = 'VOLUNTARIA';

COMMIT TRANSACTION;
GO
