/* ============================================================
   Corrección de horarios de jornadas desplazados +5 h
   ------------------------------------------------------------
   Las jornadas creadas con repository.save() (seed de formación y
   POST /api/sessions antes de la corrección) guardaron la hora
   programada en UTC: 19:00 quedó como 00:00 del día siguiente.

   Este script solo toca jornadas cuya hora de inicio cae en un día
   distinto a su fecha (el síntoma inequívoco del desfase) y resta
   5 horas (Lima, UTC-5) a inicio y fin.

   Revise el SELECT antes de ejecutar el UPDATE.
   ============================================================ */

USE Rimac21Instruccion;
GO

-- 1) Vista previa
SELECT jornada_id, fecha,
       fecha_hora_inicio_programada AS inicio_actual,
       DATEADD(hour, -5, fecha_hora_inicio_programada) AS inicio_corregido,
       fecha_hora_fin_programada AS fin_actual,
       DATEADD(hour, -5, fecha_hora_fin_programada) AS fin_corregido
FROM jornadas
WHERE fecha_hora_inicio_programada IS NOT NULL
  AND CAST(fecha_hora_inicio_programada AS date) <> fecha;
GO

-- 2) Corrección
BEGIN TRANSACTION;

UPDATE jornadas
SET fecha_hora_inicio_programada = DATEADD(hour, -5, fecha_hora_inicio_programada),
    fecha_hora_fin_programada = DATEADD(hour, -5, fecha_hora_fin_programada)
WHERE fecha_hora_inicio_programada IS NOT NULL
  AND CAST(fecha_hora_inicio_programada AS date) <> fecha;

SELECT @@ROWCOUNT AS jornadas_corregidas;

COMMIT TRANSACTION;
GO
