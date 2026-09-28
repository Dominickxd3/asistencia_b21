const BASE = 'http://localhost:3000/api';

async function request(method, path, token, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function login(username, password) {
  const result = await request('POST', '/auth/login', null, { username, password });
  if (result.status !== 200 || !result.data?.accessToken) {
    throw new Error(`No se pudo iniciar sesión como ${username}: HTTP ${result.status}`);
  }
  return result.data.accessToken;
}

let failures = 0;
function check(description, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${description}${detail ? ` · ${detail}` : ''}`);
  if (!condition) failures += 1;
}

(async () => {
  const [managerToken, adminToken] = await Promise.all([
    login('encargado.postulantes', 'R21#Enc2026'),
    login('admin', 'R21#Admin2026'),
  ]);

  const [profile, managerSessions, managerDashboard, adminSessions, adminDashboard] = await Promise.all([
    request('GET', '/auth/me', managerToken),
    request('GET', '/sessions?fecha=2026-09-27', managerToken),
    request('GET', '/dashboard/today?fecha=2026-09-27', managerToken),
    request('GET', '/sessions?fecha=2026-09-27', adminToken),
    request('GET', '/dashboard/today?fecha=2026-09-27', adminToken),
  ]);

  const expectedPermissions = [
    'inicio.view',
    'attendance.view',
    'attendance.view_assigned_group',
    'attendance.register',
  ];
  const actualPermissions = [...(profile.data?.permisos ?? [])].sort();
  check(
    'el encargado tiene únicamente permisos operativos de su grupo',
    JSON.stringify(actualPermissions) === JSON.stringify(expectedPermissions.sort()),
    actualPermissions.join(', '),
  );

  check(
    'la lista de jornadas del encargado contiene solo Postulantes',
    managerSessions.status === 200 &&
      managerSessions.data.length > 0 &&
      managerSessions.data.every((session) => Number(session.grupoId) === 1),
    JSON.stringify(managerSessions.data?.map((session) => session.grupo)),
  );

  const dashboardGroups = managerDashboard.data?.grupos ?? [];
  const dashboardSessions = managerDashboard.data?.jornadas ?? [];
  const dashboardActivity = managerDashboard.data?.actividad ?? [];
  check(
    'el panel del encargado contiene solo su grupo',
    managerDashboard.status === 200 &&
      dashboardGroups.length === 1 &&
      dashboardGroups.every((group) => Number(group.grupoId) === 1) &&
      dashboardSessions.every((session) => Number(session.grupoId) === 1) &&
      dashboardActivity.every((event) => event.grupo === 'Postulantes 2026-II'),
    JSON.stringify(dashboardGroups.map((group) => group.nombre)),
  );

  const foreignSession = adminSessions.data.find((session) => Number(session.grupoId) !== 1);
  check('el administrador conserva jornadas de varios grupos', adminSessions.data.some((s) => Number(s.grupoId) !== 1));
  check('el administrador conserva el panel global', adminDashboard.data?.grupos?.length > 1);

  const deniedRequests = await Promise.all([
    request('GET', '/groups', managerToken),
    request('GET', '/groups/2/members', managerToken),
    request('GET', '/attendance/qr/group/2', managerToken),
    foreignSession
      ? request('GET', `/attendance/board/${foreignSession.id}`, managerToken)
      : Promise.resolve({ status: 403 }),
    request('GET', '/reports/recent', managerToken),
    request('GET', '/tracking?grupoId=2&desde=2026-09-01&hasta=2026-09-30', managerToken),
  ]);
  check(
    'las rutas de jefatura y los recursos de otros grupos responden 403',
    deniedRequests.every((result) => result.status === 403),
    deniedRequests.map((result) => result.status).join(', '),
  );

  if (failures > 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
