import type { Estado, Usuario } from './tipos'
import { abastecerTanque, anularVale, comprarSinFactura, conciliarFila, comparar, emitirVale, esAbierto, marcarPartida, montoVale, saldo, sumarDias, traspasar, verificarVale } from './reglas'

export const VERSION = 1
const HOY = '2026-11-25'

/** Datos ficticios. El histórico se genera con las mismas reglas que usa la aplicación. */
export function crearDemo(): Estado {
  let sem = 20261125
  const rnd = () => { sem = (sem * 1664525 + 1013904223) % 4294967296; return sem / 4294967296 }
  const ent = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const uno = <T,>(l: T[]) => l[Math.floor(rnd() * l.length)]

  const ciudades = [['lpz', 'La Paz', 'La Paz'], ['cbb', 'Cochabamba', 'Cochabamba'], ['scz', 'Santa Cruz', 'Santa Cruz'], ['oru', 'Oruro', 'Oruro'], ['pts', 'Potosí', 'Potosí'], ['sre', 'Sucre', 'Chuquisaca'], ['tja', 'Tarija', 'Tarija'], ['tdd', 'Trinidad', 'Beni']]
    .map(([id, nombre, departamento]) => ({ id, nombre, departamento }))
  const pares: [string, string, number][] = [['lpz', 'cbb', 380], ['lpz', 'scz', 850], ['lpz', 'oru', 230], ['cbb', 'scz', 480], ['cbb', 'oru', 210], ['lpz', 'pts', 540], ['pts', 'sre', 160], ['pts', 'tja', 370], ['scz', 'tdd', 550], ['sre', 'cbb', 370], ['scz', 'sre', 490], ['oru', 'pts', 310]]
  const rutas = pares.flatMap(([a, b, km]) => [[a, b], [b, a]].map(([o, d]) => ({ id: `r-${o}-${d}`, origenId: o, destinoId: d, km, litrosRef: Math.round(km / 2.6 / 5) * 5 })))
  const modelos: [string, string, number, number, number][] = [['Volvo', 'B450R', 600, 48, 2.6], ['Scania', 'K410', 560, 46, 2.7], ['Mercedes-Benz', 'O 500 RSD', 600, 50, 2.5], ['Yutong', 'ZK6122', 480, 44, 2.9], ['Marcopolo', 'Paradiso G7', 560, 52, 2.4]]
  const buses = Array.from({ length: 60 }, (_, i) => {
    const [marca, modelo, capacidad, asientos, rendimiento] = modelos[i % 5]
    return { id: 'b' + i, interno: String(101 + i), placa: `${3100 + i * 47}-${['ABK', 'DTL', 'GZN', 'HXP', 'KRS'][i % 5]}`, marca, modelo, anio: 2013 + (i * 7) % 12, capacidad, asientos, rendimiento, ciudadId: ciudades[i % 6].id }
  })
  const nom = ['Juan', 'Marcelo', 'Wilson', 'Rubén', 'Freddy', 'Édgar', 'Óscar', 'Nelson', 'Ramiro', 'Víctor', 'Limber']
  const ape = ['Mamani', 'Quispe', 'Rojas', 'Vargas', 'Flores', 'Choque', 'Gutiérrez', 'Condori', 'Salazar', 'Torrez', 'Arce', 'Villca', 'Montaño']
  const choferes = Array.from({ length: 66 }, (_, i) => ({ id: 'd' + i, nombre: `${nom[i % 11]} ${ape[i % 13]} ${ape[(i * 5 + 3) % 13]}`, ci: String(4100200 + i * 7919), telefono: '7' + String(1000000 + i * 91331).slice(0, 7), licencia: 'LC-' + String(4100200 + i * 7919), categoria: 'C', vence: i === 65 ? '2026-10-30' : i === 64 ? '2026-12-04' : `${2027 + i % 4}-${String(1 + i % 12).padStart(2, '0')}-15` }))
  const tanques = ([['t1', 'Garaje El Alto', 'lpz', 20000, 4000], ['t2', 'Garaje Quillacollo', 'cbb', 16000, 3000], ['t3', 'Garaje Doble Vía', 'scz', 24000, 5000], ['t4', 'Garaje Norte', 'oru', 8000, 3000]] as [string, string, string, number, number][])
    .map(([id, nombre, ciudadId, capacidad, minimo]) => ({ id, nombre, ciudadId, capacidad, minimo }))
  const estaciones: Estado['estaciones'] = [
    ...ciudades.map(c => ({ id: 'e-' + c.id, nombre: 'Estación Terminal ' + c.nombre, ciudadId: c.id, verificacion: 'factura' as const, precio: 17.95 })),
    ...([['lpz', 'Surtidor Altiplano'], ['cbb', 'Surtidor Valle'], ['scz', 'Surtidor Cuarto Anillo']] as const).map(([c, nombre]) => ({ id: 'a-' + c, nombre, ciudadId: c as string, verificacion: 'conciliacion' as const, precio: 17.95 })),
  ]
  const usuarios: Usuario[] = [
    { id: 'u1', nombre: 'Carla Méndez', cargo: 'Administrador general', rol: 'admin' },
    { id: 'u2', nombre: 'Jorge Peredo', cargo: 'Administrador regional', rol: 'regional', ciudadId: 'scz' },
    { id: 'u3', nombre: 'Lucía Antezana', cargo: 'Contable', rol: 'contable' },
    { id: 'u4', nombre: 'Daniel Ticona', cargo: 'Encargado de diésel 1', rol: 'encargado', ciudadId: 'lpz' },
    { id: 'u5', nombre: 'Rosa Camacho', cargo: 'Encargado de diésel 2', rol: 'encargado', ciudadId: 'cbb' },
  ]
  const s: Estado = { version: VERSION, hoy: sumarDias(HOY, -12), secuencia: 0, numeroVale: 10301, usuarios, ciudades, rutas, buses, choferes, tanques, estaciones, vales: [], movs: [], cobros: [] }
  const u = usuarios[0]
  for (const t of tanques) s.movs.push({ id: ++s.secuencia, fecha: s.hoy, cuenta: 'tanque', cuentaId: t.id, tipo: 'inicial', entrada: Math.round(t.capacidad * .55), salida: 0, detalle: 'Saldo inicial', usuario: u.nombre })

  const lugar = new Map(buses.map(b => [b.id, b.ciudadId]))
  const partir = (id: string) => { const v = s.vales.find(x => x.id === id)!; marcarPartida(s, u, id, 'partio'); lugar.set(v.busId, rutas.find(r => r.id === v.rutaId)!.destinoId) }

  for (let dia = 0; dia <= 12; dia++) {
    const ultimo = dia === 12
    for (const v of s.vales.filter(esAbierto)) if (!ultimo && rnd() < .75) partir(v.id)
    for (const v of s.vales.filter(v => v.estado === 'pendiente' && v.estacionId!.startsWith('e-') && v.fecha < s.hoy && v.partida === 'partio'))
      if (rnd() < .5) {
        const dif = rnd() < .14 ? uno([-8, -5, 4, 6, 10]) : 0, l = v.litros + dif
        verificarVale(s, u, v.id, { factura: String(40000 + s.secuencia * 3 + v.numero), litros: l, monto: Math.round(l * v.precio * 100) / 100, nota: dif ? 'Diferencia del surtidor' : '' })
      }
    if (dia % 3 === 1) for (const t of tanques) {
      const l = Math.min(Math.floor(t.capacidad - saldo(s, 'tanque', t.id)), t.id === 't4' ? 250 : 480)
      if (l > 0) abastecerTanque(s, u, { tanqueId: t.id, busId: uno(buses).id, litros: l, detalle: 'cargado en estación de servicio' })
    }
    const libres = buses.filter(b => !s.vales.some(v => v.busId === b.id && esAbierto(v))).map(b => ({ b, k: rnd() })).sort((x, y) => x.k - y.k).map(x => x.b).slice(0, ultimo ? 17 : ent(15, 20))
    const delDia: string[] = []
    for (const b of libres) {
      const c = lugar.get(b.id)!, ruta = uno(rutas.filter(r => r.origenId === c))
      const puntos = [...estaciones.filter(e => e.ciudadId === c).map(e => ['estacion', e.id] as const), ...tanques.filter(t => t.ciudadId === c).map(t => ['tanque', t.id] as const)]
      const [origen, origenId] = uno(puntos)
      const litros = Math.min(b.capacidad - 100, ruta.litrosRef + ent(0, 6) * 5)
      const v = emitirVale(s, u, { busId: b.id, rutaId: ruta.id, choferId: 'd' + b.id.slice(1), origen, origenId, litros })
      delDia.push(v.id)
      if (v.estacionId?.startsWith('a-') && rnd() < .88) {
        const dif = rnd() < .18 ? uno([-10, 5, 12]) : 0, l = v.litros + dif
        s.cobros.push({ id: 'c' + ++s.secuencia, estacionId: v.estacionId, fecha: s.hoy, numeroVale: v.numero, litros: l, monto: Math.round(l * 1795) / 100, estado: 'pendiente' })
      }
    }
    delDia.forEach((id, i) => {
      if (ultimo) { if (i < 6) partir(id) }
      else if (rnd() < (dia === 11 ? .72 : .87)) partir(id)
      else marcarPartida(s, u, id, 'no_partio')
    })
    if (dia === 5) { const v = s.vales.find(v => v.estado === 'pendiente' && esAbierto(v)); if (v) anularVale(s, u, v.id, 'bus en mantenimiento') }
    if (dia === 7 || dia === 11) {
      const de = buses.find(b => saldo(s, 'bus', b.id) > 100), a = buses.find(b => saldo(s, 'bus', b.id) === 0)
      if (de && a) traspasar(s, u, { deId: de.id, aId: a.id, litros: 40, motivo: 'apoyo en carretera' })
      const libre = buses.findLast(b => saldo(s, 'bus', b.id) === 0)
      if (libre) comprarSinFactura(s, u, { busId: libre.id, litros: 50, monto: 1000, lugar: 'Caracollo' })
    }
    if (dia === 6) for (const e of estaciones.filter(e => e.verificacion === 'conciliacion'))
      for (const f of comparar(s, e.id, '2026-01-01', sumarDias(s.hoy, -1)).filter(f => f.resultado === 'coincide')) conciliarFila(s, u, f, 'vale')
    if (!ultimo) s.hoy = sumarDias(s.hoy, 1)
  }
  // Cobros erróneos para mostrar la conciliación
  for (const e of estaciones.filter(e => e.verificacion === 'conciliacion')) {
    s.cobros.push({ id: 'c' + ++s.secuencia, estacionId: e.id, fecha: sumarDias(HOY, -2), numeroVale: 19000 + s.secuencia, litros: 180, monto: 3231, estado: 'pendiente' })
    const ya = s.vales.find(v => v.estacionId === e.id && v.estado === 'conciliado')
    if (ya) s.cobros.push({ id: 'c' + ++s.secuencia, estacionId: e.id, fecha: sumarDias(HOY, -3), numeroVale: ya.numero, litros: ya.litros, monto: montoVale(ya), estado: 'pendiente' })
  }
  return s
}
