import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordenada } from '../../shared/utils/geocerca';
import './mapa-geocerca.scss';

export interface PuntoPrueba extends Coordenada {
  precisionMetros: number | null;
  estado: string;
}

export interface Enfoque {
  coordenada: Coordenada;
  zoom?: number;
  /** Cambiar la clave vuelve a centrar aunque la coordenada sea la misma */
  clave: number;
}

interface Props {
  vertices: Coordenada[];
  /** Sin onChange el mapa es de solo lectura */
  onChange?: (vertices: Coordenada[]) => void;
  seleccionado: number | null;
  onSeleccionar?: (indice: number | null) => void;
  enfoque?: Enfoque | null;
  puntoPrueba?: PuntoPrueba | null;
  puntoReferencia?: Coordenada | null;
  altura?: number;
}

const COLOR_ESTADO: Record<string, string> = {
  DENTRO_ZONA: '#14804A',
  FUERA_ZONA: '#C8102E',
  PRECISION_INSUFICIENTE: '#B76E00',
};

/**
 * Editor de geocerca poligonal sobre Leaflet.
 * Clic en el mapa agrega un vértice (a continuación del seleccionado), arrastrar
 * lo mueve, clic derecho lo elimina y los puntos intermedios insertan uno nuevo.
 */
export function MapaGeocerca({
  vertices,
  onChange,
  seleccionado,
  onSeleccionar,
  enfoque,
  puntoPrueba,
  puntoReferencia,
  altura = 520,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const ajustado = useRef(false);

  // Referencias vigentes para los handlers registrados una sola vez
  const estado = useRef({ vertices, onChange, seleccionado, onSeleccionar });
  estado.current = { vertices, onChange, seleccionado, onSeleccionar };

  // Inicialización única del mapa
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const m = L.map(contenedor.current, { center: [0, 0], zoom: 2, maxZoom: 21 });
    const satelite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxNativeZoom: 19,
        maxZoom: 21,
        attribution: 'Imágenes &copy; Esri, Maxar, Earthstar Geographics',
      },
    );
    const callejero = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 21,
      attribution: '&copy; colaboradores de OpenStreetMap',
    });
    callejero.addTo(m);
    L.control
      .layers({ Mapa: callejero, Satélite: satelite }, undefined, { position: 'topright' })
      .addTo(m);
    L.control.scale({ imperial: false }).addTo(m);
    capa.current = L.layerGroup().addTo(m);

    m.on('click', (e: L.LeafletMouseEvent) => {
      const {
        vertices: vs,
        onChange: cambiar,
        seleccionado: sel,
        onSeleccionar: seleccionar,
      } = estado.current;
      if (!cambiar) return;
      const nuevo = { latitud: redondear(e.latlng.lat), longitud: redondear(e.latlng.lng) };
      const posicion = sel === null ? vs.length : sel + 1;
      cambiar([...vs.slice(0, posicion), nuevo, ...vs.slice(posicion)]);
      seleccionar?.(posicion);
    });

    mapa.current = m;
    setTimeout(() => m.invalidateSize(), 0);
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Encuadre inicial sobre el polígono existente
  useEffect(() => {
    const m = mapa.current;
    if (!m || ajustado.current || vertices.length < 3) return;
    m.fitBounds(L.latLngBounds(vertices.map((v) => [v.latitud, v.longitud])), {
      padding: [40, 40],
      maxZoom: 20,
    });
    ajustado.current = true;
  }, [vertices]);

  useEffect(() => {
    if (!enfoque || !mapa.current) return;
    mapa.current.setView(
      [enfoque.coordenada.latitud, enfoque.coordenada.longitud],
      enfoque.zoom ?? 19,
    );
    ajustado.current = true;
  }, [enfoque]);

  // Redibujo del polígono, vértices, puntos intermedios y punto de prueba
  useEffect(() => {
    const grupo = capa.current;
    if (!grupo) return;
    grupo.clearLayers();
    const editable = !!onChange;
    const latlngs = vertices.map((v) => L.latLng(v.latitud, v.longitud));

    let forma: L.Polygon | L.Polyline<any> | null = null;
    if (latlngs.length >= 3) {
      forma = L.polygon(latlngs, {
        color: '#C8102E',
        weight: 2.5,
        fillColor: '#C8102E',
        fillOpacity: 0.18,
      });
    } else if (latlngs.length === 2) {
      forma = L.polyline(latlngs, { color: '#C8102E', weight: 2.5, dashArray: '6 6' });
    }
    forma?.addTo(grupo);

    if (editable && latlngs.length >= 2) {
      const lados = latlngs.length >= 3 ? latlngs.length : 1;
      for (let i = 0; i < lados; i++) {
        const a = latlngs[i];
        const b = latlngs[(i + 1) % latlngs.length];
        const medio = L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
          icon: L.divIcon({ className: 'r21-vertice-medio', html: '+', iconSize: [16, 16] }),
          title: 'Insertar vértice aquí',
        });
        medio.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const nuevo = {
            latitud: redondear(medio.getLatLng().lat),
            longitud: redondear(medio.getLatLng().lng),
          };
          onChange?.([...vertices.slice(0, i + 1), nuevo, ...vertices.slice(i + 1)]);
          onSeleccionar?.(i + 1);
        });
        medio.addTo(grupo);
      }
    }

    vertices.forEach((v, i) => {
      const marcador = L.marker([v.latitud, v.longitud], {
        draggable: editable,
        icon: L.divIcon({
          className: `r21-vertice${i === seleccionado ? ' seleccionado' : ''}`,
          html: String(i + 1),
          iconSize: [24, 24],
        }),
        title: editable
          ? `Vértice ${i + 1}: arrastra para mover, clic derecho para eliminar`
          : `Vértice ${i + 1}`,
      });
      marcador.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSeleccionar?.(i === seleccionado ? null : i);
      });
      if (editable) {
        marcador.on('drag', () => {
          const pos = marcador.getLatLng();
          forma?.setLatLngs(latlngs.map((p, j) => (j === i ? pos : p)));
        });
        marcador.on('dragend', () => {
          const pos = marcador.getLatLng();
          onChange?.(
            vertices.map((p, j) =>
              j === i ? { latitud: redondear(pos.lat), longitud: redondear(pos.lng) } : p,
            ),
          );
          onSeleccionar?.(i);
        });
        marcador.on('contextmenu', (e) => {
          L.DomEvent.stopPropagation(e);
          onChange?.(vertices.filter((_, j) => j !== i));
          onSeleccionar?.(null);
        });
      }
      marcador.addTo(grupo);
    });

    if (puntoPrueba) {
      const color = COLOR_ESTADO[puntoPrueba.estado] ?? '#475467';
      const centro = L.latLng(puntoPrueba.latitud, puntoPrueba.longitud);
      if (puntoPrueba.precisionMetros) {
        L.circle(centro, {
          radius: puntoPrueba.precisionMetros,
          color,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(grupo);
      }
      L.circleMarker(centro, {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip('Ubicación de prueba')
        .addTo(grupo);
    }

    if (puntoReferencia) {
      L.marker([puntoReferencia.latitud, puntoReferencia.longitud], {
        icon: L.divIcon({
          className: 'r21-punto-busqueda',
          html: '<i class="pi pi-map-marker"></i>',
          iconSize: [32, 38],
          iconAnchor: [16, 38],
        }),
      })
        .bindTooltip('Resultado de la búsqueda')
        .addTo(grupo);
    }
  }, [vertices, seleccionado, onChange, onSeleccionar, puntoPrueba, puntoReferencia]);

  return (
    <div
      ref={contenedor}
      className={`r21-mapa-geocerca${onChange ? ' editable' : ''}`}
      style={{ height: altura }}
      role="application"
      aria-label="Mapa de la geocerca"
    />
  );
}

/** 7 decimales ≈ 1 cm: coincide con la precisión de la columna en la BD */
function redondear(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}
