import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { RequireAuth, RequirePermiso } from './core/auth/guards';
import { LoginPage } from './features/auth/LoginPage';
import { MainLayout } from './layout/main-layout/MainLayout';
import { NotificacionesProvider } from './shared/components/Notificaciones';

// Cada página se descarga solo cuando se abre (el login y el layout van en el paquete inicial)
const AttendancePage = lazy(() =>
  import('./features/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })),
);
const AuditoriaPage = lazy(() =>
  import('./features/audit/AuditoriaPage').then((m) => ({ default: m.AuditoriaPage })),
);
const GrupoDetallePage = lazy(() =>
  import('./features/formation/GrupoDetallePage').then((m) => ({ default: m.GrupoDetallePage })),
);
const GruposPage = lazy(() =>
  import('./features/formation/GruposPage').then((m) => ({ default: m.GruposPage })),
);
const HistorialPage = lazy(() =>
  import('./features/formation/HistorialPage').then((m) => ({ default: m.HistorialPage })),
);
const PersonasPage = lazy(() =>
  import('./features/formation/PersonasPage').then((m) => ({ default: m.PersonasPage })),
);
const MiGrupoPage = lazy(() =>
  import('./features/groups/MiGrupoPage').then((m) => ({ default: m.MiGrupoPage })),
);
const HomePage = lazy(() =>
  import('./features/home/HomePage').then((m) => ({ default: m.HomePage })),
);
const ReportesPage = lazy(() =>
  import('./features/reports/ReportesPage').then((m) => ({ default: m.ReportesPage })),
);
const TrackingPage = lazy(() =>
  import('./features/tracking/TrackingPage').then((m) => ({ default: m.TrackingPage })),
);
const ConfiguracionSedePage = lazy(() =>
  import('./features/admin/ConfiguracionSedePage').then((m) => ({
    default: m.ConfiguracionSedePage,
  })),
);
const UsuariosPage = lazy(() =>
  import('./features/admin/UsuariosPage').then((m) => ({ default: m.UsuariosPage })),
);

const conPermiso = (permiso: string, pagina: ReactNode) => (
  <RequirePermiso permiso={permiso}>
    <Suspense fallback={<div className="p-4 text-center text-muted">Cargando…</div>}>
      {pagina}
    </Suspense>
  </RequirePermiso>
);

export function App() {
  return (
    <NotificacionesProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <MainLayout />
              </RequireAuth>
            }
          >
            <Route path="/inicio" element={conPermiso('inicio.view', <HomePage />)} />
            <Route path="/asistencia" element={conPermiso('attendance.view', <AttendancePage />)} />
            <Route
              path="/mi-grupo"
              element={conPermiso('attendance.view_assigned_group', <MiGrupoPage />)}
            />
            <Route path="/seguimiento" element={conPermiso('tracking.view', <TrackingPage />)} />
            <Route
              path="/formacion/grupos"
              element={conPermiso('formation.view', <GruposPage />)}
            />
            <Route
              path="/formacion/grupos/:id"
              element={conPermiso('formation.view', <GrupoDetallePage />)}
            />
            <Route
              path="/formacion/personas"
              element={conPermiso('formation.view', <PersonasPage />)}
            />
            <Route
              path="/formacion/historial"
              element={conPermiso('formation.view', <HistorialPage />)}
            />
            <Route path="/reportes" element={conPermiso('reports.view', <ReportesPage />)} />
            <Route path="/auditoria" element={conPermiso('audit.view_full', <AuditoriaPage />)} />
            <Route path="/admin/usuarios" element={conPermiso('users.manage', <UsuariosPage />)} />
            <Route
              path="/admin/config"
              element={conPermiso('settings.manage', <ConfiguracionSedePage />)}
            />
            <Route path="/" element={<Navigate to="/inicio" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </BrowserRouter>
    </NotificacionesProvider>
  );
}
