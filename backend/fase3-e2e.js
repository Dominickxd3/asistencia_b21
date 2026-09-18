/* Pruebas E2E Fase 3: tracking, formación, reportes PDF, auditoría */
const BASE = 'http://localhost:3000/api';
let fallas = 0;

async function req(m, p, t, b) {
  const r = await fetch(`${BASE}${p}`, {
    method: m,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  const buf = await r.arrayBuffer();
  let data = null;
  try { data = JSON.parse(Buffer.from(buf).toString()); } catch { data = buf; }
  return { status: r.status, data, raw: Buffer.from(buf), contentType: r.headers.get('content-type') };
}

function check(nombre, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${nombre} ${extra}`);
  if (!cond) fallas++;
}

(async () => {
  // Escenario idempotente: persona 5 vuelve a POSTULANTE/grupo 1
  const sql = require('mssql/msnodesqlv8');
  const pool = await sql.connect({ server: 'localhost', port: 1433, database: 'Rimac21Instruccion', driver: 'msnodesqlv8', options: { trustedConnection: true, trustServerCertificate: true, useUTC: false } });
  await pool.request().query(`
    UPDATE persona_etapas SET estado='FINALIZADO', fecha_fin='2026-09-17' WHERE persona_id=5 AND estado='ACTIVO';
    UPDATE grupo_integrantes SET estado='FINALIZADO', fecha_fin='2026-09-17', motivo_salida='Rollback pruebas' WHERE persona_id=5 AND estado='ACTIVO';
    DELETE FROM persona_etapas WHERE persona_id=5 AND estado='FINALIZADO' AND fecha_inicio='2026-09-18';
    DELETE FROM grupo_integrantes WHERE persona_id=5 AND estado='FINALIZADO' AND fecha_inicio='2026-09-18';
    IF NOT EXISTS (SELECT 1 FROM persona_etapas WHERE persona_id=5 AND estado='ACTIVO')
      INSERT INTO persona_etapas (persona_id, etapa_id, grupo_id, fecha_inicio, estado) VALUES (5, 1, 1, '2026-08-03', 'ACTIVO');
    IF NOT EXISTS (SELECT 1 FROM grupo_integrantes WHERE grupo_id=1 AND persona_id=5 AND estado='ACTIVO')
      INSERT INTO grupo_integrantes (grupo_id, persona_id, fecha_inicio, estado) VALUES (1, 5, '2026-08-03', 'ACTIVO');
  `);
  await pool.close();

  const TJ = (await req('POST', '/auth/login', null, { username: 'jefe.instruccion', password: 'R21#Jefe2026' })).data.accessToken;
  const TE = (await req('POST', '/auth/login', null, { username: 'encargado.postulantes', password: 'R21#Enc2026' })).data.accessToken;

  // --- Tracking ---
  const tr = await req('GET', '/tracking?grupoId=1&orden=faltas_injustificadas', TJ);
  check('tracking jefe', tr.status === 200 && Array.isArray(tr.data.integrantes), `integrantes=${tr.data.integrantes?.length}`);
  const trNeg = await req('GET', '/tracking?grupoId=1', TE);
  check('tracking encargado → 403', trNeg.status === 403);
  const trOrd = await req('GET', '/tracking?grupoId=1&orden=horas', TJ);
  check('tracking orden horas', trOrd.status === 200);

  // --- Formación: promover persona 5 (Escobar) POSTULANTE → ASPIRANTE_COMPANIA ---
  const pr = await req('POST', '/formation/promote', TJ, {
    personaId: 5, etapaDestino: 'ASPIRANTE_COMPANIA', grupoDestinoId: 2, observacion: 'Aprobado instrucción básica',
  });
  check('promover', pr.status === 201, JSON.stringify(pr.data));
  const prRetro = await req('POST', '/formation/promote', TJ, { personaId: 5, etapaDestino: 'POSTULANTE' });
  check('promover retroceso → 409', prRetro.status === 409, prRetro.data?.message);
  const hist = await req('GET', '/formation/personas/5/historial', TJ);
  check('historial', hist.status === 200 && hist.data.length >= 2, JSON.stringify(hist.data.map(h => `${h.etapa}(${h.estado})`)));

  // --- Reportes PDF ---
  const rp = await req('POST', '/reports/generate', TJ, {
    tipo: 'ESTADO_GENERAL', desde: '2026-09-01', hasta: '2026-09-30', grupoIds: [1, 2, 3],
  });
  check('reporte estado general PDF', rp.status === 201 && rp.contentType.includes('pdf') && rp.raw.length > 2000, `bytes=${rp.raw.length}`);

  const rpInd = await req('POST', '/reports/generate', TJ, {
    tipo: 'DETALLE_INDIVIDUAL', desde: '2026-09-01', hasta: '2026-09-30', grupoIds: [1], personaId: 7,
  });
  check('reporte individual PDF', rpInd.status === 201 && rpInd.raw.length > 1000, `bytes=${rpInd.raw.length}`);

  const rpNeg = await req('POST', '/reports/generate', TE, { tipo: 'ESTADO_GENERAL', desde: '2026-09-01', hasta: '2026-09-30', grupoIds: [1] });
  check('reporte encargado → 403', rpNeg.status === 403);

  // --- Auditoría ---
  const au = await req('GET', '/audit?pagina=1', TJ);
  check('auditoría lista', au.status === 200 && Array.isArray(au.data.items), `total=${au.data.total}`);
  const auNeg = await req('GET', '/audit', TE);
  check('auditoría encargado → 403', auNeg.status === 403);
  const auF = await req('GET', '/audit?accion=REPORT_GENERATED', TJ);
  check('auditoría filtro REPORT_GENERATED', auF.status === 200 && auF.data.items.length > 0);

  console.log(fallas === 0 ? '\nTODOS PASS' : `\n${fallas} FALLAS`);
  process.exit(fallas === 0 ? 0 : 1);
})();
