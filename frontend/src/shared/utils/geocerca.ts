/**
 * Geometría para la vista previa del editor de geocercas.
 * La validación oficial (dentro/fuera, autointersección) la hace siempre el backend.
 */

export interface Coordenada {
  latitud: number;
  longitud: number;
}

const R = 6_371_008.8;
const rad = (g: number) => (g * Math.PI) / 180;

function proyectar(vertices: Coordenada[]) {
  const lat0 = vertices.reduce((s, v) => s + v.latitud, 0) / vertices.length;
  const lon0 = vertices.reduce((s, v) => s + v.longitud, 0) / vertices.length;
  const cos = Math.cos(rad(lat0));
  return vertices.map((v) => ({ x: rad(v.longitud - lon0) * cos * R, y: rad(v.latitud - lat0) * R }));
}

export function areaMetros2(vertices: Coordenada[]): number {
  if (vertices.length < 3) return 0;
  const p = proyectar(vertices);
  let doble = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    doble += a.x * b.y - b.x * a.y;
  }
  return Math.abs(doble) / 2;
}

export function perimetroMetros(vertices: Coordenada[]): number {
  if (vertices.length < 2) return 0;
  const p = proyectar(vertices);
  let total = 0;
  for (let i = 0; i < p.length; i++) {
    const b = p[(i + 1) % p.length];
    total += Math.hypot(b.x - p[i].x, b.y - p[i].y);
  }
  return total;
}

type P = { x: number; y: number };
const orient = (a: P, b: P, c: P) => {
  const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  return Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : 2;
};
const sobre = (a: P, b: P, c: P) =>
  b.x <= Math.max(a.x, c.x) && b.x >= Math.min(a.x, c.x) && b.y <= Math.max(a.y, c.y) && b.y >= Math.min(a.y, c.y);

function cruzan(p1: P, q1: P, p2: P, q2: P): boolean {
  const o1 = orient(p1, q1, p2);
  const o2 = orient(p1, q1, q2);
  const o3 = orient(p2, q2, p1);
  const o4 = orient(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && sobre(p1, p2, q1)) ||
    (o2 === 0 && sobre(p1, q2, q1)) ||
    (o3 === 0 && sobre(p2, p1, q2)) ||
    (o4 === 0 && sobre(p2, q1, q2))
  );
}

export function seAutointersecta(vertices: Coordenada[]): boolean {
  if (vertices.length < 4) return false;
  const p = proyectar(vertices);
  const n = p.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (cruzan(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true;
    }
  }
  return false;
}
