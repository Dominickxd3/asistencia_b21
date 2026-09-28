import { randomInt } from 'crypto';

/** Contraseña temporal legible (sin 0/O, 1/l/I) para entregar en persona */
export function generarPasswordTemporal(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digitos = '23456789';
  const elegir = (fuente: string, n: number) =>
    Array.from({ length: n }, () => fuente[randomInt(fuente.length)]).join('');
  return `R21-${elegir(letras, 4)}${elegir(digitos, 2)}${elegir(letras, 2)}`;
}
