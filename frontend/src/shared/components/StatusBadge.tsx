import { Tag } from 'primereact/tag';

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary';

interface EstadoConfig {
  severity: TagSeverity;
  texto: string;
  styleClass: string;
}

const MAPA_ESTADOS: Record<string, EstadoConfig> = {
  // Jornadas
  PROGRAMADA: { severity: 'warning', texto: 'Programada', styleClass: 'tag-pendiente' },
  ABIERTA: { severity: 'success', texto: 'En curso', styleClass: 'tag-activa' },
  CERRADA: { severity: 'secondary', texto: 'Cerrada', styleClass: 'tag-programada' },
  CANCELADA: { severity: 'danger', texto: 'Cancelada', styleClass: 'tag-obligatoria' },
  // Asistencias
  PENDIENTE: { severity: 'warning', texto: 'Pendiente', styleClass: 'tag-pendiente' },
  PRESENTE: { severity: 'success', texto: 'Presente', styleClass: 'tag-activa' },
  FINALIZADO: { severity: 'secondary', texto: 'Finalizado', styleClass: 'tag-programada' },
  FALTA_JUSTIFICADA: { severity: 'warning', texto: 'Falta justificada', styleClass: 'tag-pendiente' },
  FALTA_INJUSTIFICADA: { severity: 'danger', texto: 'Falta', styleClass: 'tag-obligatoria' },
  SALIDA_ANTICIPADA: { severity: 'warning', texto: 'Salida anticipada', styleClass: 'tag-pendiente' },
  ANULADO: { severity: 'secondary', texto: 'Anulado', styleClass: 'tag-programada' },
  // Tipos de jornada
  OBLIGATORIA: { severity: 'danger', texto: 'Obligatoria', styleClass: 'tag-obligatoria' },
  VOLUNTARIA: { severity: 'secondary', texto: 'Voluntaria', styleClass: 'tag-voluntaria' },
  // Grupos, personas e integrantes
  ACTIVO: { severity: 'success', texto: 'Activo', styleClass: 'tag-activa' },
  INACTIVO: { severity: 'secondary', texto: 'Inactivo', styleClass: 'tag-programada' },
  CERRADO: { severity: 'secondary', texto: 'Cerrado', styleClass: 'tag-programada' },
  CANCELADO: { severity: 'danger', texto: 'Cancelado', styleClass: 'tag-obligatoria' },
  RETIRADO: { severity: 'secondary', texto: 'Retirado', styleClass: 'tag-programada' },
  SUSPENDIDO: { severity: 'warning', texto: 'Suspendido', styleClass: 'tag-pendiente' },
  // Cuentas de usuario
  ACTIVA: { severity: 'success', texto: 'Activa', styleClass: 'tag-activa' },
  INACTIVA: { severity: 'secondary', texto: 'Desactivada', styleClass: 'tag-programada' },
  BLOQUEADA: { severity: 'danger', texto: 'Bloqueada', styleClass: 'tag-obligatoria' },
};

export function StatusBadge({ estado }: { estado: string }) {
  const config = MAPA_ESTADOS[(estado || '').toUpperCase()] ?? {
    severity: 'secondary' as TagSeverity,
    texto: estado,
    styleClass: 'tag-programada',
  };
  // El <span> contenedor mantiene la caja en línea al usarse dentro de filas flex
  return (
    <span>
      <Tag value={config.texto} severity={config.severity} className={config.styleClass} />
    </span>
  );
}
