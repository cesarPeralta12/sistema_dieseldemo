import { useState } from 'react'
import { useApp } from '../store'
import { adeudado, agregarCobros, comparar, conciliarFila, diasEntre, kardex, litrosVale, montoVale, puede, saldo, sumarDias, verificarVale, type Fila, type Resultado } from '../dominio/reglas'
import type { TipoMov, Vale } from '../dominio/tipos'
import { Campo, Elegir, Marca, Modal, Titulo, Vacio, bs, de, fecha, num } from '../ui/ui'

const TIPO: Record<TipoMov, string> = { vale: 'Vale en estación', surtidor: 'Surtidor interno', traspaso: 'Traspaso', compra_sin_factura: 'Compra sin factura', abastecimiento: 'Abastecimiento', salida_ruta: 'Salida a ruta', ajuste: 'Ajuste', anulacion: 'Anulación', inicial: 'Saldo inicial' }

export function Kardex({ cuenta }: { cuenta: 'bus' | 'tanque' }) {
  const { s } = useApp()
  const [id, setId] = useState(cuenta === 'bus' ? s.buses[0].id : s.tanques[0].id), [tipo, setTipo] = useState('')
  const [desde, setDesde] = useState(sumarDias(s.hoy, -30)), [hasta, setHasta] = useState(s.hoy)
  const todo = kardex(s, cuenta, id), l = todo.filter(m => m.fecha >= desde && m.fecha <= hasta && (!tipo || m.tipo === tipo))
  const inicial = todo.filter(m => m.fecha < desde).at(-1)?.saldo ?? 0
  const bus = s.buses.find(b => b.id === id), tq = s.tanques.find(t => t.id === id), actual = saldo(s, cuenta, id)
  const cap = bus?.capacidad ?? tq?.capacidad ?? 1
  const sum = (k: 'entrada' | 'salida') => l.reduce((a, m) => a + m[k], 0)
  return <><Titulo t={cuenta === 'bus' ? 'Kardex por bus' : 'Kardex por surtidor interno'} sub={bus ? `${bus.marca} ${bus.modelo}, ${bus.placa}` : tq && `${de.ciudad(s, tq.ciudadId)}, mínimo ${num(tq.minimo)} L`}>
    <Elegir vacio={null} v={id} on={setId} ops={cuenta === 'bus' ? s.buses.map(b => [b.id, 'Bus ' + b.interno]) : s.tanques.map(t => [t.id, t.nombre])} />
    <input type="date" aria-label="Desde" value={desde} onChange={e => setDesde(e.target.value)} /><input type="date" aria-label="Hasta" value={hasta} onChange={e => setHasta(e.target.value)} />
    <Elegir v={tipo} on={setTipo} vacio="Todos los tipos" ops={Object.entries(TIPO)} /></Titulo>
    <div className="nivel"><div className="nivel-barra"><i style={{ width: Math.min(100, actual / cap * 100) + '%' }} className={tq && actual < tq.minimo ? 'bajo' : ''} /></div><p><b>{num(actual)} L</b> de saldo actual, capacidad {num(cap)} L</p></div>
    <div className="tabla"><table className="kardex"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Ruta</th>{cuenta === 'tanque' && <th>Bus</th>}<th>Registró</th><th className="n">Entrada</th><th className="n">Salida</th><th className="n">Saldo</th></tr></thead>
      <tbody><tr className="suave"><td colSpan={cuenta === 'tanque' ? 8 : 7}>Saldo anterior</td><td className="n">{num(inicial)}</td></tr>
        {l.map(m => <tr key={m.id}><td>{fecha(m.fecha)}</td><td>{TIPO[m.tipo]}</td><td>{m.detalle}</td><td>{m.rutaId && de.ruta(s, m.rutaId)}</td>{cuenta === 'tanque' && <td>{m.busRefId && <b className="interno">{de.bus(s, m.busRefId).interno}</b>}</td>}<td>{m.usuario}</td><td className="n t-verde">{m.entrada ? num(m.entrada) : ''}</td><td className="n t-rojo">{m.salida ? num(m.salida) : ''}</td><td className="n"><b>{num(m.saldo)}</b></td></tr>)}</tbody>
      <tfoot><tr><td colSpan={cuenta === 'tanque' ? 6 : 5}>Totales del periodo</td><td className="n">{num(sum('entrada'))}</td><td className="n">{num(sum('salida'))}</td><td /></tr></tfoot></table></div></>
}

export function Verificacion() {
  const { s, u } = useApp(), [q, setQ] = useState(''), [sel, setSel] = useState('')
  const l = s.vales.filter(v => v.estado === 'pendiente' && s.estaciones.find(e => e.id === v.estacionId)?.verificacion === 'factura' && `${v.numero} ${de.bus(s, v.busId).interno} ${de.chofer(s, v.choferId)}`.toLowerCase().includes(q.toLowerCase()))
  const v = s.vales.find(x => x.id === sel)
  return <><Titulo t="Verificar facturas" sub={`${l.length} vales esperan su factura. Se recibe en cualquier sucursal.`}><input type="search" placeholder="Buscar vale, bus o chofer" value={q} onChange={e => setQ(e.target.value)} /></Titulo>
    {l.length ? <div className="tabla"><table><thead><tr><th>Vale</th><th>Emitido</th><th>Bus</th><th>Chofer</th><th>Estación</th><th className="n">Litros</th><th className="n">Monto</th><th /></tr></thead><tbody>{l.map(v => { const n = diasEntre(v.fecha, s.hoy); return <tr key={v.id}><td><b>{v.numero}</b></td><td>{fecha(v.fecha)} {n > 7 && <Marca c="rojo">{n} días</Marca>}</td><td><b className="interno">{de.bus(s, v.busId).interno}</b></td><td>{de.chofer(s, v.choferId)}</td><td>{de.origen(s, v)}</td><td className="n">{num(v.litros)}</td><td className="n">{bs(montoVale(v))}</td><td className="fila-acc">{puede(u, 'verificar') && <button onClick={() => setSel(v.id)}>Verificar</button>}</td></tr> })}</tbody></table></div> : <Vacio>No quedan vales por verificar.</Vacio>}
    {v && <Verificar v={v} cerrar={() => setSel('')} />}</>
}
function Verificar({ v, cerrar }: { v: Vale; cerrar(): void }) {
  const { s, ejecutar } = useApp()
  const [d, setD] = useState({ factura: '', litros: String(v.litros), monto: String(montoVale(v)), nota: '' })
  const dif = Math.round((+d.litros - v.litros) * 100) / 100, difM = Math.round((+d.monto - montoVale(v)) * 100) / 100
  return <Modal t={`Verificar vale ${v.numero}`} cerrar={cerrar}>
    <p className="resumen">Bus {de.bus(s, v.busId).interno}, {de.origen(s, v)}. El vale dice {num(v.litros)} L y {bs(montoVale(v))}.</p>
    <form className="form" onSubmit={e => { e.preventDefault(); if (ejecutar((s, u) => verificarVale(s, u, v.id, { factura: d.factura, litros: +d.litros, monto: +d.monto, nota: d.nota }), dif ? 'Vale verificado y ajuste anotado' : 'Vale verificado')) cerrar() }}>
      <Campo l="Número de factura"><input autoFocus value={d.factura} onChange={e => setD({ ...d, factura: e.target.value })} /></Campo>
      <Campo l="Litros según factura"><input type="number" step="0.01" value={d.litros} onChange={e => setD({ ...d, litros: e.target.value, monto: String(Math.round(+e.target.value * v.precio * 100) / 100) })} /></Campo>
      <Campo l="Monto según factura (Bs)"><input type="number" step="0.01" value={d.monto} onChange={e => setD({ ...d, monto: e.target.value })} /></Campo>
      {(dif !== 0 || difM !== 0) && <><p className="diferencia">Diferencia: {dif > 0 ? '+' : ''}{num(dif)} L y {difM > 0 ? '+' : ''}{bs(difM)}. {v.partida === 'partio' ? 'El bus ya partió, así que su saldo actual no cambia.' : 'El saldo del bus se ajusta.'}</p><Campo l="Motivo del ajuste"><input value={d.nota} onChange={e => setD({ ...d, nota: e.target.value })} /></Campo></>}
      <button className="primario">Verificar vale</button></form></Modal>
}

const RES: Record<Resultado, [string, string]> = { coincide: ['Coincide', 'verde'], diferencia: ['Diferencia', 'ambar'], no_emitido: ['Cobrado, no emitido', 'rojo'], no_cobrado: ['Emitido, no cobrado', 'gris'] }
export function Conciliacion() {
  const { s, u, ejecutar } = useApp(), al = s.estaciones.filter(e => e.verificacion === 'conciliacion')
  const [id, setId] = useState(al[0]?.id ?? ''), [desde, setDesde] = useState(sumarDias(s.hoy, -14)), [hasta, setHasta] = useState(s.hoy), [f, setF] = useState<Resultado | ''>(''), [carga, setCarga] = useState(false), [txt, setTxt] = useState('')
  const filas = comparar(s, id, desde, hasta), l = filas.filter(x => !f || x.resultado === f), ok = filas.filter(x => x.resultado === 'coincide'), edit = puede(u, 'conciliar')
  const hacer = (x: Fila, m: 'cobro' | 'vale' | 'rechazar') => ejecutar((s, u) => conciliarFila(s, u, x, m), m === 'rechazar' ? 'Cobro rechazado' : 'Vale conciliado')
  return <><Titulo t="Conciliar estación aliada" sub="Compara lo que cobra la estación con los vales emitidos">
    <Elegir vacio={null} v={id} on={setId} ops={al.map(e => [e.id, e.nombre])} /><input type="date" aria-label="Desde" value={desde} onChange={e => setDesde(e.target.value)} /><input type="date" aria-label="Hasta" value={hasta} onChange={e => setHasta(e.target.value)} />
    {edit && <button onClick={() => setCarga(true)}>Cargar estado de cuenta</button>}
    {edit && ok.length > 0 && <button className="primario" onClick={() => ejecutar((s, u) => ok.forEach(x => conciliarFila(s, u, x, 'vale')), `${ok.length} vales conciliados`)}>Conciliar {ok.length} que coinciden</button>}</Titulo>
    <div className="casos">{(Object.keys(RES) as Resultado[]).map(r => { const n = filas.filter(x => x.resultado === r); return <button key={r} className={RES[r][1]} aria-pressed={f === r} onClick={() => setF(f === r ? '' : r)}><b>{n.length}</b><span>{RES[r][0]}</span><small>{bs(n.reduce((a, x) => a + (x.cobro?.monto ?? montoVale(x.vale!)), 0))}</small></button> })}</div>
    {l.length ? <div className="tabla"><table><thead><tr><th>Vale</th><th>Resultado</th><th>Bus</th><th className="n">Litros vale</th><th className="n">Litros cobro</th><th className="n">Monto vale</th><th className="n">Monto cobro</th><th className="n">Diferencia</th><th /></tr></thead><tbody>{l.map(x => <tr key={x.clave}><td><b>{x.vale?.numero ?? x.cobro?.numeroVale}</b>{x.motivo && <small>{x.motivo}</small>}</td><td><Marca c={RES[x.resultado][1]}>{RES[x.resultado][0]}</Marca></td><td>{x.vale && <b className="interno">{de.bus(s, x.vale.busId).interno}</b>}</td><td className="n">{x.vale && num(x.vale.litros)}</td><td className="n">{x.cobro && num(x.cobro.litros)}</td><td className="n">{x.vale && bs(montoVale(x.vale))}</td><td className="n">{x.cobro && bs(x.cobro.monto)}</td><td className="n">{x.resultado === 'diferencia' && `${num(x.difLitros)} L, ${bs(x.difMonto)}`}</td>
      <td className="fila-acc">{edit && <>{x.resultado === 'coincide' && <button onClick={() => hacer(x, 'vale')}>Conciliar</button>}{x.resultado === 'diferencia' && <><button onClick={() => hacer(x, 'cobro')}>Aceptar cobro</button><button onClick={() => hacer(x, 'vale')}>Mantener vale</button></>}{x.resultado === 'no_emitido' && <button className="peligro" onClick={() => hacer(x, 'rechazar')}>Rechazar</button>}</>}</td></tr>)}</tbody></table></div> : <Vacio>No hay nada por conciliar en este rango.</Vacio>}
    {carga && <Modal t="Cargar estado de cuenta" cerrar={() => setCarga(false)}><form className="form" onSubmit={e => { e.preventDefault(); if (ejecutar((s, u) => agregarCobros(s, u, id, txt), 'Estado de cuenta cargado')) { setCarga(false); setTxt('') } }}><Campo l="Una línea por cobro: fecha;vale;litros;monto"><textarea rows={8} value={txt} placeholder={`${s.hoy};10450;260;4667`} onChange={e => setTxt(e.target.value)} /></Campo><button className="primario">Cargar cobros</button></form></Modal>}</>
}

export function Adeudado() {
  const { s } = useApp(), [desde, setDesde] = useState(sumarDias(s.hoy, -14)), [hasta, setHasta] = useState(s.hoy), l = adeudado(s, desde, hasta)
  return <><Titulo t="Adeudado por estación" sub="Vales emitidos en el rango. No descuenta pagos."><input type="date" aria-label="Desde" value={desde} onChange={e => setDesde(e.target.value)} /><input type="date" aria-label="Hasta" value={hasta} onChange={e => setHasta(e.target.value)} /><button className="imprimir" onClick={() => window.print()}>Imprimir</button></Titulo>
    <div className="tabla"><table><thead><tr><th>Estación</th><th>Ciudad</th><th className="n">Vales conciliados</th><th className="n">Monto conciliado</th><th className="n">Vales pendientes</th><th className="n">Monto pendiente</th><th className="n">Total</th></tr></thead><tbody>{l.map(x => <tr key={x.estacion.id}><td><b>{x.estacion.nombre}</b></td><td>{de.ciudad(s, x.estacion.ciudadId)}</td><td className="n">{x.conciliado.n}</td><td className="n">{bs(x.conciliado.monto)}</td><td className="n">{x.pendiente.n}</td><td className="n">{bs(x.pendiente.monto)}</td><td className="n"><b>{bs(x.total)}</b></td></tr>)}</tbody><tfoot><tr><td colSpan={6}>Total</td><td className="n">{bs(l.reduce((a, x) => a + x.total, 0))}</td></tr></tfoot></table></div></>
}

const ESTADOS = [['pendiente', 'Sin cerrar', 'ambar'], ['verificado', 'Verificado', 'verde'], ['conciliado', 'Conciliado', 'verde2'], ['interno', 'Surtidor interno', 'gris']] as const

export function Resumen() {
  const { s } = useApp()
  const [rango, setRango] = useState('14'), [ciudad, setCiudad] = useState('')
  const n = +rango, desde = sumarDias(s.hoy, 1 - n)
  const vs = s.vales.filter(v => v.estado !== 'anulado' && v.fecha >= desde && (!ciudad || v.ciudadId === ciudad))
  const litros = vs.reduce((a, v) => a + litrosVale(v), 0), importe = vs.reduce((a, v) => a + (v.precio ? montoVale(v) : 0), 0)
  const dias = Array.from({ length: n }, (_, i) => sumarDias(desde, i)).map(f => ({ f, l: vs.filter(v => v.fecha === f).reduce((a, v) => a + litrosVale(v), 0) }))
  const maximo = Math.max(...dias.map(d => d.l)), tope = Math.max(1000, Math.ceil(maximo / 1000) * 1000)
  const porCiudad = s.ciudades.map(c => ({ c, l: vs.filter(v => v.ciudadId === c.id).reduce((a, v) => a + litrosVale(v), 0) })).filter(x => x.l > 0).sort((a, b) => b.l - a.l)
  const estados = ESTADOS.map(([e, nom, c]) => ({ e, nom, c, n: vs.filter(v => v.estado === e).length })), total = Math.max(1, vs.length)
  const deuda = adeudado(s, desde, s.hoy)
  const arr = s.vales.filter(v => v.estado !== 'anulado' && v.partida !== 'partio' && v.fecha < s.hoy)
  const viejos = s.vales.filter(v => v.estado === 'pendiente' && diasEntre(v.fecha, s.hoy) > 7)
  return <>
    <Titulo t="Resumen" sub={`Del ${fecha(desde)} al ${fecha(s.hoy)}`}>
      <Elegir vacio="Todas las ciudades" v={ciudad} on={setCiudad} ops={s.ciudades.map(c => [c.id, c.nombre])} />
      <Elegir vacio={null} v={rango} on={setRango} ops={[['7', 'Últimos 7 días'], ['14', 'Últimos 14 días'], ['30', 'Últimos 30 días']]} />
    </Titulo>
    <div className="kpis">
      <div><b>{num(litros)}</b><span>litros entregados</span></div>
      <div><b>{bs(importe)}</b><span>importe en estaciones</span></div>
      <div><b>{vs.length}</b><span>vales emitidos</span></div>
      <div><b>{bs(deuda.reduce((a, x) => a + x.total, 0))}</b><span>adeudado a aliadas</span></div>
    </div>
    <p className="nota">Litros entregados con vale, no consumo real. Los saldos son administrativos, no medición física.</p>
    <div className="paneles">
      <section className="panel ancho">
        <h2>Litros entregados por día</h2>
        <div className="grafico" role="img" aria-label={`Litros por día, máximo ${num(maximo)}`}>
          {[1, .5, 0].map(k => <div key={k} className="guia" style={{ bottom: k * 100 + '%' }}><span>{num(tope * k)}</span></div>)}
          <div className="barras-dia">{dias.map(d => <div key={d.f} title={`${fecha(d.f)}: ${num(d.l)} L`}>
            <i style={{ height: d.l / tope * 100 + '%' }} className={d.f === s.hoy ? 'hoy' : ''} /><small>{+d.f.slice(8)}</small>
          </div>)}</div>
        </div>
      </section>
      <section className="panel">
        <h2>Por ciudad</h2>
        <ul className="barras-h">{porCiudad.map(x => <li key={x.c.id}><span>{x.c.nombre}</span><div><i style={{ width: x.l / porCiudad[0].l * 100 + '%' }} /></div><b>{num(x.l)} L</b></li>)}</ul>
        {!porCiudad.length && <Vacio>Sin vales en el periodo.</Vacio>}
      </section>
      <section className="panel">
        <h2>Vales por estado</h2>
        <div className="segmentos">{estados.map(x => x.n > 0 && <i key={x.e} className={x.c} style={{ flexGrow: x.n }} title={`${x.nom}: ${x.n}`} />)}</div>
        <ul className="leyenda">{estados.map(x => <li key={x.e}><i className={x.c} />{x.nom}<b>{x.n}</b><span>{Math.round(x.n / total * 100)} %</span></li>)}</ul>
      </section>
      <section className="panel ancho">
        <h2>Tanques de garaje</h2>
        <div className="tanques">{s.tanques.map(t => {
          const x = saldo(s, 'tanque', t.id), b = x < t.minimo
          return <div key={t.id} className="tanque">
            <div className="cilindro" role="img" aria-label={`${Math.round(x / t.capacidad * 100)} % lleno`}><i className={b ? 'bajo' : ''} style={{ height: x / t.capacidad * 100 + '%' }} /><u style={{ bottom: t.minimo / t.capacidad * 100 + '%' }} /></div>
            <div><b>{t.nombre}</b><span>{de.ciudad(s, t.ciudadId)}</span><strong>{num(x)} L</strong><span>de {num(t.capacidad)} L</span>{b && <Marca c="rojo">Bajo el mínimo</Marca>}</div>
          </div>
        })}</div>
      </section>
      <section className="panel">
        <h2>Adeudado por estación</h2>
        <ul className="lista">{deuda.map(x => <li key={x.estacion.id}><div><b>{x.estacion.nombre}</b><small>{bs(x.conciliado.monto)} conciliado, {bs(x.pendiente.monto)} pendiente</small></div><b>{bs(x.total)}</b></li>)}</ul>
      </section>
      <section className="panel">
        <h2>Por atender</h2>
        <ul className="lista">
          <li><b className="cifra">{arr.length}</b><div><b>vales de buses que no partieron</b><small>Vienen de días anteriores</small></div></li>
          <li><b className="cifra">{s.vales.filter(v => v.estado === 'pendiente').length}</b><div><b>vales sin cerrar</b><small>{viejos.length} tienen más de siete días</small></div></li>
          <li><b className="cifra">{s.cobros.filter(c => c.estado === 'pendiente').length}</b><div><b>cobros de aliadas por conciliar</b></div></li>
        </ul>
      </section>
    </div>
  </>
}
