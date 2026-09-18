import { Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary';

interface EstadoConfig {
  severity: TagSeverity;
  texto: string;
  styleClass: string;
}

const MAPA_ESTADOS: Record<string, EstadoConfig> = {
  PROGRAMADA: { severity: 'secondary', texto: 'Programada', styleClass: 'tag-programada' },
  ABIERTA: { severity: 'success', texto: 'Abierta', styleClass: 'tag-activa' },
  CERRADA: { severity: 'secondary', texto: 'Cerrada', styleClass: 'tag-programada' },
  CANCELADA: { severity: 'danger', texto: 'Cancelada', styleClass: 'tag-obligatoria' },
  PENDIENTE: { severity: 'warning', texto: 'Pendiente', styleClass: 'tag-pendiente' },
  PRESENTE: { severity: 'success', texto: 'Presente', styleClass: 'tag-activa' },
  FINALIZADO: { severity: 'secondary', texto: 'Finalizado', styleClass: 'tag-programada' },
  FALTA_JUSTIFICADA: { severity: 'warning', texto: 'Falta justificada', styleClass: 'tag-pendiente' },
  FALTA_INJUSTIFICADA: { severity: 'danger', texto: 'Falta', styleClass: 'tag-obligatoria' },
  SALIDA_ANTICIPADA: { severity: 'warning', texto: 'Salida anticipada', styleClass: 'tag-pendiente' },
  ANULADO: { severity: 'secondary', texto: 'Anulado', styleClass: 'tag-programada' },
  OBLIGATORIA: { severity: 'danger', texto: 'Obligatoria', styleClass: 'tag-obligatoria' },
  VOLUNTARIA: { severity: 'secondary', texto: 'Voluntaria', styleClass: 'tag-voluntaria' },
};

@Component({
  selector: 'app-status-badge',
  imports: [TagModule],
  template: `
    <p-tag
      [value]="config().texto"
      [severity]="config().severity"
      [styleClass]="config().styleClass"
    />
  `,
})
export class StatusBadgeComponent {
  readonly estado = input.required<string>();

  protected readonly config = computed(() => {
    const key = (this.estado() || '').toUpperCase();
    return MAPA_ESTADOS[key] ?? {
      severity: 'secondary' as TagSeverity,
      texto: this.estado(),
      styleClass: 'tag-programada',
    };
  });
}
