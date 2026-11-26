import { useEffect, useRef, type ReactNode } from 'react'
import type { Estado, Partida, EstadoVale, Vale } from '../dominio/tipos'
import { litrosVale, montoVale } from '../dominio/reglas'
import QRCode from 'qrcode'

/** Código del QR. En el sistema final será un token aleatorio guardado en la base; aquí se deriva del número. */
export function codigoQR(numero: number) {
  let h = 2166136261
  for (const ch of 'vale-' + numero) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return `DV-${numero}-${(h >>> 0).toString(36).toUpperCase()}`
}
export function Qr({ texto }: { texto: string }) {
  const q = QRCode.create(texto, { errorCorrectionLevel: 'M' }).modules, n = q.size
  let d = ''
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`
  return <svg className="qr" viewBox={`0 0 ${n + 4} ${n + 4}`} role="img" aria-label={'Código QR ' + texto} shapeRendering="crispEdges"><rect width={n + 4} height={n + 4} fill="#fff" /><path d={d} fill="#14272e" /></svg>
}

const nf = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 })
export const num = (n: number) => nf.format(n)
export const bs = (n: number) => 'Bs ' + new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
export const fecha = (f: string, largo = false) => new Date(f + 'T12:00:00').toLocaleDateString('es-BO', largo ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: '2-digit', month: 'short' })

export const de = {
  ciudad: (s: Estado, id: string) => s.ciudades.find(c => c.id === id)?.nombre ?? '',
  ruta: (s: Estado, id: string) => { const r = s.rutas.find(r => r.id === id); return r ? `${de.ciudad(s, r.origenId)} a ${de.ciudad(s, r.destinoId)}` : '' },
  bus: (s: Estado, id: string) => s.buses.find(b => b.id === id)!,
  chofer: (s: Estado, id: string) => s.choferes.find(c => c.id === id)?.nombre ?? '',
  origen: (s: Estado, v: Vale) => (v.tanqueId ? s.tanques.find(t => t.id === v.tanqueId) : s.estaciones.find(e => e.id === v.estacionId))?.nombre ?? '',
}

export function Titulo({ t, sub, children }: { t: string; sub?: string; children?: ReactNode }) {
  return <header className="titulo"><div><h1>{t}</h1>{sub && <p>{sub}</p>}</div><div className="acciones">{children}</div></header>
}
export function Campo({ l, children, ayuda }: { l: string; children: ReactNode; ayuda?: string }) {
  return <label className="campo"><span>{l}</span>{children}{ayuda && <small>{ayuda}</small>}</label>
}
export function Elegir({ v, on, ops, vacio = 'Seleccionar' }: { v: string; on(v: string): void; ops: [string, string][]; vacio?: string | null }) {
  return <select value={v} onChange={e => on(e.target.value)}>{vacio !== null && <option value="">{vacio}</option>}{ops.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
}
const PART: Record<Partida, [string, string]> = { pendiente: ['Por partir', 'ambar'], no_partio: ['No partió', 'rojo'], partio: ['Partió', 'verde'] }
const EST: Record<EstadoVale, [string, string]> = { pendiente: ['Sin cerrar', 'ambar'], verificado: ['Verificado', 'verde'], conciliado: ['Conciliado', 'verde'], interno: ['Surtidor interno', 'gris'], anulado: ['Anulado', 'rojo'] }
export const Marca = ({ c, children }: { c: string; children: ReactNode }) => <span className={'marca ' + c}>{children}</span>
export const MarcaPartida = ({ p }: { p: Partida }) => <Marca c={PART[p][1]}>{PART[p][0]}</Marca>
export const MarcaEstado = ({ e }: { e: EstadoVale }) => <Marca c={EST[e][1]}>{EST[e][0]}</Marca>
export const Vacio = ({ children }: { children: ReactNode }) => <div className="vacio">{children}</div>

export function Modal({ t, cerrar, children }: { t: string; cerrar(): void; children: ReactNode }) {
  const r = useRef<HTMLDialogElement>(null)
  useEffect(() => { r.current?.showModal() }, [])
  return <dialog ref={r} onClose={cerrar} aria-label={t}><div className="modal-cab"><h2>{t}</h2><button className="plano" onClick={cerrar}>Cerrar</button></div>{children}</dialog>
}

export function Ticket({ s, v }: { s: Estado; v: Omit<Vale, 'id' | 'emitidoPor'> & { emitidoPor?: string } }) {
  const b = s.buses.find(b => b.id === v.busId)
  const sello = v.estado === 'anulado' ? 'Anulado' : v.partida === 'partio' ? 'Partió' : v.partida === 'no_partio' ? 'No partió' : null
  return <article className={'ticket' + (v.tanqueId ? ' interno' : '')}>
    <div className="ticket-cuerpo">
      <div className="ticket-cab"><span>Vale de diésel</span><b>N.º {v.numero}</b></div>
      <dl>
        <div className="ancho"><dt>Ruta</dt><dd>{de.ruta(s, v.rutaId) || 'Sin ruta'}</dd></div>
        <div><dt>Bus</dt><dd>{b ? `${b.interno}, ${b.placa}` : 'Sin bus'}</dd></div>
        <div><dt>Fecha</dt><dd>{v.fecha.split('-').reverse().join('/')}</dd></div>
        <div className="ancho"><dt>Chofer</dt><dd>{de.chofer(s, v.choferId) || 'Sin chofer'}</dd></div>
        <div className="ancho"><dt>Carga en</dt><dd>{de.origen(s, v as Vale) || 'Sin punto de carga'}</dd></div>
      </dl>
      {sello && <span className={'sello ' + (sello === 'Partió' ? 'ok' : '')}>{sello}</span>}
    </div>
    <div className="ticket-talon">
      <strong>{num(litrosVale(v as Vale))}</strong><span>litros</span>
      {v.precio > 0 && <em>{bs(montoVale(v as Vale))}</em>}
      {v.numero > 0 && <><Qr texto={codigoQR(v.numero)} /><code>{codigoQR(v.numero)}</code></>}
    </div>
  </article>
}
