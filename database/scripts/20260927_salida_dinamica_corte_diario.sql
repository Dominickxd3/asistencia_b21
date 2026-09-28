/*
  Jornada obligatoria:
  - hora de entrada reglamentaria;
  - salida libre, registrada por cada persona;
  - corte máximo al finalizar el día (23:59:59).
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE pd
SET pd.hora_fin = NULL
FROM dbo.programacion_detalles pd
WHERE pd.tipo_jornada = 'OBLIGATORIA';

UPDATE j
SET j.fecha_hora_fin_programada = NULL
FROM dbo.jornadas j
WHERE j.tipo_jornada = 'OBLIGATORIA';

/* Regulariza entradas abiertas pertenecientes a días ya terminados. */
UPDATE a
SET a.fecha_hora_salida = DATEADD(SECOND, -1, DATEADD(DAY, 1, CAST(j.fecha AS datetime2))),
    a.estado_asistencia = 'FINALIZADO',
    a.observacion = ISNULL(a.observacion, 'Salida automática por cierre del día'),
    a.fecha_actualizacion = GETDATE()
FROM dbo.asistencias a
JOIN dbo.jornadas j ON j.jornada_id = a.jornada_id
WHERE a.estado_asistencia = 'PRESENTE'
  AND j.fecha < CAST(GETDATE() AS date)
  AND a.fecha_hora_entrada < DATEADD(DAY, 1, CAST(j.fecha AS datetime2));

COMMIT TRANSACTION;
GO
