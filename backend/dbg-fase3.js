async function req(m, p, t, b) {
  const r = await fetch('http://localhost:3000/api' + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  const txt = await r.text();
  return { status: r.status, txt: txt.slice(0, 400), ct: r.headers.get('content-type'), len: txt.length };
}
(async () => {
  const login = await req('POST', '/auth/login', null, { username: 'jefe.instruccion', password: 'R21#Jefe2026' });
  const T = JSON.parse(login.txt).accessToken;
  const rp = await req('POST', '/reports/generate', T, { tipo: 'ESTADO_GENERAL', desde: '2026-09-01', hasta: '2026-09-30', grupoIds: [1, 2, 3] });
  console.log('REPORTE:', rp.status, rp.ct, rp.len, rp.txt.slice(0, 200));
})();
