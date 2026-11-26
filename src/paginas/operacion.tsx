import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus, Printer } from 'lucide-react'
import { useApp } from '../store'
import { abastecerTanque, anularVale, comprarSinFactura, emitirVale, enAlcance, esAbierto, hojaControl, litrosVale, marcarPartida, puede, saldo, sumarDias, traspasar } from '../dominio/reglas'
import type { Vale } from '../dominio/tipos'
import { Campo, Elegir, Marca, MarcaEstado, MarcaPartida, Modal, Ticket, Titulo, Vacio, de, fecha, num } from '../ui/ui'

export function Hoja() {
  const { s, u, ejecutar } = useApp()
  const [f, setF] = useState(s.hoy), [c, setC] = useState(u.ciudadId ?? ''), [nuevo, setNuevo] = useState(false), [ver, setVer] = useState('')
  const todas = hojaControl(s, f), filas = c ? todas.filter(x => x.vale.ciudadId === c) : todas
  const vivas = filas.filter(x => x.vale.estado !== 'anulado')
  const ciudades = s.ciudades.filter(x => enAlcance(u, x.id))
  const v = s.vales.find(x => x.id === ver)
  return <>
    <Titulo t="Hoja de control" sub={fecha(f, true)}>
      <div className="dia"><button aria-label="Día anterior" onClick={() => setF(sumarDias(f, -1))}><ChevronLeft size={18} /></button>
        <input type="date" aria-label="Fecha" value={f} max={s.hoy} onChange={e => e.target.value && setF(e.target.value)} />
        <button aria-label="Día siguiente" disabled={f >= s.hoy} onClick={() => setF(sumarDias(f, 1))}><ChevronRight size={18} /></button></div>
      {puede(u, 'emitir') && <button className="primario" onClick={() => setNuevo(true)}><Plus size={18} />Emitir vale</button>}
    </Titulo>
    <nav className="ciudades" aria-label="Ciudad">
      {!u.ciudadId && <button aria-pressed={!c} onClick={() => setC('')}>Todas <i>{todas.length}</i></button>}
      {ciudades.map(x => { const n = todas.filter(t => t.vale.ciudadId === x.id), arr = n.some(t => t.dias > 0); return <button key={x.id} aria-pressed={c === x.id} onClick={() => setC(x.id)}>{x.nombre} <i className={arr ? 'arr' : ''}>{n.length}</i></button> })}
    </nav>
    <div className="kpis">
      <div><b>{vivas.length}</b><span>vales en la hoja</span></div>
      <div><b>{num(vivas.reduce((a, x) => a + litrosVale(x.vale), 0))}</b><span>litros asignados</span></div>
      <div><b>{vivas.filter(x => x.partida === 'partio').length}</b><span>buses partieron</span></div>
      <div className={vivas.some(x => x.dias > 0) ? 'alerta' : ''}><b>{vivas.filter(x => x.dias > 0).length}</b><span>vienen de días anteriores</span></div>
    </div>
    {filas.length === 0 ? <Vacio>No hay vales para esta ciudad y fecha.</Vacio> :
      <div className="tabla"><table><thead><tr><th>Vale</th><th>Bus</th><th>Ruta</th><th>Chofer</th><th className="n">Litros</th><th>Partida</th><th /></tr></thead>
        <tbody>{filas.map(({ vale: x, dias, partida }) => <tr key={x.id} className={x.estado === 'anulado' ? 'anulado' : dias ? 'arrastre' : ''}>
          <td><button className="enlace" onClick={() => setVer(x.id)}>{x.numero}</button>{dias > 0 && <small>Arrastra {dias} {dias === 1 ? 'día' : 'días'}</small>}</td>
          <td><b className="interno">{de.bus(s, x.busId).interno}</b></td><td>{de.ruta(s, x.rutaId)}<span className="sec">{de.origen(s, x)}</span></td><td className="recorte" title={de.chofer(s, x.choferId)}>{de.chofer(s, x.choferId)}</td>
          <td className="n">{num(litrosVale(x))}</td><td>{x.estado === 'anulado' ? <MarcaEstado e="anulado" /> : <MarcaPartida p={partida} />}</td>
          <td className="fila-acc">{f === s.hoy && esAbierto(x) && puede(u, 'partida') && enAlcance(u, x.ciudadId) && <>
            <button className="ok" onClick={() => ejecutar((s, u) => marcarPartida(s, u, x.id, 'partio'), `Bus ${de.bus(s, x.busId).interno}: partida registrada`)}><Check size={15} strokeWidth={2.5} />Partió</button>
            {x.partida !== 'no_partio' && <button onClick={() => ejecutar((s, u) => marcarPartida(s, u, x.id, 'no_partio'), 'Queda para la hoja de mañana')}>No partió</button>}</>}</td>
        </tr>)}</tbody></table></div>}
    {nuevo && <Emitir cerrar={() => setNuevo(false)} />}
    {v && <DetalleVale v={v} cerrar={() => setVer('')} />}
  </>
}

function Emitir({ cerrar }: { cerrar(): void }) {
  const { s, u, ejecutar } = useApp()
  const [d, setD] = useState({ busId: '', rutaId: '', choferId: '', punto: '', litros: '' })
  const ruta = s.rutas.find(r => r.id === d.rutaId), bus = s.buses.find(b => b.id === d.busId)
  const [origen, origenId] = d.punto.split(':') as ['estacion' | 'tanque', string]
  const est = origen === 'estacion' ? s.estaciones.find(e => e.id === origenId) : undefined
  const puntos: [string, string][] = ruta ? [
    ...s.estaciones.filter(e => e.ciudadId === ruta.origenId).map(e => ['estacion:' + e.id, e.nombre + (e.verificacion === 'conciliacion' ? ' (aliada)' : '')] as [string, string]),
    ...s.tanques.filter(t => t.ciudadId === ruta.origenId).map(t => ['tanque:' + t.id, `${t.nombre} (interno, ${num(saldo(s, 'tanque', t.id))} L)`] as [string, string])] : []
  const litros = +d.litros || 0
  return <Modal t="Emitir vale" cerrar={cerrar}><div className="emitir">
    <form className="form" onSubmit={e => { e.preventDefault(); if (ejecutar((s, u) => emitirVale(s, u, { busId: d.busId, rutaId: d.rutaId, choferId: d.choferId, origen, origenId, litros }), `Vale ${s.numeroVale} emitido`)) cerrar() }}>
      <Campo l="Ruta"><Elegir v={d.rutaId} on={v => { const r = s.rutas.find(r => r.id === v); setD({ ...d, rutaId: v, punto: '', litros: r ? String(r.litrosRef) : '' }) }} ops={s.rutas.filter(r => enAlcance(u, r.origenId)).map(r => [r.id, de.ruta(s, r.id)])} /></Campo>
      <Campo l="Bus" ayuda={bus && `${bus.marca} ${bus.modelo}. Saldo ${num(saldo(s, 'bus', bus.id))} L de ${bus.capacidad} L`}><Elegir v={d.busId} on={v => setD({ ...d, busId: v })} ops={s.buses.map(b => [b.id, `${b.interno}, ${b.placa}`])} /></Campo>
      <Campo l="Chofer"><Elegir v={d.choferId} on={v => setD({ ...d, choferId: v })} ops={s.choferes.map(c => [c.id, c.nombre + (c.vence < s.hoy ? ' (licencia vencida)' : '')])} /></Campo>
      <Campo l="Carga en" ayuda={ruta ? undefined : 'Primero selecciona la ruta'}><Elegir v={d.punto} on={v => setD({ ...d, punto: v })} ops={puntos} /></Campo>
      <Campo l="Litros" ayuda={ruta && (litros > ruta.litrosRef * 1.2 ? `Supera en más de 20 % la referencia de ${ruta.litrosRef} L` : `Referencia de la ruta: ${ruta.litrosRef} L`)}><input inputMode="decimal" type="number" step="0.01" value={d.litros} onChange={e => setD({ ...d, litros: e.target.value })} /></Campo>
      {est && <Campo l="Equivale a (Bs)"><input type="number" step="0.01" key={est.id + d.litros} defaultValue={(litros * est.precio).toFixed(2)} onBlur={e => { const n = +e.target.value; if (n > 0) setD({ ...d, litros: String(Math.round(n / est.precio * 100) / 100) }) }} /></Campo>}
      <button className="primario">Emitir vale</button>
    </form>
    <Ticket s={s} v={{ numero: s.numeroVale, fecha: s.hoy, ciudadId: '', busId: d.busId, rutaId: d.rutaId, choferId: d.choferId, estacionId: est?.id, tanqueId: origen === 'tanque' ? origenId : undefined, litros, precio: est?.precio ?? 0, partida: 'pendiente', estado: 'pendiente' }} />
  </div></Modal>
}

function DetalleVale({ v, cerrar }: { v: Vale; cerrar(): void }) {
  const { s, u, ejecutar } = useApp(), [motivo, setMotivo] = useState('')
  return <Modal t={`Vale ${v.numero}`} cerrar={cerrar}>
    <div className="imprimible"><Ticket s={s} v={v} /></div>
    <p className="resumen"><MarcaEstado e={v.estado} /> Emitido por {v.emitidoPor}. {v.factura && `Factura ${v.factura}. `}{v.litrosReales !== undefined && v.litrosReales !== v.litros && `Vale de ${num(v.litros)} L, carga real de ${num(v.litrosReales)} L. `}{v.nota}</p>
    <div className="acciones"><button className="imprimir" onClick={() => window.print()}><Printer size={16} />Imprimir</button></div>
    {esAbierto(v) && puede(u, 'anular') && enAlcance(u, v.ciudadId) && (v.estado === 'pendiente' || v.estado === 'interno') && <form className="form linea" onSubmit={e => { e.preventDefault(); if (ejecutar((s, u) => anularVale(s, u, v.id, motivo), 'Vale anulado')) cerrar() }}>
      <Campo l="Motivo de anulación"><input value={motivo} onChange={e => setMotivo(e.target.value)} /></Campo><button className="peligro">Anular vale</button></form>}
  </Modal>
}

export function Vales() {
  const { s, u } = useApp(), [q, setQ] = useState(''), [e, setE] = useState(''), [ver, setVer] = useState('')
  const l = s.vales.filter(v => enAlcance(u, v.ciudadId) && (!e || v.estado === e) && `${v.numero} ${de.bus(s, v.busId).interno} ${de.chofer(s, v.choferId)} ${de.ruta(s, v.rutaId)} ${v.factura ?? ''}`.toLowerCase().includes(q.toLowerCase())).reverse()
  const v = s.vales.find(x => x.id === ver)
  return <><Titulo t="Vales emitidos" sub={`${l.length} vales`}><input type="search" placeholder="Buscar vale, bus, chofer o factura" value={q} onChange={x => setQ(x.target.value)} />
    <Elegir v={e} on={setE} vacio="Todos los estados" ops={[['pendiente', 'Sin cerrar'], ['verificado', 'Verificado'], ['conciliado', 'Conciliado'], ['interno', 'Surtidor interno'], ['anulado', 'Anulado']]} /></Titulo>
    <div className="tabla"><table><thead><tr><th>Vale</th><th>Fecha</th><th>Bus</th><th>Ruta</th><th>Chofer</th><th className="n">Litros</th><th>Partida</th><th>Estado</th></tr></thead><tbody>
      {l.slice(0, 120).map(v => <tr key={v.id}><td><button className="enlace" onClick={() => setVer(v.id)}>{v.numero}</button></td><td>{fecha(v.fecha)}</td><td><b className="interno">{de.bus(s, v.busId).interno}</b></td><td>{de.ruta(s, v.rutaId)}<span className="sec">{de.origen(s, v)}</span></td><td className="recorte" title={de.chofer(s, v.choferId)}>{de.chofer(s, v.choferId)}</td><td className="n">{num(litrosVale(v))}</td><td>{v.estado !== 'anulado' && <MarcaPartida p={v.partida} />}</td><td><MarcaEstado e={v.estado} /></td></tr>)}
    </tbody></table></div>{l.length > 120 && <p className="resumen">Se muestran los 120 más recientes. Usa la búsqueda para ver los demás.</p>}
    {v && <DetalleVale v={v} cerrar={() => setVer('')} />}</>
}

export function Movimientos() {
  const { s, u, ejecutar } = useApp()
  const [k, setK] = useState<'traspaso' | 'compra' | 'tanque'>('traspaso')
  const ini = { a: '', b: '', l: '', m: '', t: '' }, [d, setD] = useState(ini)
  const p = (x: Partial<typeof ini>) => setD({ ...d, ...x })
  const buses = (conSaldo: boolean) => s.buses.map(b => [b.id, saldo(s, 'bus', b.id), b.interno] as const).filter(x => !conSaldo || x[1] > 0).map(x => [x[0], `Bus ${x[2]}, saldo ${num(x[1])} L`] as [string, string])
  const enviar = () => {
    const l = +d.l
    const ok = k === 'traspaso' ? ejecutar((s, u) => traspasar(s, u, { deId: d.a, aId: d.b, litros: l, motivo: d.t }), 'Traspaso registrado')
      : k === 'compra' ? ejecutar((s, u) => comprarSinFactura(s, u, { busId: d.a, litros: l, monto: +d.m, lugar: d.t }), 'Compra registrada')
      : ejecutar((s, u) => abastecerTanque(s, u, { tanqueId: d.b, busId: d.a, litros: l, detalle: d.t }), 'Abastecimiento registrado')
    if (ok) setD(ini)
  }
  const rec = s.movs.filter(m => ['traspaso', 'compra_sin_factura', 'abastecimiento'].includes(m.tipo)).reverse().slice(0, 14)
  const nota = { traspaso: 'Sale del kardex de un bus y entra al del otro.', compra: 'Entra al kardex del bus.', tanque: 'Entra al kardex del tanque. El saldo del bus no cambia.' }[k]
  return <><Titulo t="Otros movimientos" sub="Todo lo que entra o sale sin un vale" />
    <div className="dos"><section>{puede(u, 'movimientos') ? <>
      <nav className="ciudades">{([['traspaso', 'Traspaso entre buses'], ['compra', 'Compra sin factura'], ['tanque', 'Abastecer tanque']] as const).map(([a, b]) => <button key={a} aria-pressed={k === a} onClick={() => { setK(a); setD(ini) }}>{b}</button>)}</nav>
      <p className="resumen">{nota}</p>
      <form className="form" onSubmit={e => { e.preventDefault(); enviar() }}>
        <Campo l={k === 'traspaso' ? 'Bus que entrega' : k === 'compra' ? 'Bus' : 'Bus que abastece'}><Elegir v={d.a} on={a => p({ a })} ops={buses(k === 'traspaso')} /></Campo>
        {k === 'traspaso' && <Campo l="Bus que recibe"><Elegir v={d.b} on={b => p({ b })} ops={buses(false)} /></Campo>}
        {k === 'tanque' && <Campo l="Tanque"><Elegir v={d.b} on={b => p({ b })} ops={s.tanques.filter(t => enAlcance(u, t.ciudadId)).map(t => [t.id, `${t.nombre}, ${num(saldo(s, 'tanque', t.id))} de ${num(t.capacidad)} L`])} /></Campo>}
        <Campo l="Litros"><input type="number" step="0.01" value={d.l} onChange={e => p({ l: e.target.value })} /></Campo>
        {k === 'compra' && <Campo l="Monto pagado (Bs)"><input type="number" step="0.01" value={d.m} onChange={e => p({ m: e.target.value })} /></Campo>}
        <Campo l={k === 'traspaso' ? 'Motivo' : k === 'compra' ? 'Lugar' : 'Estación y detalle (opcional)'}><input value={d.t} onChange={e => p({ t: e.target.value })} /></Campo>
        <button className="primario">Registrar</button></form></> : <Vacio>Tu rol solo consulta los movimientos.</Vacio>}</section>
      <section><h2>Últimos registros</h2><ul className="lista">{rec.map(m => <li key={m.id}><span>{fecha(m.fecha)}</span><div><b>{m.cuenta === 'bus' ? 'Bus ' + de.bus(s, m.cuentaId).interno : s.tanques.find(t => t.id === m.cuentaId)?.nombre}</b><small>{m.detalle}</small></div><Marca c={m.entrada ? 'verde' : 'rojo'}>{m.entrada ? '+' + num(m.entrada) : '−' + num(m.salida)} L</Marca></li>)}</ul></section></div></>
}
