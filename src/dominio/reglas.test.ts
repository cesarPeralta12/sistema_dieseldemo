import { beforeEach, expect, test } from 'vitest'
import { crearDemo } from './seed'
import * as R from './reglas'
import type { Estado, Usuario } from './tipos'

let s: Estado, u: Usuario, bus: string
const vacio = () => s.buses.find(b => R.saldo(s, 'bus', b.id) === 0 && !s.vales.some(v => v.busId === b.id && R.esAbierto(v)))!.id
beforeEach(() => { s = crearDemo(); u = s.usuarios[0]; bus = vacio() })
const emitir = (origenId = 'e-lpz', origen: 'estacion' | 'tanque' = 'estacion', litros = 260) =>
  R.emitirVale(s, u, { busId: bus, rutaId: 'r-lpz-cbb', choferId: 'd1', origen, origenId, litros })
const sb = () => R.saldo(s, 'bus', bus)

test('la demo no tiene saldos negativos y tiene 60 buses', () => {
  expect(s.buses).toHaveLength(60)
  for (const b of s.buses) for (const l of R.kardex(s, 'bus', b.id)) expect(l.saldo).toBeGreaterThanOrEqual(0)
  for (const t of s.tanques) { const x = R.saldo(s, 'tanque', t.id); expect(x).toBeGreaterThan(0); expect(x).toBeLessThanOrEqual(t.capacidad) }
})
test('el bus que no partió pasa a la hoja del día siguiente y sale al partir', () => {
  const v = emitir(); R.marcarPartida(s, u, v.id, 'no_partio')
  const esta = (f: string) => R.hojaControl(s, f, 'lpz').find(x => x.vale.id === v.id)
  s.hoy = R.sumarDias(s.hoy, 1)
  expect(esta(s.hoy)?.dias).toBe(1)
  R.marcarPartida(s, u, v.id, 'partio')
  expect(esta(v.fecha)?.partida).toBe('no_partio')
  expect(esta(R.sumarDias(s.hoy, 1))).toBeUndefined()
  expect(sb()).toBe(0)
})
test('recibe otro vale aunque tenga cargas sin verificar', () => {
  const v = emitir(); R.marcarPartida(s, u, v.id, 'partio')
  expect(() => R.emitirVale(s, u, { busId: bus, rutaId: 'r-cbb-scz', choferId: 'd1', origen: 'estacion', origenId: 'e-cbb', litros: 200 })).not.toThrow()
})
test('el ajuste antes de partir cambia el saldo, después de partir no', () => {
  const v = emitir(); R.verificarVale(s, u, v.id, { factura: 'X1', litros: 266, monto: 4774.7, nota: 'cargó de más' })
  expect(sb()).toBe(266)
  R.marcarPartida(s, u, v.id, 'partio'); expect(sb()).toBe(0)
  const w = emitir(); R.marcarPartida(s, u, w.id, 'partio')
  R.verificarVale(s, u, w.id, { factura: 'X2', litros: 250, monto: 4487.5, nota: 'cargó de menos' })
  expect(sb()).toBe(0)
})
test('una factura no respalda dos vales', () => {
  const v = emitir('e-lpz', 'estacion', 100), w = emitir('e-lpz', 'estacion', 100), d = { factura: 'Z', litros: 100, monto: 1795, nota: '' }
  R.verificarVale(s, u, v.id, d); expect(() => R.verificarVale(s, u, w.id, d)).toThrow('ya respalda')
})
test('el abastecimiento solo afecta al tanque', () => {
  const t = R.saldo(s, 'tanque', 't4'); R.abastecerTanque(s, u, { tanqueId: 't4', busId: bus, litros: 100, detalle: '' })
  expect(sb()).toBe(0); expect(R.saldo(s, 'tanque', 't4')).toBe(t + 100)
})
test('carga interna, anulación y traspaso cuadran', () => {
  const t = R.saldo(s, 'tanque', 't1'), v = emitir('t1', 'tanque', 200)
  expect(R.saldo(s, 'tanque', 't1')).toBe(t - 200)
  R.anularVale(s, u, v.id, 'error'); expect(R.saldo(s, 'tanque', 't1')).toBe(t); expect(sb()).toBe(0)
  emitir()
  const otro = s.buses.find(b => b.id !== bus && R.saldo(s, 'bus', b.id) === 0)!.id
  R.traspasar(s, u, { deId: bus, aId: otro, litros: 60, motivo: 'x' })
  expect(sb()).toBe(200); expect(R.saldo(s, 'bus', otro)).toBe(60)
})
test('la conciliación detecta los cuatro casos', () => {
  const vs = [100, 101, 102].map(l => { bus = vacio(); return emitir('a-lpz', 'estacion', l) })
  s.cobros = []
  R.agregarCobros(s, u, 'a-lpz', `${s.hoy};${vs[0].numero};100;1795\n${s.hoy};${vs[1].numero};110;1974.5\n${s.hoy};99999;50;897.5`)
  const f = R.comparar(s, 'a-lpz', s.hoy, s.hoy), de = (x: number) => f.find(y => y.vale?.id === vs[x].id)!
  expect([de(0), de(1), de(2)].map(x => x.resultado)).toEqual(['coincide', 'diferencia', 'no_cobrado'])
  expect(f.filter(x => x.resultado === 'no_emitido')).toHaveLength(1)
  R.conciliarFila(s, u, de(1), 'cobro'); expect(vs[1].litrosReales).toBe(110)
})
test('los permisos y la ciudad se respetan', () => {
  u = s.usuarios[2]; expect(() => emitir()).toThrow('permiso')
  u = s.usuarios[4]; expect(() => emitir()).toThrow('tu ciudad')
})
