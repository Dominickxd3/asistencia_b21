import { Routes } from '@angular/router';
import { authGuard, permisoGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { LoginComponent } from './features/auth/login.component';
import { HomeComponent } from './features/home/home.component';
import { AttendancePageComponent } from './features/attendance/attendance.page';
import { TrackingPageComponent } from './features/tracking/tracking.page';
import { PersonasPageComponent } from './features/formation/personas.page';
import { GruposPageComponent } from './features/formation/grupos.page';
import { HistorialPageComponent } from './features/formation/historial.page';
import { ReportesPageComponent } from './features/reports/reportes.page';
import { AuditoriaPageComponent } from './features/audit/auditoria.page';
import { MiGrupoComponent } from './features/groups/mi-grupo.component';
import { ConstruccionComponent } from './shared/components/construccion.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'inicio', component: HomeComponent },
      {
        path: 'asistencia',
        component: AttendancePageComponent,
        canActivate: [permisoGuard('attendance.view')],
      },
      {
        path: 'mi-grupo',
        component: MiGrupoComponent,
        canActivate: [permisoGuard('attendance.view_assigned_group')],
      },
      {
        path: 'seguimiento',
        component: TrackingPageComponent,
        canActivate: [permisoGuard('tracking.view')],
      },
      {
        path: 'formacion/grupos',
        component: GruposPageComponent,
        canActivate: [permisoGuard('formation.view')],
      },
      {
        path: 'formacion/personas',
        component: PersonasPageComponent,
        canActivate: [permisoGuard('formation.view')],
      },
      {
        path: 'formacion/historial',
        component: HistorialPageComponent,
        canActivate: [permisoGuard('formation.view')],
      },
      {
        path: 'reportes',
        component: ReportesPageComponent,
        canActivate: [permisoGuard('reports.view')],
      },
      {
        path: 'auditoria',
        component: AuditoriaPageComponent,
        canActivate: [permisoGuard('audit.view_full')],
      },
      {
        path: 'admin/usuarios',
        component: ConstruccionComponent,
        canActivate: [permisoGuard('users.manage')],
      },
      {
        path: 'admin/config',
        component: ConstruccionComponent,
        canActivate: [permisoGuard('settings.manage')],
      },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    ],
  },
  { path: '**', redirectTo: 'inicio' },
];
