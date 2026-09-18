import {Component, HostListener, OnInit, inject, signal} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {FormsModule} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {TuiIcon} from '@taiga-ui/core';
import {environment} from '../../../environments/environment';
import {PageHeaderComponent} from '../../shared/components/page-header.component';

type Periodo = 'mes' | 'primera' | 'segunda' | 'personalizado';
interface Grupo {id: number; nombre: string; etapa: string}
interface Fila {personaId:number; nombreCompleto:string; dni:string|null; jornadasAplicables:number; asistencias:number; porcentajeAsistencia:number; faltasJustificadas:number; faltasInjustificadas:number; salidasAnticipadas:number; horasAdicionales:number}
interface Resumen {jornadasObligatorias:number; asistenciaGrupo:number; faltasInjustificadas:number; faltasJustificadas:number; salidasAnticipadas:number; horasAdicionales:number}
interface Respuesta {grupo:Grupo; jornadasEsperadas:number; resumen:Resumen; integrantes:Fila[]}
interface Historia {jornadaId:number; fecha:string; tipo:string; estado:string; entrada:string|null; salida:string|null; incidencia:string|null; horasAdicionales:number}
interface Detalle {grupo:Grupo; desde:string; hasta:string; integrante:Fila; historial:Historia[]}

@Component({selector:'app-tracking-page', imports:[FormsModule, PageHeaderComponent, TuiIcon], templateUrl:'./tracking.page.html', styleUrl:'./tracking.page.css'})
export class TrackingPageComponent implements OnInit {
  private readonly http=inject(HttpClient);
  readonly grupos=signal<Grupo[]>([]); readonly grupoId=signal<number|null>(null);
  readonly orden=signal('faltas_injustificadas'); readonly periodo=signal<Periodo>('mes');
  readonly filas=signal<Fila[]>([]); readonly resumen=signal<Resumen|null>(null);
  readonly jornadasEsperadas=signal(0); readonly cargando=signal(false); readonly error=signal('');
  readonly detalle=signal<Detalle|null>(null); readonly cargandoDetalle=signal(false);
  desde=''; hasta='';

  async ngOnInit():Promise<void>{
    this.aplicarPeriodo('mes',false);
    try {
      const grupos=await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/groups`));
      this.grupos.set(grupos.map(x=>({id:Number(x.id),nombre:x.nombre,etapa:x.etapa})));
      if(this.grupos().length){this.grupoId.set(this.grupos()[0].id); await this.cargar();}
    } catch {this.error.set('No fue posible cargar los grupos de formación.');}
  }
  cambiarGrupo(value:number){this.grupoId.set(Number(value)); void this.cargar();}
  cambiarOrden(value:string){this.orden.set(value); void this.cargar();}
  aplicarPeriodo(periodo:Periodo,recargar=true){
    this.periodo.set(periodo);
    if(periodo!=='personalizado'){
      const hoy=new Date(), y=hoy.getFullYear(), m=hoy.getMonth(), ultimo=new Date(y,m+1,0).getDate();
      this.desde=this.fechaLocal(new Date(y,m,periodo==='segunda'?16:1));
      this.hasta=this.fechaLocal(new Date(y,m,periodo==='primera'?15:ultimo));
    }
    if(recargar) void this.cargar();
  }
  fechasPersonalizadas(){this.periodo.set('personalizado'); if(this.desde&&this.hasta&&this.desde<=this.hasta) void this.cargar();}
  async cargar(){
    const grupoId=this.grupoId(); if(!grupoId||!this.desde||!this.hasta)return;
    if(this.desde>this.hasta){this.error.set('La fecha inicial no puede ser posterior a la fecha final.');return;}
    this.cargando.set(true); this.error.set('');
    const params=new HttpParams().set('grupoId',grupoId).set('desde',this.desde).set('hasta',this.hasta).set('orden',this.orden());
    try {const r=await firstValueFrom(this.http.get<Respuesta>(`${environment.apiUrl}/tracking`,{params})); this.filas.set(r.integrantes);this.resumen.set(r.resumen);this.jornadasEsperadas.set(r.jornadasEsperadas);}
    catch {this.filas.set([]);this.resumen.set(null);this.error.set('No fue posible cargar el seguimiento para este periodo.');}
    finally {this.cargando.set(false);}
  }
  async abrirDetalle(personaId:number){
    const grupoId=this.grupoId(); if(!grupoId)return; this.detalle.set(null);this.cargandoDetalle.set(true);
    const params=new HttpParams().set('grupoId',grupoId).set('personaId',personaId).set('desde',this.desde).set('hasta',this.hasta);
    try {this.detalle.set(await firstValueFrom(this.http.get<Detalle>(`${environment.apiUrl}/tracking/detail`,{params})));}
    catch {this.error.set('No fue posible cargar el detalle del integrante.');}
    finally {this.cargandoDetalle.set(false);}
  }
  cerrarDetalle(){this.detalle.set(null);this.cargandoDetalle.set(false);}
  @HostListener('document:keydown.escape') cerrarConEscape(){if(this.detalle()||this.cargandoDetalle())this.cerrarDetalle();}
  etiquetaEstado(e:string){return e.toLowerCase().replaceAll('_',' ');}
  claseEstado(e:string){if(['PRESENTE','FINALIZADO'].includes(e))return 'status--ok';if(e==='FALTA_JUSTIFICADA')return 'status--info';if(['FALTA_INJUSTIFICADA','SIN_REGISTRO'].includes(e))return 'status--danger';return 'status--warning';}
  private fechaLocal(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
}
