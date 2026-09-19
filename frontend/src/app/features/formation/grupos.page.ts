import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';

interface Grupo { id:number; codigo:string; nombre:string; periodo:string; etapa:string; etapaCodigo:string; estado:string; fechaInicio:string; fechaFin:string|null; totalIntegrantes:number; encargado:{nombre:string}|null }
interface Etapa { id:number; codigo:string; nombre:string }
interface Persona { id:number; nombres:string; apellidoPaterno:string; apellidoMaterno:string|null; dni:string|null }

@Component({
  selector: 'app-grupos-page',
  imports: [FormsModule, PageHeaderComponent, EmptyStateComponent, ModalComponent],
  template: `
    <app-page-header titulo="Grupos" subtitulo="Equipos de formación e integrantes">
      @if (auth.tienePermiso('formation.manage_groups')) {<button class="primary" (click)="nuevo()"><i class="pi pi-plus"></i> Nuevo grupo</button>}
    </app-page-header>
    @if (ok()) {<div class="feedback success">{{ok()}}</div>}
    @if (error()) {<div class="feedback error">{{error()}}</div>}
    <section class="panel">
      <header class="toolbar"><div><strong>Grupos registrados</strong><span>{{grupos().length}} grupos</span></div><label>Estado<select [(ngModel)]="filtro"><option value="ACTIVO">Activos</option><option value="">Todos</option><option value="CERRADO">Cerrados</option></select></label></header>
      @if (filtrados().length === 0) {<app-empty-state mensaje="No hay grupos para este filtro" icono="@tui.library" />}
      @else {
        <div class="groups-grid grid-head"><span>Grupo</span><span>Etapa</span><span>Periodo</span><span>Integrantes</span><span>Encargado</span><span>Estado</span><span>Acciones</span></div>
        @for (g of filtrados(); track g.id) {
          <div class="groups-grid grid-row">
            <span data-label="Grupo"><strong>{{g.nombre}}</strong><small>{{g.codigo}}</small></span>
            <span data-label="Etapa">{{g.etapa}}</span><span data-label="Periodo">{{g.periodo}}</span><span data-label="Integrantes"><strong>{{g.totalIntegrantes}}</strong></span><span data-label="Encargado">{{g.encargado?.nombre ?? 'Sin asignar'}}</span>
            <span data-label="Estado"><b class="badge" [class.closed]="g.estado!=='ACTIVO'">{{g.estado}}</b></span>
            <span class="actions" data-label="Acciones">@if(auth.tienePermiso('formation.manage_groups')&&g.estado==='ACTIVO'){<button title="Añadir integrantes" (click)="gestionar(g)"><i class="pi pi-user-plus"></i></button><button title="Editar grupo" (click)="editar(g)"><i class="pi pi-pencil"></i></button><button title="Cerrar grupo" (click)="cerrarGrupo(g)"><i class="pi pi-lock"></i></button>}</span>
          </div>
        }
      }
    </section>
    <app-modal [titulo]="editando()?'Editar grupo':'Nuevo grupo'" [visible]="modalGrupo()" (cerrar)="modalGrupo.set(false)">
      <div class="form">@if(!editando()){<label>Etapa *<select [(ngModel)]="form.etapaId"><option [ngValue]="0" disabled>Seleccionar</option>@for(e of etapas();track e.id){<option [ngValue]="e.id">{{e.nombre}}</option>}</select></label><label>Código *<input [(ngModel)]="form.codigo" placeholder="POST-2026-II"></label>}<label>Nombre *<input [(ngModel)]="form.nombre" placeholder="Postulantes 2026-II"></label><label>Periodo *<input [(ngModel)]="form.periodo" placeholder="2026-II"></label><label>Fecha de inicio *<input type="date" [(ngModel)]="form.fechaInicio"></label><label>Fecha de fin<input type="date" [(ngModel)]="form.fechaFin"></label></div>
      <div acciones class="modal-actions"><button class="secondary" (click)="modalGrupo.set(false)">Cancelar</button><button class="primary" [disabled]="!form.nombre||!form.periodo||!form.fechaInicio||(!editando()&&(!form.etapaId||!form.codigo))" (click)="guardar()">Guardar</button></div>
    </app-modal>
    <app-modal [titulo]="'Añadir integrantes a '+(seleccionado()?.nombre??'')" [visible]="!!seleccionado()" (cerrar)="seleccionado.set(null)">
      @if(seleccionado()?.estado==='ACTIVO'&&auth.tienePermiso('formation.manage_groups')&&candidatos().length){<div class="add-member"><label>Añadir persona sin grupo<select [(ngModel)]="personaId">@for(p of candidatos();track p.id){<option [ngValue]="p.id">{{nombrePersona(p)}} · {{p.dni??'Sin DNI'}}</option>}</select></label><button class="primary" (click)="agregar()"><i class="pi pi-plus"></i> Añadir</button></div>}
      @if(candidatos().length===0){<div class="empty-candidates"><i class="pi pi-users"></i><strong>No hay personas disponibles</strong><span>Todas las personas de esta etapa ya pertenecen a un grupo.</span></div>}
    </app-modal>
  `,
  styles: [`
    :host{display:flex;flex-direction:column;gap:16px}.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 14px;border:1px solid var(--r21-red);border-radius:8px;font-weight:700;cursor:pointer}.primary{background:var(--r21-red);color:#fff}.secondary{background:#fff;color:var(--r21-text-primary);border-color:var(--r21-border)}button:disabled{cursor:not-allowed;opacity:.5}.feedback{padding:10px 12px;border-radius:8px;font-size:12px}.success{background:#ecfdf3;color:#067647}.error{background:#fef3f2;color:#b42318}.panel{overflow:hidden;border:1px solid var(--r21-border);border-radius:12px;background:#fff;box-shadow:var(--r21-shadow-sm)}.toolbar{display:flex;align-items:flex-end;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--r21-border)}.toolbar>div{display:flex;flex-direction:column;gap:3px}.toolbar span,.toolbar label{color:var(--r21-text-muted);font-size:10px}.toolbar label{display:flex;align-items:center;gap:8px;font-weight:700;text-transform:uppercase}.toolbar select{height:34px;padding:0 9px;border:1px solid var(--r21-border);border-radius:7px;background:#fff}.groups-grid{display:grid;grid-template-columns:minmax(210px,1.5fr) minmax(150px,1fr) 90px 80px minmax(160px,1fr) 85px 120px;align-items:center;gap:14px;padding:11px 16px}.grid-head{background:#f7f8fa;color:var(--r21-text-muted);font-size:9.5px;font-weight:750;text-transform:uppercase}.grid-row{min-height:60px;border-top:1px solid var(--r21-border-subtle);font-size:12px}.grid-row>span:first-child{display:flex;flex-direction:column;gap:3px}.grid-row small{color:var(--r21-text-muted)}.badge{padding:3px 7px;border-radius:99px;background:#e8f7ee;color:#087443;font-size:9px}.badge.closed{background:#f2f4f7;color:#475467}.actions{display:flex;justify-content:flex-end;gap:6px}.actions button{display:grid;width:32px;height:32px;place-items:center;border:1px solid var(--r21-border);border-radius:7px;background:#fff;color:#475467}.actions button:hover{border-color:var(--r21-red);color:var(--r21-red)}.form{display:grid;grid-template-columns:1fr 1fr;gap:13px}.form label,.add-member label{display:flex;flex-direction:column;gap:5px;color:var(--r21-text-secondary);font-size:11px}.form input,.form select,.add-member select{height:38px;padding:0 10px;border:1px solid var(--r21-border);border-radius:8px;background:#fff;color:var(--r21-text-primary)}.modal-actions{display:flex;gap:8px}.add-member{display:grid;grid-template-columns:1fr auto;align-items:end;gap:8px}.empty-candidates{display:flex;flex-direction:column;align-items:center;gap:7px;padding:24px;text-align:center;color:var(--r21-text-muted)}.empty-candidates i{font-size:22px}.empty-candidates strong{color:var(--r21-text-primary);font-size:13px}.empty-candidates span{font-size:11px}
    @media(max-width:900px){.grid-head{display:none}.grid-row{grid-template-columns:1fr 1fr}.grid-row>span::before{content:attr(data-label);display:block;margin-bottom:3px;color:var(--r21-text-muted);font-size:9px;font-weight:700;text-transform:uppercase}.actions{grid-column:1/-1;justify-content:flex-start}}@media(max-width:560px){.toolbar{align-items:stretch;flex-direction:column;gap:10px}.toolbar label{justify-content:space-between}.grid-row,.form{grid-template-columns:1fr}.grid-row>span,.actions{grid-column:1}.add-member{grid-template-columns:1fr}}
  `],
})
export class GruposPageComponent implements OnInit {
  private readonly http=inject(HttpClient); protected readonly auth=inject(AuthService);
  readonly grupos=signal<Grupo[]>([]); readonly etapas=signal<Etapa[]>([]); readonly personas=signal<Persona[]>([]);
  readonly editando=signal<Grupo|null>(null); readonly seleccionado=signal<Grupo|null>(null); readonly modalGrupo=signal(false); readonly ok=signal<string|null>(null); readonly error=signal<string|null>(null);
  filtro='ACTIVO'; personaId=0; form=this.vacio();
  readonly filtrados=computed(()=>this.filtro?this.grupos().filter(g=>g.estado===this.filtro):this.grupos());
  readonly candidatos=computed(()=>this.personas());
  async ngOnInit(){await Promise.all([this.cargar(),this.cargarEtapas()])}
  async cargar(){this.grupos.set(await firstValueFrom(this.http.get<Grupo[]>(`${environment.apiUrl}/groups`)))}
  async cargarEtapas(){this.etapas.set(await firstValueFrom(this.http.get<Etapa[]>(`${environment.apiUrl}/groups/stages`)))}
  async cargarPersonas(id:number){const personas=await firstValueFrom(this.http.get<Persona[]>(`${environment.apiUrl}/groups/${id}/candidates`));this.personas.set(personas);this.personaId=personas[0]?.id??0}
  nuevo(){this.editando.set(null);this.form=this.vacio();this.modalGrupo.set(true)}
  editar(g:Grupo){this.editando.set(g);this.form={etapaId:0,codigo:g.codigo,nombre:g.nombre,periodo:g.periodo,fechaInicio:g.fechaInicio,fechaFin:g.fechaFin??''};this.modalGrupo.set(true)}
  async guardar(){this.limpiarMensajes();try{const g=this.editando();const body=g?{nombre:this.form.nombre,periodo:this.form.periodo,fechaInicio:this.form.fechaInicio,fechaFin:this.form.fechaFin||undefined}:{...this.form,fechaFin:this.form.fechaFin||undefined};if(g)await firstValueFrom(this.http.patch(`${environment.apiUrl}/groups/${g.id}`,body));else await firstValueFrom(this.http.post(`${environment.apiUrl}/groups`,body));this.ok.set(g?'Grupo actualizado':'Grupo creado correctamente');this.modalGrupo.set(false);await this.cargar()}catch(e:any){this.error.set(e?.error?.message??'No se pudo guardar el grupo')}}
  async gestionar(g:Grupo){this.seleccionado.set(g);this.personaId=0;await this.cargarPersonas(g.id)}
  async agregar(){const g=this.seleccionado();if(!g||!this.personaId)return;this.limpiarMensajes();try{await firstValueFrom(this.http.post(`${environment.apiUrl}/groups/${g.id}/members`,{personaId:this.personaId}));this.ok.set('Integrante añadido al grupo');await Promise.all([this.cargar(),this.cargarPersonas(g.id)])}catch(e:any){this.error.set(e?.error?.message??'No se pudo añadir al integrante')}}
  async cerrarGrupo(g:Grupo){if(!confirm(`¿Cerrar el grupo ${g.nombre}? Esta acción conserva todo su historial.`))return;this.limpiarMensajes();try{await firstValueFrom(this.http.delete(`${environment.apiUrl}/groups/${g.id}`));this.ok.set('Grupo cerrado correctamente');await this.cargar()}catch(e:any){this.error.set(e?.error?.message??'No se pudo cerrar el grupo')}}
  nombrePersona(p:Persona){return[p.apellidoPaterno,p.apellidoMaterno,p.nombres].filter(Boolean).join(' ')}
  private limpiarMensajes(){this.ok.set(null);this.error.set(null)}
  private vacio(){return{etapaId:0,codigo:'',nombre:'',periodo:'',fechaInicio:new Date().toISOString().slice(0,10),fechaFin:''}}
}
