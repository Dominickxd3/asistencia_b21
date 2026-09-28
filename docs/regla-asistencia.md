# Regla de negocio de asistencia

## Unidad de evaluación

La unidad de cumplimiento es **persona + jornada**. Una persona puede tener el
mismo día una participación voluntaria y una asistencia obligatoria; cada una
pertenece a una jornada distinta y conserva su propia duración.

`asistencias` mantiene la unicidad `(jornada_id, persona_id)`. No se debe buscar
ni deduplicar por persona y fecha.

## Clasificación

| Etapa | Jornada obligatoria | Participación voluntaria |
|---|---|---|
| Postulante | Miércoles 19:30, viernes 19:30 y domingo 07:30 | Cualquier día, en una jornada independiente |
| Aspirante de compañía | Miércoles 19:30, viernes 19:30 y domingo 07:30 | Cualquier día, en una jornada independiente |
| Aspirante ESBAS | No aplica | Toda participación |

Las jornadas voluntarias no generan pendientes, faltas justificadas, faltas
injustificadas ni porcentaje de cumplimiento. Su cierre solo completa las
salidas que sigan abiertas.

## Estados de una obligación

- Antes y durante una jornada obligatoria sin registro: `PENDIENTE` en la vista
  operativa; no es necesario crear una fila física.
- Con justificación: `FALTA_JUSTIFICADA`.
- Al cerrar sin asistencia ni justificación: `FALTA_INJUSTIFICADA`.
- Con entrada: `PRESENTE`; con salida: `FINALIZADO` o `SALIDA_ANTICIPADA`.

Una asistencia voluntaria nunca modifica estos estados ni el cumplimiento de
otra jornada.

## Vigencia de la membresía

La pizarra, el cierre y los reportes operativos solo incluyen integrantes cuya
membresía y persona estén en estado `ACTIVO`. Retirar a una persona del grupo
equivale a darle de baja: deja de aparecer y no recibe nuevas faltas. Las fechas
de inicio y fin se conservan como historial para auditoría.

## Duraciones y reportes

La duración es `salida - entrada`. Los acumulados se calculan por separado:

- minutos u horas obligatorias;
- minutos u horas voluntarias;
- total presencial, como suma complementaria.

Para Postulantes y Aspirantes de compañía, el cumplimiento es:

```text
jornadas obligatorias asistidas / jornadas obligatorias aplicables
```

Para ESBAS se muestra **Cumplimiento obligatorio: No aplica** y solo se
reportan participaciones y horas voluntarias. Su jornada está disponible todo
el día, sin un horario fijo de 08:00 a 18:30.

## Corte diario

La jornada obligatoria tiene hora reglamentaria de entrada, pero no una hora
fija de salida. Cada salida se registra cuando la persona se retira. El día
operativo termina a las **00:00 (medianoche)**: ninguna asistencia puede
continuar en el día siguiente y el límite almacenado es 23:59:59. A partir de
medianoche se utiliza una jornada nueva y se rechazan movimientos físicos sobre
la jornada anterior.

## Canales de registro

Entrada rápida, hora manual y cualquier integración QR deben llamar al mismo
caso de uso de registro con un `jornadaId` explícito. WebSocket publica además
`tipoJornada`, para que el cliente refresque el contexto correcto.

Cada integrante activo tiene una credencial QR aleatoria y reemplazable. El
encargado abre una jornada en su celular o computadora, activa **Escanear QR** y
la lectura decide automáticamente entre entrada y salida. El QR solo identifica
a la persona: permisos del encargado, estado de la jornada, pertenencia activa,
unicidad, precisión GPS y geocerca se validan nuevamente en el servidor.

Sin ubicación no se registra asistencia. Fuera del perímetro o con precisión
insuficiente, el servidor rechaza la operación con el motivo correspondiente.
La cámara requiere HTTPS en dispositivos remotos; `localhost` también se
considera un contexto seguro durante el desarrollo.

## Alcance del encargado de grupo

Cada encargado opera exclusivamente el grupo donde mantiene una asignación
activa. Su panel de inicio, las jornadas, la pizarra, los integrantes y las
credenciales QR se filtran en el servidor por esa asignación; cambiar una URL o
un identificador no permite consultar otro grupo.

El encargado de grupo solo dispone de Inicio, Asistencia y Mi grupo, además del
registro operativo de entradas y salidas. Seguimiento, Formación, Reportes,
Auditoría, configuración y administración corresponden a los roles superiores.
La interfaz oculta esos accesos y la API los rechaza con HTTP 403.

## Informes

Estado general, detalle individual y acta de jornada se generan desde un único
modelo documental en PDF o Excel. Ambos formatos contienen los mismos datos,
indicadores, criterios institucionales y firmas. Cada descarga queda registrada
con código correlativo, formato, filtros y hash SHA-256.

El estado general separa la nómina en bloques de Postulantes, Aspirantes de
compañía y Aspirantes ESBAS.

El estado general admite uno o varios grupos. El detalle individual exige un
solo grupo y luego una persona perteneciente a ese grupo. El periodo se define
directamente con las fechas **Desde** y **Hasta**.

## Seguimiento

Seguimiento presenta únicamente dos gráficos: distribución del grupo mediante
semáforo y ranking de faltas sin justificar. La tabla utiliza lenguaje cotidiano
y abre una ficha por integrante con resumen rápido y detalle fecha por fecha.
Para ESBAS se muestran participaciones voluntarias y horas en el local; no se
calculan alertas por faltas obligatorias.

SQL Server protege la clasificación mediante
`TR_jornadas_regla_obligatoria`, aun cuando una escritura no provenga de la
API.
