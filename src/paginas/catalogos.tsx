import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../store'
import { PERMISOS, guardar, puede, saldo, type Catalogo } from '../dominio/reglas'
import type { Estado, Permiso } from '../dominio/tipos'
import { Campo, Elegir, Modal, Titulo, de, num } from '../ui/ui'

type Tipo = 'texto' | 'numero' | 'fecha' | 'ciudad' | 'verif'
const DEF: Record<Catalogo, { t: string; uno: string; campos: [string, string, Tipo][] }> = {
  buses: { t: 'Buses', uno: 'bus', campos: [['interno', 'Interno', 'texto'], ['placa', 'Placa', 'texto'], ['marca', 'Marca', 'texto'], ['modelo', 'Modelo', 'texto'], ['anio', 'Año', 'numero'], ['capacidad', 'Tanque (L)', 'numero'], ['asientos', 'Asientos', 'numero'], ['rendimiento', 'km por litro', 'numero'], ['ciudadId', 'Base', 'ciudad']] },
  choferes: { t: 'Conductores', uno: 'conductor', campos: [['nombre', 'Nombre', 'texto'], ['ci', 'CI', 'texto'], ['telefono', 'Teléfono', 'texto'], ['licencia', 'Licencia', 'texto'], ['categoria', 'Categoría', 'texto'], ['vence', 'Vence', 'fecha']] },
  rutas: { t: 'Rutas', uno: 'ruta', campos: [['origenId', 'Origen', 'ciudad'], ['destinoId', 'Destino', 'ciudad'], ['km', 'Distancia (km)', 'numero'], ['litrosRef', 'Litros de referencia', 'numero']] },
  ciudades: { t: 'Ciudades', uno: 'ciudad', campos: [['nombre', 'Ciudad', 'texto'], ['departamento', 'Departamento', 'texto']] },
  tanques: { t: 'Surtidores internos', uno: 'surtidor', campos: [['nombre', 'Nombre', 'texto'], ['ciudadId', 'Ciudad', 'ciudad'], ['capacidad', 'Capacidad (L)', 'numero'], ['minimo', 'Mínimo (L)', 'numero']] },
  estaciones: { t: 'Estaciones de servicio', uno: 'estación', campos: [['nombre', 'Nombre', 'texto'], ['ciudadId', 'Ciudad', 'ciudad'], ['verificacion', 'Verificación', 'verif'], ['precio', 'Precio (Bs/L)', 'numero']] },
}
function ver(s: Estado, t: Tipo, v: any, k: string) {
  return t === 'ciudad' ? de.ciudad(s, v) : t === 'verif' ? (v === 'factura' ? 'Factura por vale' : 'Aliada, por conciliación') : t === 'numero' && k !== 'anio' ? num(v) : t === 'fecha' ? String(v).split('-').reverse().join('/') : v
}
export function Lista({ cat }: { cat: Catalogo }) {
  const { s, u, ejecutar } = useApp(), d = DEF[cat], [q, setQ] = useState(''), [it, setIt] = useState<any>(null)
  const l = (s[cat] as any[]).filter(x => d.campos.map(([k, , t]) => ver(s, t, x[k], k)).join(' ').toLowerCase().includes(q.toLowerCase())), edit = puede(u, 'catalogos')
  return <><Titulo t={d.t} sub={`${l.length} registros`}><input type="search" placeholder="Buscar" value={q} onChange={e => setQ(e.target.value)} />{edit && <button className="primario" onClick={() => setIt({ id: '', ...Object.fromEntries(d.campos.map(([k, , t]) => [k, t === 'numero' ? 0 : t === 'verif' ? 'factura' : ''])) })}><Plus size={18} />Agregar {d.uno}</button>}</Titulo>
    <div className="tabla"><table><thead><tr>{d.campos.map(([k, n, t]) => <th key={k} className={t === 'numero' ? 'n' : ''}>{n}</th>)}{cat === 'buses' && <th className="n">Saldo (L)</th>}<th /></tr></thead><tbody>{l.map(x => <tr key={x.id}>{d.campos.map(([k, , t]) => <td key={k} className={(t === 'numero' ? 'n ' : '') + (t === 'fecha' && x[k] < s.hoy ? 't-rojo' : '')}>{k === 'interno' ? <b className="interno">{x[k]}</b> : ver(s, t, x[k], k)}</td>)}{cat === 'buses' && <td className="n">{num(saldo(s, 'bus', x.id))}</td>}<td className="fila-acc">{edit && <button onClick={() => setIt({ ...x })}>Editar</button>}</td></tr>)}</tbody></table></div>
    {it && <Modal t={(it.id ? 'Editar ' : 'Agregar ') + d.uno} cerrar={() => setIt(null)}><form className="form" onSubmit={e => { e.preventDefault(); if (ejecutar((s, u) => guardar(s, u, cat, it), 'Guardado')) setIt(null) }}>
      {d.campos.map(([k, n, t]) => <Campo key={k} l={n}>{t === 'ciudad' ? <Elegir v={it[k]} on={v => setIt({ ...it, [k]: v })} ops={s.ciudades.map(c => [c.id, c.nombre])} /> : t === 'verif' ? <Elegir vacio={null} v={it[k]} on={v => setIt({ ...it, [k]: v })} ops={[['factura', 'Factura por vale'], ['conciliacion', 'Aliada, por conciliación']]} /> : <input type={t === 'numero' ? 'number' : t === 'fecha' ? 'date' : 'text'} step="any" value={it[k]} onChange={e => setIt({ ...it, [k]: t === 'numero' ? +e.target.value : e.target.value })} />}</Campo>)}
      <button className="primario">Guardar</button></form></Modal>}</>
}
const PN: Record<Permiso, string> = { emitir: 'Emitir vales', partida: 'Marcar partida', movimientos: 'Otros movimientos', verificar: 'Verificar facturas', conciliar: 'Conciliar aliadas', catalogos: 'Editar catálogos', anular: 'Anular vales' }
export function Roles() {
  const { s } = useApp(), ps = Object.keys(PN) as Permiso[]
  return <><Titulo t="Usuarios y permisos" sub="Cambia de usuario en la barra lateral para probar cada rol" /><div className="tabla"><table><thead><tr><th>Usuario</th><th>Alcance</th>{ps.map(p => <th key={p}>{PN[p]}</th>)}</tr></thead><tbody>{s.usuarios.map(x => <tr key={x.id}><td><b>{x.nombre}</b><small>{x.cargo}</small></td><td>{x.ciudadId ? de.ciudad(s, x.ciudadId) : 'Todas las ciudades'}</td>{ps.map(p => <td key={p}>{PERMISOS[x.rol].includes(p) ? <span className="t-verde">Sí</span> : <span className="tenue">No</span>}</td>)}</tr>)}</tbody></table></div></>
}
