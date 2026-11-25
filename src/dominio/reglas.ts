import type { Cobro, Estado, Mov, Permiso, Rol, Usuario, Vale } from './tipos'

export class ErrorRegla extends Error {}
function exigir(ok: unknown, msg: string): asserts ok { if (!ok) throw new ErrorRegla(msg) }

export const PERMISOS: Record<Rol, Permiso[]> = {
  admin: ['emitir', 'partida', 'movimientos', 'verificar', 'conciliar', 'catalogos', 'anular'],
  regional: ['emitir', 'partida', 'movimientos', 'verificar', 'anular'],
  contable: ['verificar', 'conciliar'],
  encargado: ['emitir', 'partida', 'movimientos', 'verificar'],
}
export const puede = (u: Usuario, p: Permiso) => PERMISOS[u.rol].includes(p)
export const enAlcance = (u: Usuario, ciudadId: string) => !u.ciudadId || u.ciudadId === ciudadId

function autorizar(u: Usuario, p: Permiso, ciudadId?: string) {
  exigir(puede(u, p), 'Tu rol no tiene permiso para esta operación.')
  if (ciudadId) exigir(enAlcance(u, ciudadId), 'Solo puedes operar en tu ciudad.')
}
const r2 = (n: number) => Math.round(n * 100) / 100
const positivo = (n: number, que: string) => exigir(Number.isFinite(n) && n > 0, `${que}: ingresa un número mayor que cero.`)

export function sumarDias(f: string, n: number) {
  const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

// ---------- Consultas ----------
function buscar<T extends { id: string }>(l: T[], id: string | undefined, que: string): T {
  const x = l.find(i => i.id === id); exigir(x, `Selecciona ${que}.`); return x
}
export const saldo = (s: Estado, cuenta: Mov['cuenta'], id: string) =>
  r2(s.movs.reduce((a, m) => m.cuenta === cuenta && m.cuentaId === id ? a + m.entrada - m.salida : a, 0))

export function kardex(s: Estado, cuenta: Mov['cuenta'], id: string) {
  let acum = 0
  return s.movs.filter(m => m.cuenta === cuenta && m.cuentaId === id)
    .map(m => ({ ...m, saldo: (acum = r2(acum + m.entrada - m.salida)) }))
}
export const litrosVale = (v: Vale) => v.litrosReales ?? v.litros
export const montoVale = (v: Vale) => v.montoReal ?? r2(v.litros * v.precio)
export const esAbierto = (v: Vale) => v.estado !== 'anulado' && v.partida !== 'partio'

/**
 * Hoja del día: vales emitidos ese día más los anteriores cuyo bus seguía sin partir.
 * El arrastre se calcula al consultar, por eso no depende de ningún cierre manual.
 */
export function hojaControl(s: Estado, fecha: string, ciudadId?: string) {
  return s.vales
    .filter(v => !ciudadId || v.ciudadId === ciudadId)
    .filter(v => {
      if (v.fecha === fecha) return true
      if (v.fecha > fecha) return false
      if (v.estado === 'anulado') return v.fechaCierre! > fecha
      return !v.fechaPartida || v.fechaPartida >= fecha
    })
    .map(v => ({
      vale: v, dias: diasEntre(v.fecha, fecha),
      // La partida tal como estaba ese día, no como está hoy
      partida: v.fechaPartida && v.fechaPartida > fecha ? 'no_partio' as const : v.partida,
    }))
    .sort((a, b) => b.dias - a.dias || a.vale.numero - b.vale.numero)
}

// ---------- Kardex ----------
function anotar(s: Estado, u: Usuario, m: Omit<Mov, 'id' | 'fecha' | 'usuario'>) {
  s.movs.push({ ...m, id: ++s.secuencia, fecha: s.hoy, usuario: u.nombre })
}
function cabeEnBus(s: Estado, busId: string, litros: number) {
  const b = buscar(s.buses, busId, 'un bus'), sd = saldo(s, 'bus', busId)
  exigir(sd + litros <= b.capacidad, `No entra: el bus ${b.interno} tiene ${sd} L en saldo y su tanque es de ${b.capacidad} L.`)
}

// ---------- Vales ----------
export interface DatosVale { busId: string; rutaId: string; choferId: string; origen: 'estacion' | 'tanque'; origenId: string; litros: number }

export function emitirVale(s: Estado, u: Usuario, d: DatosVale): Vale {
  const bus = buscar(s.buses, d.busId, 'un bus'), ruta = buscar(s.rutas, d.rutaId, 'una ruta'), chofer = buscar(s.choferes, d.choferId, 'un chofer')
  positivo(d.litros, 'Litros')
  autorizar(u, 'emitir', ruta.origenId)
  exigir(chofer.vence >= s.hoy, `La licencia de ${chofer.nombre} está vencida.`)
  const otro = s.vales.find(v => v.busId === bus.id && esAbierto(v) && v.rutaId !== ruta.id)
  exigir(!otro, `El bus ${bus.interno} tiene el vale ${otro?.numero} abierto para otra ruta. Registra su partida o anúlalo.`)
  cabeEnBus(s, bus.id, d.litros)
  const estacion = d.origen === 'estacion' ? buscar(s.estaciones, d.origenId, 'una estación') : undefined
  const tanque = d.origen === 'tanque' ? buscar(s.tanques, d.origenId, 'un surtidor interno') : undefined
  exigir((estacion ?? tanque)!.ciudadId === ruta.origenId, 'El punto de carga debe estar en la ciudad de origen de la ruta.')
  if (tanque) {
    const sd = saldo(s, 'tanque', tanque.id)
    exigir(sd >= d.litros, `${tanque.nombre} solo tiene ${sd} L.`)
  }
  const v: Vale = {
    id: 'v' + s.numeroVale, numero: s.numeroVale++, fecha: s.hoy, ciudadId: ruta.origenId,
    busId: bus.id, rutaId: ruta.id, choferId: chofer.id, estacionId: estacion?.id, tanqueId: tanque?.id,
    litros: d.litros, precio: estacion?.precio ?? 0, partida: 'pendiente', estado: tanque ? 'interno' : 'pendiente', emitidoPor: u.nombre,
  }
  s.vales.push(v)
  if (tanque) anotar(s, u, { cuenta: 'tanque', cuentaId: tanque.id, tipo: 'surtidor', entrada: 0, salida: d.litros, detalle: `Entrega con vale ${v.numero}`, valeId: v.id, busRefId: bus.id, rutaId: ruta.id })
  anotar(s, u, { cuenta: 'bus', cuentaId: bus.id, tipo: tanque ? 'surtidor' : 'vale', entrada: d.litros, salida: 0, detalle: `Vale ${v.numero}, ${(estacion ?? tanque)!.nombre}`, valeId: v.id, rutaId: ruta.id })
  return v
}

/** Al partir, el bus sale con todo su saldo y se cierran sus vales abiertos para la ruta. */
export function marcarPartida(s: Estado, u: Usuario, valeId: string, p: 'partio' | 'no_partio') {
  const v = buscar(s.vales, valeId, 'un vale')
  autorizar(u, 'partida', v.ciudadId)
  exigir(esAbierto(v), 'Este vale ya está cerrado.')
  if (p === 'no_partio') { v.partida = p; return }
  for (const x of s.vales) if (x.busId === v.busId && x.rutaId === v.rutaId && esAbierto(x)) { x.partida = 'partio'; x.fechaPartida = s.hoy }
  const sd = saldo(s, 'bus', v.busId)
  if (sd > 0) anotar(s, u, { cuenta: 'bus', cuentaId: v.busId, tipo: 'salida_ruta', entrada: 0, salida: sd, detalle: 'Partió a ruta', valeId: v.id, rutaId: v.rutaId })
}

export function anularVale(s: Estado, u: Usuario, valeId: string, motivo: string) {
  const v = buscar(s.vales, valeId, 'un vale')
  autorizar(u, 'anular', v.ciudadId)
  exigir(esAbierto(v) && (v.estado === 'pendiente' || v.estado === 'interno'), 'Solo se anulan vales sin partida y sin verificar.')
  exigir(motivo.trim(), 'Escribe el motivo de la anulación.')
  exigir(saldo(s, 'bus', v.busId) >= v.litros, 'El bus ya traspasó parte de este diésel, no se puede anular.')
  anotar(s, u, { cuenta: 'bus', cuentaId: v.busId, tipo: 'anulacion', entrada: 0, salida: v.litros, detalle: `Anula vale ${v.numero}: ${motivo}`, valeId: v.id })
  if (v.tanqueId) anotar(s, u, { cuenta: 'tanque', cuentaId: v.tanqueId, tipo: 'anulacion', entrada: v.litros, salida: 0, detalle: `Anula vale ${v.numero}: ${motivo}`, valeId: v.id, busRefId: v.busId })
  v.estado = 'anulado'; v.fechaCierre = s.hoy; v.nota = motivo
}

/** Anota la diferencia entre el vale y lo que cargó el surtidor. */
function ajustar(s: Estado, u: Usuario, v: Vale, litros: number, por: string) {
  const dif = r2(litros - v.litros)
  if (!dif) return
  if (dif < 0 && v.partida !== 'partio') exigir(saldo(s, 'bus', v.busId) >= -dif, 'El ajuste dejaría el saldo del bus en negativo.')
  const base = { cuenta: 'bus' as const, cuentaId: v.busId, tipo: 'ajuste' as const, valeId: v.id, rutaId: v.rutaId }
  const mas = Math.max(dif, 0), menos = Math.max(-dif, 0)
  // Si ya partió, la salida a ruta también fue distinta y el saldo actual no cambia.
  // Se anota primero la entrada para que el saldo nunca pase por negativo.
  const carga = () => anotar(s, u, { ...base, entrada: mas, salida: menos, detalle: `Ajuste vale ${v.numero} por ${por}` })
  const salida = () => anotar(s, u, { ...base, entrada: menos, salida: mas, detalle: `Corrige salida a ruta del vale ${v.numero}` })
  if (v.partida !== 'partio') carga()
  else if (dif > 0) { carga(); salida() }
  else { salida(); carga() }
}

export function verificarVale(s: Estado, u: Usuario, valeId: string, d: { factura: string; litros: number; monto: number; nota: string }) {
  const v = buscar(s.vales, valeId, 'un vale')
  autorizar(u, 'verificar') // la factura puede entregarse en cualquier sucursal
  exigir(v.estado === 'pendiente', 'Este vale ya fue cerrado.')
  const est = buscar(s.estaciones, v.estacionId, 'una estación')
  exigir(est.verificacion === 'factura', 'Los vales de estaciones aliadas se cierran en Conciliación.')
  const factura = d.factura.trim()
  exigir(factura, 'Ingresa el número de factura.')
  positivo(d.litros, 'Litros'); positivo(d.monto, 'Monto')
  exigir(!s.vales.some(x => x.estacionId === est.id && x.factura === factura), `La factura ${factura} de ${est.nombre} ya respalda otro vale.`)
  exigir((d.litros === v.litros && d.monto === montoVale(v)) || d.nota.trim(), 'Hay una diferencia: escribe el motivo del ajuste.')
  ajustar(s, u, v, d.litros, 'factura ' + factura)
  Object.assign(v, { estado: 'verificado', litrosReales: d.litros, montoReal: d.monto, factura, fechaCierre: s.hoy, nota: d.nota.trim() || undefined })
}

// ---------- Otros movimientos ----------
export function traspasar(s: Estado, u: Usuario, d: { deId: string; aId: string; litros: number; motivo: string }) {
  autorizar(u, 'movimientos')
  const a = buscar(s.buses, d.deId, 'el bus que entrega'), b = buscar(s.buses, d.aId, 'el bus que recibe')
  positivo(d.litros, 'Litros')
  exigir(a.id !== b.id, 'El bus que entrega y el que recibe deben ser distintos.')
  exigir(d.motivo.trim(), 'Escribe el motivo del traspaso.')
  const sd = saldo(s, 'bus', a.id)
  exigir(sd >= d.litros, `El bus ${a.interno} solo tiene ${sd} L.`)
  cabeEnBus(s, b.id, d.litros)
  anotar(s, u, { cuenta: 'bus', cuentaId: a.id, tipo: 'traspaso', entrada: 0, salida: d.litros, detalle: `Traspaso al bus ${b.interno}: ${d.motivo}`, busRefId: b.id })
  anotar(s, u, { cuenta: 'bus', cuentaId: b.id, tipo: 'traspaso', entrada: d.litros, salida: 0, detalle: `Traspaso del bus ${a.interno}: ${d.motivo}`, busRefId: a.id })
}
export function comprarSinFactura(s: Estado, u: Usuario, d: { busId: string; litros: number; monto: number; lugar: string }) {
  autorizar(u, 'movimientos')
  buscar(s.buses, d.busId, 'un bus'); positivo(d.litros, 'Litros'); positivo(d.monto, 'Monto')
  exigir(d.lugar.trim(), 'Escribe el lugar de la compra.')
  cabeEnBus(s, d.busId, d.litros)
  anotar(s, u, { cuenta: 'bus', cuentaId: d.busId, tipo: 'compra_sin_factura', entrada: d.litros, salida: 0, detalle: `Compra sin factura en ${d.lugar}, Bs ${d.monto}` })
}
/** Solo toca el tanque: el bus es el medio de transporte y su saldo no cambia. */
export function abastecerTanque(s: Estado, u: Usuario, d: { tanqueId: string; busId: string; litros: number; detalle: string }) {
  const t = buscar(s.tanques, d.tanqueId, 'un tanque'), b = buscar(s.buses, d.busId, 'el bus que abastece')
  autorizar(u, 'movimientos', t.ciudadId)
  positivo(d.litros, 'Litros')
  const sd = saldo(s, 'tanque', t.id)
  exigir(sd + d.litros <= t.capacidad, `No entra: ${t.nombre} tiene espacio para ${r2(t.capacidad - sd)} L.`)
  anotar(s, u, { cuenta: 'tanque', cuentaId: t.id, tipo: 'abastecimiento', entrada: d.litros, salida: 0, detalle: `Abastecido por el bus ${b.interno}${d.detalle ? ': ' + d.detalle : ''}`, busRefId: b.id })
}

// ---------- Conciliación con estaciones aliadas ----------
export type Resultado = 'coincide' | 'diferencia' | 'no_emitido' | 'no_cobrado'
export interface Fila { clave: string; resultado: Resultado; vale?: Vale; cobro?: Cobro; difLitros: number; difMonto: number; motivo: string }

export function comparar(s: Estado, estacionId: string, desde: string, hasta: string): Fila[] {
  const usados = new Set<string>(), filas: Fila[] = []
  for (const c of s.cobros.filter(c => c.estacionId === estacionId && c.estado === 'pendiente' && c.fecha >= desde && c.fecha <= hasta)) {
    const v = s.vales.find(v => v.numero === c.numeroVale && v.estacionId === estacionId)
    const motivo = !v ? 'La estación cobra un número que la empresa no le emitió'
      : v.estado === 'anulado' ? 'El vale está anulado'
      : v.estado !== 'pendiente' || usados.has(v.id) ? 'El vale ya fue cobrado' : ''
    if (!v || motivo) { filas.push({ clave: c.id, resultado: 'no_emitido', cobro: c, difLitros: c.litros, difMonto: c.monto, motivo }); continue }
    usados.add(v.id)
    const difLitros = r2(c.litros - v.litros), difMonto = r2(c.monto - montoVale(v))
    filas.push({ clave: c.id, resultado: difLitros || difMonto ? 'diferencia' : 'coincide', vale: v, cobro: c, difLitros, difMonto,
      motivo: v.fecha < desde || v.fecha > hasta ? 'El vale se emitió fuera del rango' : '' })
  }
  for (const v of s.vales) if (v.estacionId === estacionId && v.estado === 'pendiente' && v.fecha >= desde && v.fecha <= hasta && !usados.has(v.id))
    filas.push({ clave: v.id, resultado: 'no_cobrado', vale: v, difLitros: -v.litros, difMonto: -montoVale(v), motivo: 'Sigue pendiente' })
  return filas
}
export function conciliarFila(s: Estado, u: Usuario, f: Fila, modo: 'cobro' | 'vale' | 'rechazar') {
  autorizar(u, 'conciliar')
  const c = buscar(s.cobros, f.cobro?.id, 'un cobro')
  exigir(c.estado === 'pendiente', 'Este cobro ya fue resuelto.')
  if (modo === 'rechazar') { exigir(f.resultado === 'no_emitido', 'Solo se rechazan cobros sin vale válido.'); c.estado = 'rechazado'; return }
  const v = buscar(s.vales, f.vale?.id, 'un vale')
  exigir(v.estado === 'pendiente', 'Este vale ya fue cerrado.')
  if (modo === 'cobro') ajustar(s, u, v, c.litros, 'conciliación')
  Object.assign(v, { estado: 'conciliado', fechaCierre: s.hoy,
    litrosReales: modo === 'cobro' ? c.litros : v.litros, montoReal: modo === 'cobro' ? c.monto : montoVale(v),
    nota: f.resultado === 'diferencia' ? (modo === 'cobro' ? 'Se aceptó lo cobrado por la estación' : 'Se mantuvo el valor del vale') : undefined })
  c.estado = 'aceptado'
}
export function agregarCobros(s: Estado, u: Usuario, estacionId: string, texto: string) {
  autorizar(u, 'conciliar')
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  exigir(lineas.length, 'Pega al menos una línea.')
  lineas.forEach((l, i) => {
    const [fecha, n, lt, m] = l.split(/[;\t]/).map(x => x.trim())
    const fechaOk = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(fecha))
    exigir(fechaOk && +n > 0 && +lt > 0 && +m > 0, `Línea ${i + 1}: usa fecha;vale;litros;monto, por ejemplo 2026-11-24;10450;260;4667`)
    s.cobros.push({ id: 'c' + ++s.secuencia, estacionId, fecha, numeroVale: +n, litros: +lt, monto: +m, estado: 'pendiente' })
  })
}
export function adeudado(s: Estado, desde: string, hasta: string) {
  return s.estaciones.filter(e => e.verificacion === 'conciliacion').map(e => {
    const vs = s.vales.filter(v => v.estacionId === e.id && v.estado !== 'anulado' && v.fecha >= desde && v.fecha <= hasta)
    const sumar = (est: string) => { const l = vs.filter(v => v.estado === est); return { n: l.length, litros: r2(l.reduce((a, v) => a + litrosVale(v), 0)), monto: r2(l.reduce((a, v) => a + montoVale(v), 0)) } }
    const conciliado = sumar('conciliado'), pendiente = sumar('pendiente')
    return { estacion: e, conciliado, pendiente, total: r2(conciliado.monto + pendiente.monto) }
  })
}

// ---------- Catálogos ----------
export type Catalogo = 'buses' | 'choferes' | 'rutas' | 'ciudades' | 'tanques' | 'estaciones'
export function guardar(s: Estado, u: Usuario, cat: Catalogo, item: any) {
  autorizar(u, 'catalogos')
  const l = s[cat] as any[], i = l.findIndex(x => x.id === item.id)
  for (const [k, v] of Object.entries(item)) {
    if (k === 'id') continue
    exigir(typeof v === 'number' ? Number.isFinite(v) && v > 0 : String(v).trim(), 'Completa todos los campos.')
  }
  for (const k of ['interno', 'placa', 'ci', 'licencia']) if (item[k]) exigir(!l.some(x => x.id !== item.id && x[k] === item[k]), `Ya existe un registro con ${k} ${item[k]}.`)
  if (cat === 'rutas') {
    exigir(item.origenId !== item.destinoId, 'El origen y el destino deben ser distintos.')
  }
  if (i >= 0) l[i] = item; else l.push({ ...item, id: cat[0] + 'n' + ++s.secuencia })
}
