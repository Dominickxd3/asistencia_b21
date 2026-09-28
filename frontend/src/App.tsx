import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { RequireAuth, RequirePermiso } from './core/auth/guards';
import { AttendancePage } from './features/attendance/AttendancePage';
import { AuditoriaPage } from './features/audit/AuditoriaPage';
import { LoginPage } from './features/auth/LoginPage';
import { GrupoDetallePage } from './features/formation/GrupoDetallePage';
import { GruposPage } from './features/formation/GruposPage';
import { HistorialPage } from './features/formation/HistorialPage';
import { PersonasPage } from './features/formation/PersonasPage';
import { MiGrupoPage } from './features/groups/MiGrupoPage';
import { HomePage } from './features/home/HomePage';
import { ReportesPage } from './features/reports/ReportesPage';
import { TrackingPage } from './features/tracking/TrackingPage';
import { ConfiguracionSedePage } from './features/admin/ConfiguracionSedePage';
import { MainLayout } from './layout/main-layout/MainLayout';
import { Construccion } from './shared/components/Construccion';
import { NotificacionesProvider } from './shared/components/Notificaciones';

const conPermiso = (permiso: string, pagina: ReactNode) => (
  <RequirePermiso permiso={permiso}>{pagina}</RequirePermiso>
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
            <Route path="/admin/usuarios" element={conPermiso('users.manage', <Construccion />)} />
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
