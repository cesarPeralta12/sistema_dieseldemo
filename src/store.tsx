import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Estado, Usuario } from './dominio/tipos'
import { ErrorRegla } from './dominio/reglas'
import { crearDemo, VERSION } from './dominio/seed'

const CLAVE = 'diesel-vales-demo'
function cargar(): Estado {
  try {
    const e = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Estado | null
    if (e?.version === VERSION) return e
  } catch { /* datos dañados o almacenamiento bloqueado: se parte de la demo */ }
  return crearDemo()
}

interface Ctx {
  s: Estado; u: Usuario; setUsuario(id: string): void
  /** Aplica una regla sobre una copia. Si falla, el estado no cambia y se muestra el motivo. */
  ejecutar(fn: (s: Estado, u: Usuario) => unknown, ok?: string): boolean
  reiniciar(): void
  aviso: { texto: string; error: boolean } | null
}
const C = createContext<Ctx>(null!)
export const useApp = () => useContext(C)

export function Proveedor({ children }: { children: ReactNode }) {
  const [s, setS] = useState(cargar)
  const [uid, setUsuario] = useState('u1')
  const [aviso, setAviso] = useState<Ctx['aviso']>(null)
  const u = s.usuarios.find(x => x.id === uid)!
  const avisar = (texto: string, error = false) => { const a = { texto, error }; setAviso(a); setTimeout(() => setAviso(x => x === a ? null : x), 4500) }
  const fijar = (n: Estado) => { setS(n); try { localStorage.setItem(CLAVE, JSON.stringify(n)) } catch { /* sin almacenamiento */ } }
  const ejecutar: Ctx['ejecutar'] = (fn, ok) => {
    const n = structuredClone(s)
    try { fn(n, u) } catch (e) {
      if (!(e instanceof ErrorRegla)) throw e
      avisar(e.message, true); return false
    }
    fijar(n); if (ok) avisar(ok); return true
  }
  return <C.Provider value={{ s, u, setUsuario, ejecutar, aviso, reiniciar: () => { fijar(crearDemo()); avisar('Demo reiniciada') } }}>{children}</C.Provider>
}
