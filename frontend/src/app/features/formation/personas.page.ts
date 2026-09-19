import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TuiNotificationService } from '@taiga-ui/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';

interface PersonaRow { id:number;dni:string|null;nombres:string;apellidoPaterno:string;apellidoMaterno:string|null;telefono?:string|null;correo?:string|null;estado:string;etapaCodigo?:string|null;etapaNombre?:string|null;grupo?:string|null; }

@Component({selector:'app-personas-page',imports:[FormsModule,PageHeaderComponent,EmptyStateComponent,ModalComponent],templateUrl:'./personas.page.html',styleUrl:'./personas.page.scss'})
export class PersonasPageComponent implements OnInit {
  private readonly http=inject(HttpClient); private readonly notifications=inject(TuiNotificationService); protected readonly auth=inject(AuthService);
  readonly personas=signal<PersonaRow[]>([]); readonly busqueda=signal(''); readonly etapa=signal(''); readonly pagina=signal(1); readonly tamano=signal(this.tamanoResponsive()); readonly total=signal(0); readonly cargando=signal(false);
  readonly historial=signal<any[]>([]); readonly historialDe=signal<PersonaRow|null>(null); readonly promoviendo=signal<PersonaRow|null>(null); readonly editando=signal<PersonaRow|null>(null); readonly modalPersona=signal(false); readonly error=signal<string|null>(null); readonly ok=signal<string|null>(null);
  readonly motivoCorreccion=signal('');
  readonly totalPaginas=computed(()=>Math.max(1,Math.ceil(this.total()/this.tamano()))); readonly desde=computed(()=>this.total()?(this.pagina()-1)*this.tamano()+1:0); readonly hasta=computed(()=>Math.min(this.pagina()*this.tamano(),this.total()));
  form=this.formVacio();
  async ngOnInit(){await this.cargar()}
  async cambiarTamano(valor:number|string){this.tamano.set(Number(valor));this.pagina.set(1);await this.cargar()}
  async cargar(){this.cargando.set(true);try{const p=new URLSearchParams({pagina:String(this.pagina()),tamano:String(this.tamano())});if(this.busqueda().trim())p.set('q',this.busqueda().trim());if(this.etapa())p.set('etapa',this.etapa());const r=await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/persons?${p}`));this.personas.set(r.items);this.total.set(r.total)}finally{this.cargando.set(false)}}
  async aplicarFiltros(){this.pagina.set(1);await this.cargar()}
  async irPagina(v:number){if(v<1||v>this.totalPaginas()||v===this.pagina())return;this.pagina.set(v);await this.cargar()}
  nueva(){this.editando.set(null);this.form=this.formVacio();this.modalPersona.set(true)}
  editar(p:PersonaRow){this.editando.set(p);this.form={dni:p.dni??'',nombres:p.nombres,apellidoPaterno:p.apellidoPaterno,apellidoMaterno:p.apellidoMaterno??'',telefono:p.telefono??'',correo:p.correo??''};this.modalPersona.set(true)}
  async guardar(){this.error.set(null);try{const p=this.editando();if(p)await firstValueFrom(this.http.patch(`${environment.apiUrl}/persons/${p.id}`,this.form));else await firstValueFrom(this.http.post(`${environment.apiUrl}/persons`,this.form));this.ok.set(p?'Persona actualizada':'Persona registrada');this.modalPersona.set(false);await this.cargar()}catch(e:any){this.error.set(e?.error?.message??'No se pudo guardar')}}
  async verHistorial(p:PersonaRow){this.historialDe.set(p);this.historial.set(await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/formation/personas/${p.id}/historial`)))}
  async promover(destino:string){const p=this.promoviendo();if(!p)return;try{await firstValueFrom(this.http.post(`${environment.apiUrl}/formation/promote`,{personaId:p.id,etapaDestino:destino}));this.ok.set(`${p.apellidoPaterno} fue promovido correctamente`);this.promoviendo.set(null);await this.cargar()}catch(e:any){this.error.set(e?.error?.message??'No se pudo promover')}}
  async corregirPromocion(){const p=this.promoviendo();const motivo=this.motivoCorreccion().trim();if(!p||!motivo)return;this.error.set(null);this.ok.set(null);try{await firstValueFrom(this.http.post(`${environment.apiUrl}/formation/promotion/correct`,{personaId:p.id,motivo}));const mensaje=`Se corrigió la última promoción de ${p.apellidoPaterno}`;this.ok.set(mensaje);this.notifications.open(mensaje,{label:'Promoción corregida',appearance:'positive',autoClose:4000}).subscribe();this.promoviendo.set(null);this.motivoCorreccion.set('');await this.cargar()}catch(e:any){const mensaje=e?.error?.message??'No se pudo corregir la promoción';this.error.set(mensaje);this.notifications.open(mensaje,{label:'No se realizó la corrección',appearance:'negative',autoClose:5000}).subscribe()}}
  nombre(p:PersonaRow){return[p.apellidoPaterno,p.apellidoMaterno,p.nombres].filter(Boolean).join(' ')}
  etiquetaEtapa(c?:string|null){if(c==='POSTULANTE')return'Postulante';if(c==='ASPIRANTE_COMPANIA')return'Aspirante de compañía';if(c==='ASPIRANTE_ESBAS')return'Aspirante ESBAS';return'Sin etapa'}
  private tamanoResponsive(){return typeof window!=='undefined'&&window.innerWidth<=768?10:25}
  private formVacio(){return{dni:'',nombres:'',apellidoPaterno:'',apellidoMaterno:'',telefono:'',correo:''}}
}
