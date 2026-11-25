export type Rol = 'admin' | 'regional' | 'contable' | 'encargado'
export type Permiso = 'emitir' | 'partida' | 'movimientos' | 'verificar' | 'conciliar' | 'catalogos' | 'anular'

export interface Usuario { id: string; nombre: string; cargo: string; rol: Rol; ciudadId?: string }
export interface Ciudad { id: string; nombre: string; departamento: string }
export interface Ruta { id: string; origenId: string; destinoId: string; km: number; litrosRef: number }
export interface Bus { id: string; interno: string; placa: string; marca: string; modelo: string; anio: number; capacidad: number; asientos: number; rendimiento: number; ciudadId: string }
export interface Chofer { id: string; nombre: string; ci: string; telefono: string; licencia: string; categoria: string; vence: string }
export interface Tanque { id: string; nombre: string; ciudadId: string; capacidad: number; minimo: number }
export interface Estacion { id: string; nombre: string; ciudadId: string; verificacion: 'factura' | 'conciliacion'; precio: number }

export type Partida = 'pendiente' | 'no_partio' | 'partio'
export type EstadoVale = 'pendiente' | 'verificado' | 'conciliado' | 'interno' | 'anulado'

export interface Vale {
  id: string; numero: number; fecha: string; ciudadId: string
  busId: string; rutaId: string; choferId: string
  estacionId?: string; tanqueId?: string
  litros: number; precio: number
  partida: Partida; fechaPartida?: string
  estado: EstadoVale
  litrosReales?: number; montoReal?: number; factura?: string; fechaCierre?: string; nota?: string
  emitidoPor: string
}

export type TipoMov =
  | 'vale' | 'surtidor' | 'traspaso' | 'compra_sin_factura' | 'abastecimiento'
  | 'salida_ruta' | 'ajuste' | 'anulacion' | 'inicial'

/** Línea de kardex. Nunca se edita ni se borra: toda corrección es una línea nueva. */
export interface Mov {
  id: number; fecha: string; cuenta: 'bus' | 'tanque'; cuentaId: string
  tipo: TipoMov; entrada: number; salida: number; detalle: string
  valeId?: string; busRefId?: string; rutaId?: string; usuario: string
}

/** Lo que una estación aliada declara en su estado de cuenta. */
export interface Cobro { id: string; estacionId: string; fecha: string; numeroVale: number; litros: number; monto: number; estado: 'pendiente' | 'aceptado' | 'rechazado' }

export interface Estado {
  version: number; hoy: string; secuencia: number; numeroVale: number
  usuarios: Usuario[]; ciudades: Ciudad[]; rutas: Ruta[]; buses: Bus[]; choferes: Chofer[]
  tanques: Tanque[]; estaciones: Estacion[]; vales: Vale[]; movs: Mov[]; cobros: Cobro[]
}
