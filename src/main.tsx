import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeftRight, BookOpen, Bus, CalendarCheck, Container, FileCheck2, Fuel, Gauge, HandCoins, IdCard, MapPin, Route, Scale, Ticket, Users, Menu, type LucideIcon } from 'lucide-react'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/bricolage-grotesque/800.css'
import './estilos.css'
import { Proveedor, useApp } from './store'
import { sumarDias } from './dominio/reglas'
import { Hoja, Movimientos, Vales } from './paginas/operacion'
import { Adeudado, Conciliacion, Kardex, Resumen, Verificacion } from './paginas/control'
import { Lista, Roles } from './paginas/catalogos'
import { fecha } from './ui/ui'

const MENU: [string, [string, string, LucideIcon, () => React.ReactNode][]][] = [
  ['Operación', [['resumen', 'Resumen', Gauge, () => <Resumen />], ['hoja', 'Hoja de control', CalendarCheck, () => <Hoja />], ['vales', 'Vales emitidos', Ticket, () => <Vales />], ['movimientos', 'Otros movimientos', ArrowLeftRight, () => <Movimientos />]]],
  ['Control', [['kbus', 'Kardex por bus', BookOpen, () => <Kardex key="b" cuenta="bus" />], ['ktanque', 'Kardex por surtidor', Container, () => <Kardex key="t" cuenta="tanque" />], ['verificar', 'Verificar facturas', FileCheck2, () => <Verificacion />], ['conciliar', 'Conciliar aliadas', Scale, () => <Conciliacion />], ['adeudado', 'Adeudado', HandCoins, () => <Adeudado />]]],
  ['Registros', [['buses', 'Buses', Bus, () => <Lista key="1" cat="buses" />], ['choferes', 'Conductores', IdCard, () => <Lista key="2" cat="choferes" />], ['rutas', 'Rutas', Route, () => <Lista key="3" cat="rutas" />], ['ciudades', 'Ciudades', MapPin, () => <Lista key="4" cat="ciudades" />], ['tanques', 'Surtidores internos', Container, () => <Lista key="5" cat="tanques" />], ['estaciones', 'Estaciones', Fuel, () => <Lista key="6" cat="estaciones" />], ['roles', 'Usuarios y permisos', Users, () => <Roles />]]],
]
const PAG = MENU.flatMap(m => m[1])

function App() {
  const { s, u, setUsuario, ejecutar, reiniciar, aviso } = useApp()
  const leer = () => location.hash.slice(1) || 'hoja'
  const [p, setP] = useState(leer), [abierto, setAbierto] = useState(false)
  useEffect(() => { const f = () => { setP(leer()); setAbierto(false); window.scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  // El enlace publicado corre en un marco aislado: se navega por estado y el hash es solo un extra.
  const ir = (id: string) => { setP(id); setAbierto(false); window.scrollTo(0, 0); try { history.replaceState(null, '', '#' + id) } catch { /* marco aislado */ } }
  const [borrar, setBorrar] = useState(false), [registros, setRegistros] = useState(false)
  const pag = PAG.find(x => x[0] === p) ?? PAG[1]
  return <div className="app">
    <aside className={abierto ? 'abierto' : ''}>
      <div className="logo"><Fuel size={26} /><span>Vales de diésel</span><button className="menu" aria-label="Menú" onClick={() => setAbierto(!abierto)}><Menu /></button></div>
      <div className="lateral"><nav>{MENU.map(([g, l]) => {
          const items = l.map(([id, n, I]) => <a key={id} href={'#' + id} onClick={e => { e.preventDefault(); ir(id) }} aria-current={pag[0] === id ? 'page' : undefined}><I size={18} />{n}</a>)
          return g === 'Registros'
            ? <details key={g} open={registros || l.some(x => x[0] === pag[0])} onToggle={e => setRegistros(e.currentTarget.open)}><summary>{g}</summary>{items}</details>
            : <div key={g}><h3>{g}</h3>{items}</div>
        })}</nav>
        <div className="demo"><label>Entrar como<select value={u.id} onChange={e => setUsuario(e.target.value)}>{s.usuarios.map(x => <option key={x.id} value={x.id}>{x.nombre}, {x.cargo}</option>)}</select></label>
          <p>Hoy en la demo: {fecha(s.hoy)}</p><button onClick={() => ejecutar(s => { s.hoy = sumarDias(s.hoy, 1) }, 'Nuevo día: los buses que no partieron siguen en la hoja')}>Pasar al día siguiente</button><button onBlur={() => setBorrar(false)} onClick={() => { if (borrar) reiniciar(); setBorrar(!borrar) }}>{borrar ? 'Confirmar: borrar cambios' : 'Reiniciar demo'}</button></div></div>
    </aside>
    <main key={u.id + s.hoy + pag[0]}>{pag[3]()}</main>
    <div className="avisos" popover="manual" ref={e => { if (e) { if (aviso) { e.hidePopover(); e.showPopover() } else e.hidePopover() } }} role="status">{aviso && <div className={aviso.error ? 'error' : ''}>{aviso.texto}</div>}</div>
  </div>
}
// Los marcos publicados bloquean la impresión
if (window.self !== window.top) document.documentElement.classList.add('enmarcado')
createRoot(document.getElementById('root')!).render(<Proveedor><App /></Proveedor>)
