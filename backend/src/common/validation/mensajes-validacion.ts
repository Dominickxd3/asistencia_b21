import { BadRequestException, ValidationError } from '@nestjs/common';

/** Nombres de campo legibles; el resto se deriva del nombre en camelCase */
const ETIQUETAS: Record<string, string> = {
  dni: 'DNI',
  correo: 'correo',
  telefono: 'teléfono',
  q: 'búsqueda',
  pagina: 'página',
  tamano: 'tamaño de página',
  roles: 'cargos',
  username: 'usuario',
  password: 'contraseña',
};

function etiqueta(campo: string): string {
  if (ETIQUETAS[campo]) return ETIQUETAS[campo];
  // jornadaId → jornada; fechaInicio → fecha inicio
  return campo
    .replace(/Ids?$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

/**
 * Mensaje en español según la regla que falló. Los mensajes escritos a mano en
 * los DTO (ya en español) se respetan; solo se reemplazan los automáticos en inglés.
 */
function traducir(campo: string, regla: string, original: string): string {
  if (!/^\S+ (must|should|has|each value)/i.test(original) && !/^property /i.test(original)) return original;
  const c = `«${etiqueta(campo)}»`;
  const num = original.match(/-?\d+(\.\d+)?/)?.[0];
  switch (regla) {
    case 'whitelistValidation':
      return `El campo «${campo}» no está permitido`;
    case 'isNotEmpty':
    case 'isDefined':
      return `Complete el campo ${c}`;
    case 'isInt':
    case 'isNumber':
    case 'isNumberString':
      return `El campo ${c} debe ser un número`;
    case 'min':
      return num === '1' ? `El campo ${c} no es válido` : `El campo ${c} debe ser como mínimo ${num}`;
    case 'max':
      return `El campo ${c} debe ser como máximo ${num}`;
    case 'isString':
      return `El campo ${c} debe ser un texto`;
    case 'isBoolean':
      return `El campo ${c} debe ser sí o no`;
    case 'maxLength':
      return `El campo ${c} admite como máximo ${num} caracteres`;
    case 'minLength':
      return `El campo ${c} debe tener al menos ${num} caracteres`;
    case 'isIn':
    case 'isEnum':
      return `El valor de ${c} no es válido`;
    case 'matches':
      return `El formato de ${c} no es válido`;
    case 'isEmail':
      return `El correo no tiene un formato válido`;
    case 'isArray':
      return `El campo ${c} debe ser una lista`;
    case 'arrayMinSize':
      return `Elija al menos ${num} en ${c}`;
    case 'arrayMaxSize':
      return `Puede elegir como máximo ${num} en ${c}`;
    case 'arrayUnique':
      return `El campo ${c} tiene valores repetidos`;
    case 'isLatitude':
    case 'isLongitude':
      return `La ubicación enviada no es válida`;
    default:
      return `El campo ${c} no es válido`;
  }
}

function recolectar(errores: ValidationError[], prefijo = ''): string[] {
  return errores.flatMap((e) => {
    const campo = e.property;
    const propios = Object.entries(e.constraints ?? {}).map(([regla, msg]) => traducir(campo, regla, msg));
    return [...propios, ...recolectar(e.children ?? [], `${prefijo}${campo}.`)];
  });
}

/** exceptionFactory del ValidationPipe: mismo formato de siempre ({ message: string[] }), en español */
export function erroresDeValidacion(errores: ValidationError[]): BadRequestException {
  return new BadRequestException([...new Set(recolectar(errores))]);
}
