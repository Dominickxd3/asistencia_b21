/* Pruebas E2E completas de Fase 2 (idempotentes: resetean el escenario) */
const BASE = 'http://localhost:3000/api';

async function req(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function resetEscenario() {
  const sql = require('mssql/msnodesqlv8');
  const pool = await sql.connect({
    server: 'localhost', port: 1433, database: 'Rimac21Instruccion',
    driver: 'msnodesqlv8',
    options: { trustedConnection: true, trustServerCertificate: true, useUTC: false },
  });
  await pool.request().query(`
    DELETE FROM justificaciones;
    DELETE FROM asistencia_ubicaciones;
    DELETE FROM asistencias;
    UPDATE jornadas SET estado = 'ABIERTA', fecha_cierre = NULL, cerrada_por_usuario_id = NULL
    WHERE jornada_id = 1;
  `);
  await pool.close();
}

const geo = { latitud: -12.0258, longitud: -77.0401, precisionMetros: 12 };
let fallas = 0;
function check(nombre, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${nombre} ${extra}`);
  if (!cond) fallas++;
}

(async () => {
  await resetEscenario();
  console.log('escenario reseteado\n');

  const TE = (await req('POST', '/auth/login', null, { username: 'encargado.postulantes', password: 'R21#Enc2026' })).data.accessToken;
  const TJ = (await req('POST', '/auth/login', null, { username: 'jefe.instruccion', password: 'R21#Jefe2026' })).data.accessToken;
  const TA = (await req('POST', '/auth/login', null, { username: 'admin', password: 'R21#Admin2026' })).data.accessToken;
  check('logins (encargado/jefe/admin)', !!TE && !!TJ && !!TA);

  // Escopo: encargado solo ve su grupo
  const { data: jornadas } = await req('GET', '/sessions?fecha=2026-09-17', TE);
  check('encargado solo ve su jornada', jornadas.length === 1, JSON.stringify(jornadas.map((j) => j.grupo)));

  // 1) Entrada 1-clic con geo (Paredes=7)
  const e1 = await req('POST', '/attendance/entry', TE, { jornadaId: 1, personaId: 7, geo });
  check('entry 1-clic + geo', e1.status === 201 && e1.data.estadoAsistencia === 'PRESENTE');
  const a1 = Number(e1.data.id);

  // 2) Salida anticipada con motivo
  const e2 = await req('POST', '/attendance/early-exit', TE, { asistenciaId: a1, motivo: 'Emergencia familiar', geo });
  check('early-exit', e2.status === 201 && e2.data.estadoAsistencia === 'SALIDA_ANTICIPADA');

  // 3) Duplicar sobre la misma persona → 409
  const e3 = await req('POST', '/attendance/entry', TE, { jornadaId: 1, personaId: 7 });
  check('doble registro → 409', e3.status === 409, e3.data.message);

  // 4) Entrada manual con motivo (Salazar=6)
  const e4 = await req('POST', '/attendance/manual-entry', TE, { jornadaId: 1, personaId: 6, horaEntrada: '18:45', motivo: 'Llegó antes, registro retroactivo', geo });
  check('manual-entry', e4.status === 201 && e4.data.tipoRegistro === 'MANUAL', `entrada=${e4.data.fechaHoraEntrada}`);
  const a2 = Number(e4.data.id);

  // 5) Falta justificada (Tello=9)
  const e5 = await req('POST', '/attendance/justified-absence', TE, { jornadaId: 1, personaId: 9, motivo: 'Cita médica' });
  check('justified-absence', e5.status === 201 && e5.data.estadoAsistencia === 'FALTA_JUSTIFICADA');
  const a3 = Number(e5.data.id);

  // 6) Observación
  const e6 = await req('PATCH', `/attendance/${a3}/observation`, TE, { observacion: 'Presentó memorando' });
  check('observation', e6.status === 200);

  // 7) Encargado NO puede ajustar horas (sin attendance.update)
  const e7 = await req('PATCH', `/attendance/${a2}/manual-adjust`, TE, { horaSalida: '20:15', motivo: 'x' });
  check('encargado ajustar → 403', e7.status === 403);

  // 8) Jefe ajusta hora de salida (con y sin motivo validado)
  const e8a = await req('PATCH', `/attendance/${a2}/manual-adjust`, TJ, { horaSalida: '20:15' });
  check('ajuste sin motivo → 400', e8a.status === 400);
  const e8b = await req('PATCH', `/attendance/${a2}/manual-adjust`, TJ, { horaSalida: '20:15', motivo: 'Se olvidó marcar' });
  check('ajuste por jefe', e8b.status === 200, `salida=${e8b.data.fechaHoraSalida}`);

  // 9) Salida normal (Fuentes=8): entrada + salida
  await req('POST', '/attendance/entry', TE, { jornadaId: 1, personaId: 8 });
  const board = (await req('GET', '/attendance/board/1', TE)).data;
  const f = board.find((b) => b.personaId === 8);
  const e9 = await req('POST', '/attendance/exit', TE, { asistenciaId: Number(f.asistenciaId), geo });
  check('exit', e9.status === 201 && e9.data.estadoAsistencia === 'FINALIZADO');

  // 10) Encargado no puede anular; admin sí (con motivo)
  const e10a = await req('POST', `/attendance/${a2}/annul`, TE, { motivo: 'x' });
  check('encargado annul → 403', e10a.status === 403);
  const e10b = await req('POST', `/attendance/${a2}/annul`, TA, { motivo: 'Registro duplicado por error' });
  check('annul por admin', e10b.status === 201 && e10b.data.estadoAsistencia === 'ANULADO');

  // 11) Al anular, la persona (6) puede registrarse de nuevo
  const e11 = await req('POST', '/attendance/entry', TE, { jornadaId: 1, personaId: 6 });
  check('re-registro tras anulación', e11.status === 201);

  // 12) Cierre sin conversión → 422 con nombres de pendientes
  const e12 = await req('POST', '/attendance/sessions/1/close', TE, {});
  check('close sin convertir → 422', e12.status === 422 && Array.isArray(e12.data.pendientes),
    JSON.stringify(e12.data.pendientes?.map((p) => p.nombreCompleto)));

  // 13) Cierre convirtiendo pendientes
  const e13 = await req('POST', '/attendance/sessions/1/close', TE, { convertirPendientes: true });
  check('close con conversión', e13.status === 201, JSON.stringify(e13.data));

  // 14) Registrar tras cierre → 422
  const e14 = await req('POST', '/attendance/entry', TE, { jornadaId: 1, personaId: 10 });
  check('entry tras cierre → 422', e14.status === 422, e14.data.message);

  // 15) Capturas geográficas en asistencia_ubicaciones
  const sql = require('mssql/msnodesqlv8');
  const pool = await sql.connect({ server: 'localhost', port: 1433, database: 'Rimac21Instruccion', driver: 'msnodesqlv8', options: { trustedConnection: true, trustServerCertificate: true, useUTC: false } });
  const geoRows = await pool.request().query(`SELECT COUNT(*) AS n, SUM(CASE WHEN estado_geografico='DENTRO_ZONA' THEN 1 ELSE 0 END) AS dentro FROM asistencia_ubicaciones`);
  check('geo capturada', geoRows.recordset[0].n >= 4, `registros=${geoRows.recordset[0].n} dentro=${geoRows.recordset[0].dentro}`);

  // 16) Auditoría registró las acciones
  const aud = await pool.request().query(`SELECT COUNT(DISTINCT accion) AS acciones FROM auditoria WHERE modulo IN ('attendance','sessions')`);
  check('auditoría diversa', aud.recordset[0].acciones >= 5, `acciones=${aud.recordset[0].acciones}`);
  await pool.close();

  // 17) Dashboard final
  const dash = (await req('GET', '/dashboard/today', TJ)).data;
  check('dashboard final', dash.jornadas[0]?.estado === 'CERRADA', JSON.stringify(dash.resumen));

  console.log(fallas === 0 ? '\nTODOS PASS' : `\n${fallas} FALLAS`);
  process.exit(fallas === 0 ? 0 : 1);
})();
