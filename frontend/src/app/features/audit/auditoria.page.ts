import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DatePipe, JsonPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'app-auditoria-page',
  imports: [FormsModule, DatePipe, JsonPipe, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './auditoria.page.html',
})
export class AuditoriaPageComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly items = signal<any[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly cargando = signal(false);

  filtroModulo = '';
  filtroAccion = '';
  filtroDesde = '';
  filtroHasta = '';

  readonly MODULOS = ['auth', 'attendance', 'sessions', 'groups', 'persons', 'formation', 'reports'];
  readonly ACCIONES = [
    'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESHED',
    'ATTENDANCE_ENTRY', 'ATTENDANCE_EXIT', 'ATTENDANCE_JUSTIFIED',
    'ATTENDANCE_EARLY_EXIT', 'ATTENDANCE_MODIFIED', 'ATTENDANCE_ANNULLED',
    'SESSION_CREATED', 'SESSION_OPENED', 'SESSION_CLOSED',
    'USER_CREATED', 'USER_UPDATED', 'GROUP_CREATED', 'MANAGER_ASSIGNED',
    'MEMBER_PROMOTED', 'REPORT_GENERATED',
  ];

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const params = new URLSearchParams();
      if (this.filtroModulo) params.set('modulo', this.filtroModulo);
      if (this.filtroAccion) params.set('accion', this.filtroAccion);
      if (this.filtroDesde) params.set('desde', this.filtroDesde);
      if (this.filtroHasta) params.set('hasta', this.filtroHasta);
      params.set('pagina', String(this.pagina()));

      const r = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/audit?${params}`));
      this.items.set(r.items);
      this.total.set(r.total);
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarPagina(d: number): Promise<void> {
    const p = this.pagina() + d;
    if (p < 1) return;
    this.pagina.set(p);
    await this.cargar();
  }
}
