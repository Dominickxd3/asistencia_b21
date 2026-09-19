import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TuiIcon, TuiNotificationService } from '@taiga-ui/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

type TipoReporte='ESTADO_GENERAL'|'DETALLE_INDIVIDUAL'|'JORNADA';
type Periodo='HOY'|'SEMANA'|'MES'|'PERSONALIZADO';

@Component({selector:'app-reportes-page',imports:[FormsModule,PageHeaderComponent,EmptyStateComponent,TuiIcon],templateUrl:'./reportes.page.html',styleUrl:'./reportes.page.scss'})
export class ReportesPageComponent implements OnInit{
  private readonly http=inject(HttpClient);private readonly notifications=inject(TuiNotificationService);
  tipo:TipoReporte='ESTADO_GENERAL';periodoRapido:Periodo='MES';desde='';hasta='';personaId:number|null=null;jornadaId:number|null=null;
  readonly gruposDisponibles=signal<any[]>([]);readonly gruposSeleccionados=signal<number[]>([]);readonly personas=signal<any[]>([]);readonly jornadas=signal<any[]>([]);readonly recientes=signal<any[]>([]);readonly generando=signal(false);readonly generandoExcel=signal(false);
  readonly gruposElegidos=computed(()=>this.gruposDisponibles().filter(g=>this.gruposSeleccionados().includes(g.id)));
  puedeGenerar(){return!!this.desde&&!!this.hasta&&this.desde<=this.hasta&&this.gruposSeleccionados().length>0&&(this.tipo!=='DETALLE_INDIVIDUAL'||!!this.personaId)&&(this.tipo!=='JORNADA'||!!this.jornadaId)}
  async ngOnInit(){const [g]=await Promise.all([firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/groups`)),this.cargarRecientes()]);this.gruposDisponibles.set(g.filter(x=>x.estado==='ACTIVO'));this.gruposSeleccionados.set(this.gruposDisponibles().map(x=>x.id));await this.aplicarPeriodo('HOY')}
  async cargarRecientes(){try{this.recientes.set(await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/reports/history`)))}catch{this.recientes.set([])}}
  async aplicarPeriodo(p:Periodo){this.periodoRapido=p;const hoy=new Date();const local=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;if(p==='HOY'){this.desde=local(hoy);this.hasta=this.desde}else if(p==='SEMANA'){const inicio=new Date(hoy);inicio.setDate(hoy.getDate()-6);this.desde=local(inicio);this.hasta=local(hoy)}else if(p==='MES'){this.desde=local(new Date(hoy.getFullYear(),hoy.getMonth(),1));this.hasta=local(hoy)}await this.actualizarDependencias()}
  async actualizarDependencias(){if(!this.desde||!this.hasta)return;await Promise.all([this.cargarJornadas(),this.cargarPersonas()])}
  async cargarJornadas(){this.jornadas.set(await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/reports/journeys?desde=${this.desde}&hasta=${this.hasta}`)));if(!this.jornadas().some(j=>j.id===this.jornadaId))this.jornadaId=this.jornadas()[0]?.id??null}
  async cargarPersonas(){const grupos=this.gruposSeleccionados();if(!grupos.length){this.personas.set([]);this.personaId=null;return}const listas=await Promise.all(grupos.map(id=>firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/groups/${id}/members`))));const mapa=new Map<number,any>();listas.flat().forEach(p=>mapa.set(p.personaId,p));this.personas.set([...mapa.values()].sort((a,b)=>a.nombreCompleto.localeCompare(b.nombreCompleto)));if(!this.personas().some(p=>p.personaId===this.personaId))this.personaId=this.personas()[0]?.personaId??null}
  async toggleGrupo(id:number){const s=new Set(this.gruposSeleccionados());s.has(id)?s.delete(id):s.add(id);this.gruposSeleccionados.set([...s]);await this.cargarPersonas()}
  async seleccionarTodos(){this.gruposSeleccionados.set(this.gruposDisponibles().map(g=>g.id));await this.cargarPersonas()}
  async limpiarGrupos(){this.gruposSeleccionados.set([]);await this.cargarPersonas()}
  async generar(){if(!this.puedeGenerar())return;this.generando.set(true);try{const body:any={tipo:this.tipo,desde:this.desde,hasta:this.hasta,grupoIds:this.gruposSeleccionados()};if(this.tipo==='DETALLE_INDIVIDUAL')body.personaId=this.personaId;if(this.tipo==='JORNADA')body.jornadaId=this.jornadaId;const blob=await firstValueFrom(this.http.post(`${environment.apiUrl}/reports/generate`,body,{responseType:'blob'}));const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`rimac21_${this.tipo.toLowerCase()}_${this.desde}_${this.hasta}.pdf`;a.click();URL.revokeObjectURL(url);this.notifications.open('El PDF fue generado y descargado',{label:'Reporte listo',appearance:'positive',autoClose:4000}).subscribe();await this.cargarRecientes()}catch(e:any){this.notifications.open(await this.mensajeError(e),{label:'No se pudo generar',appearance:'negative',autoClose:5000}).subscribe()}finally{this.generando.set(false)}}
  async generarExcel(){if(!this.puedeGenerar())return;this.generandoExcel.set(true);try{const body:any={tipo:this.tipo,desde:this.desde,hasta:this.hasta,grupoIds:this.gruposSeleccionados()};if(this.tipo==='DETALLE_INDIVIDUAL')body.personaId=this.personaId;if(this.tipo==='JORNADA')body.jornadaId=this.jornadaId;const blob=await firstValueFrom(this.http.post(`${environment.apiUrl}/reports/generate-excel`,body,{responseType:'blob'}));const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`rimac21_${this.tipo.toLowerCase()}_${this.desde}_${this.hasta}.xlsx`;a.click();URL.revokeObjectURL(url);this.notifications.open('El Excel fue generado y descargado',{label:'Reporte listo',appearance:'positive',autoClose:4000}).subscribe();await this.cargarRecientes()}catch(e:any){this.notifications.open(await this.mensajeError(e),{label:'No se pudo generar',appearance:'negative',autoClose:5000}).subscribe()}finally{this.generandoExcel.set(false)}}
  fecha(v:string|null){if(!v)return'—';const[a,m,d]=String(v).slice(0,10).split('-');return`${d}/${m}/${a}`}
  nombreTipo(v:string){return v==='ESTADO_GENERAL'?'Consolidado ejecutivo':v==='DETALLE_INDIVIDUAL'?'Detalle individual':'Jornada específica'}
  seleccionarTipo(v:TipoReporte){this.tipo=v}
  private async mensajeError(e:any){if(e?.error instanceof Blob){try{return JSON.parse(await e.error.text()).message??'No se pudo generar el reporte'}catch{return'No se pudo generar el reporte'}}return e?.error?.message??'No se pudo generar el reporte'}
}
