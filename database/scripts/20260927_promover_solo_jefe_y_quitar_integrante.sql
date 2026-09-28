/* ============================================================
   1) Promover de etapa: solo la Jefatura de Instrucción.
      Quita formation.promote de todo rol distinto de JEFE_INSTRUCCION.

   2) Corrección de datos: personas que se «quitaron» de un grupo (error de
      registro) pero conservaban la etapa ligada a ese grupo como ACTIVA.
      - Si esa etapa nació al ingresar al grupo («Ingreso al grupo…»): se cierra
        (FINALIZADO) → quedan SIN etapa.
      - Si ya la tenían (promoción, transferencia): se cierra ese tramo y siguen
        en la etapa sin grupo.
      En ambos casos queda constancia en persona_etapas.observacion.
      No toca salidas del sistema (cierre/cancelación de grupo, transferencia,
      promoción ni desactivación).

   Idempotente.
   ============================================================ */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

/* ---------- 1. Permiso de promoción ---------- */
DELETE rp
FROM dbo.rol_permisos rp
JOIN dbo.permisos p ON p.permiso_id = rp.permiso_id
JOIN dbo.roles r ON r.rol_id = rp.rol_id
WHERE p.codigo = 'formation.promote' AND r.codigo <> 'JEFE_INSTRUCCION';

INSERT INTO dbo.rol_permisos (rol_id, permiso_id)
SELECT r.rol_id, p.permiso_id
FROM dbo.roles r CROSS JOIN dbo.permisos p
WHERE r.codigo = 'JEFE_INSTRUCCION' AND p.codigo = 'formation.promote'
  AND NOT EXISTS (SELECT 1 FROM dbo.rol_permisos x WHERE x.rol_id = r.rol_id AND x.permiso_id = p.permiso_id);

/* ---------- 2. Etapas colgadas de un grupo del que se quitó a la persona ---------- */
DECLARE @casos TABLE (
  persona_etapa_id INT, persona_id INT, etapa_id INT, grupo NVARCHAR(150),
  motivo NVARCHAR(300), fecha_salida DATE, previas INT
);

INSERT INTO @casos
SELECT pe.persona_etapa_id, pe.persona_id, pe.etapa_id, g.nombre, gi.motivo_salida, gi.fecha_fin,
       CASE WHEN pe.observacion LIKE 'Ingreso al grupo%' THEN 0 ELSE 1 END
FROM dbo.persona_etapas pe
JOIN dbo.grupos_formacion g ON g.grupo_id = pe.grupo_id
CROSS APPLY (SELECT TOP 1 gi.estado, gi.motivo_salida, gi.fecha_fin
             FROM dbo.grupo_integrantes gi
             WHERE gi.persona_id = pe.persona_id AND gi.grupo_id = pe.grupo_id
             ORDER BY gi.grupo_integrante_id DESC) gi
WHERE pe.estado = 'ACTIVO'
  AND gi.estado = 'FINALIZADO'
  AND NOT EXISTS (SELECT 1 FROM dbo.grupo_integrantes a WHERE a.persona_id = pe.persona_id AND a.estado = 'ACTIVO')
  AND ISNULL(gi.motivo_salida, '') NOT LIKE 'Cierre del grupo%'
  AND ISNULL(gi.motivo_salida, '') NOT LIKE 'Grupo cancelado%'
  AND ISNULL(gi.motivo_salida, '') NOT LIKE 'Transferencia%'
  AND ISNULL(gi.motivo_salida, '') NOT LIKE 'Promoción%'
  AND ISNULL(gi.motivo_salida, '') NOT LIKE 'Persona desactivada%';

UPDATE pe
SET estado = 'FINALIZADO',
    fecha_fin = ISNULL(c.fecha_salida, CAST(GETDATE() AS date)),
    observacion = LEFT('Quitado del grupo ' + c.grupo + ': ' + ISNULL(c.motivo, ''), 500)
FROM dbo.persona_etapas pe
JOIN @casos c ON c.persona_etapa_id = pe.persona_etapa_id;

INSERT INTO dbo.persona_etapas
  (persona_id, etapa_id, grupo_id, fecha_inicio, fecha_fin, estado, observacion, registrado_por_usuario_id)
SELECT persona_id, etapa_id, NULL, ISNULL(fecha_salida, CAST(GETDATE() AS date)), NULL, 'ACTIVO',
       LEFT('Sin grupo tras salir de ' + grupo, 500), NULL
FROM @casos WHERE previas > 0;

SELECT c.persona_id, c.grupo, c.motivo,
       CASE WHEN c.previas > 0 THEN 'Conserva su etapa, sin grupo' ELSE 'Queda sin etapa' END AS resultado
FROM @casos c;

SELECT r.codigo AS rol_con_formation_promote
FROM dbo.rol_permisos rp
JOIN dbo.permisos p ON p.permiso_id = rp.permiso_id
JOIN dbo.roles r ON r.rol_id = rp.rol_id
WHERE p.codigo = 'formation.promote';

COMMIT TRANSACTION;
