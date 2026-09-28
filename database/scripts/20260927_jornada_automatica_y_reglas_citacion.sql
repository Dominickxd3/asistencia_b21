/* ============================================================
   Alineación de reglas de negocio:
   1. Jornada automática (sin requerir apertura manual por parte del instructor).
   2. Horas obligatorias en citaciones reglamentarias (Miércoles 19:30, Viernes 19:30, Domingo 07:30).
   3. Horas voluntarias fuera de citaciones.
   4. No solapamiento voluntario durante citaciones obligatorias.
   ============================================================ */

-- 1. Desactivar programación voluntaria en domingos para etapas con citación obligatoria (Postulantes y Aspirantes)
UPDATE pd
SET pd.estado = 'INACTIVO'
FROM dbo.programacion_detalles pd
JOIN dbo.programaciones pr ON pr.programacion_id = pd.programacion_id
JOIN dbo.grupos_formacion g ON g.grupo_id = pr.grupo_id
JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
WHERE pd.dia_semana = 7
  AND pd.tipo_jornada = 'VOLUNTARIA'
  AND e.codigo IN ('POSTULANTE', 'ASPIRANTE_COMPANIA');

-- 2. Eliminar jornadas voluntarias dominicales sin asistencias registradas para dichas etapas
DELETE j
FROM dbo.jornadas j
JOIN dbo.grupos_formacion g ON g.grupo_id = j.grupo_id
JOIN dbo.etapas_formacion e ON e.etapa_id = g.etapa_id
WHERE j.tipo_jornada = 'VOLUNTARIA'
  AND ((DATEDIFF(DAY, '19000101', j.fecha) % 7) + 1) = 7
  AND e.codigo IN ('POSTULANTE', 'ASPIRANTE_COMPANIA')
  AND NOT EXISTS (SELECT 1 FROM dbo.asistencias a WHERE a.jornada_id = j.jornada_id);

-- 3. Apertura automática de todas las jornadas del día o pasadas que sigan en PROGRAMADA
UPDATE dbo.jornadas
SET estado = 'ABIERTA', fecha_apertura = ISNULL(fecha_apertura, GETDATE())
WHERE fecha <= CAST(GETDATE() AS date)
  AND estado = 'PROGRAMADA';
GO
