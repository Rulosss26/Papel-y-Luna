/*
 * Estado de la aplicación.
 * Todos los datos vienen del servicio externo; aquí solo se guarda la copia en memoria
 * que usan las vistas mientras la página está abierta.
 */

// Constantes de la aplicación (permitidas por el enunciado)
const METODOS_PAGO = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "nequi", etiqueta: "Nequi" },
  { valor: "debe", etiqueta: "Debe" }
];
const TASA_IVA = 0.19;
const HOJAS_SERVICIO = ["categorias", "proveedores", "clientes", "productos", "ventas", "compras"];

// Datos cargados desde el servicio
const datos = {
  categorias: [],
  proveedores: [],
  clientes: [],
  productos: [],
  ventas: [],
  compras: []
};

// Estado de la interfaz
let categoriaActual = "todas";

// Venta en curso: líneas del carrito + si corresponde a una venta abierta guardada en el servicio
let ventaActual = [];
let idVentaAbierta = null;
let clienteVentaId = null;
let ventaConCambios = false;

let ventaEnRevision = null;
let productoEnEdicion = null;

async function cargarDatosIniciales() {
  // Se piden todas las hojas en paralelo
  const resultados = await Promise.all(HOJAS_SERVICIO.map((hoja) => api.listar(hoja)));
  HOJAS_SERVICIO.forEach((hoja, indice) => {
    datos[hoja] = resultados[indice];
  });
}

async function recargarHoja(hoja) {
  datos[hoja] = await api.listar(hoja);
}

/* ---------- Búsquedas ---------- */

function buscarPorId(lista, id) {
  return lista.find((registro) => registro.id === Number(id)) || null;
}

function buscarProducto(id) {
  return buscarPorId(datos.productos, id);
}

function buscarCategoria(id) {
  return buscarPorId(datos.categorias, id);
}

function buscarCliente(id) {
  return buscarPorId(datos.clientes, id);
}

function buscarProveedor(id) {
  return buscarPorId(datos.proveedores, id);
}

function nombreCategoria(id) {
  const categoria = buscarCategoria(id);
  return categoria ? categoria.nombre : "Sin categoría";
}

function ventasCerradas() {
  return datos.ventas.filter((venta) => venta.estado === "cerrada");
}

function ventasAbiertas() {
  return datos.ventas.filter((venta) => venta.estado === "abierta");
}

function etiquetaMetodoPago(metodo) {
  const encontrado = METODOS_PAGO.find((opcion) => opcion.valor === metodo);
  return encontrado ? encontrado.etiqueta : metodo || "—";
}

function saldoPendienteVenta(venta) {
  if (!venta || venta.metodoPago !== "debe") return 0;
  if (venta.montoDeuda !== null && venta.montoDeuda !== undefined && Number.isFinite(Number(venta.montoDeuda))) {
    return Math.max(Number(venta.montoDeuda), 0);
  }
  const pagado = venta.montoPagado !== null && venta.montoPagado !== undefined && Number.isFinite(Number(venta.montoPagado))
    ? Number(venta.montoPagado)
    : 0;
  return Math.max((Number(venta.total) || 0) - pagado, 0); // Las deudas antiguas sin abonos deben el total.
}

function montoPagadoVenta(venta) {
  if (!venta) return 0;
  if (venta.metodoPago !== "debe") return Number(venta.total) || 0;
  if (venta.montoPagado !== null && venta.montoPagado !== undefined && Number.isFinite(Number(venta.montoPagado))) {
    return Math.max(Number(venta.montoPagado), 0);
  }
  return Math.max((Number(venta.total) || 0) - saldoPendienteVenta(venta), 0);
}

// Ventas cerradas con método "Debe" que todavía tienen saldo por pagar
function ventasConDeuda() {
  return datos.ventas.filter(
    (venta) => venta.estado === "cerrada" && venta.metodoPago === "debe" && saldoPendienteVenta(venta) > 0
  );
}

// Lo que se muestra en el botón "Ventas abiertas (N)": ventas sin cerrar + ventas con deuda
function totalPendientesVentas() {
  return ventasAbiertas().length + ventasConDeuda().length;
}

/* ---------- Actualizaciones locales a partir de respuestas del servicio ---------- */

// Reemplaza (o agrega) un registro en la lista indicada
function guardarEnEstado(hoja, registro) {
  const indice = datos[hoja].findIndex((existente) => existente.id === registro.id);
  if (indice === -1) datos[hoja].push(registro);
  else datos[hoja][indice] = registro;
}

function quitarDeEstado(hoja, id) {
  datos[hoja] = datos[hoja].filter((registro) => registro.id !== id);
}

/* ---------- Selects reutilizables ---------- */

function opcionesCategorias(seleccionada) {
  if (datos.categorias.length === 0) {
    return `<option value="">Primero crea una categoría</option>`;
  }
  return (
    `<option value="">Selecciona una categoría</option>` +
    [...datos.categorias]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(
        (categoria) =>
          `<option value="${categoria.id}" ${categoria.id === Number(seleccionada) ? "selected" : ""}>${escaparHtml(categoria.nombre)}</option>`
      )
      .join("")
  );
}

function opcionesClientes(seleccionado) {
  return (
    `<option value="">Sin cliente</option>` +
    [...datos.clientes]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(
        (cliente) =>
          `<option value="${cliente.id}" ${cliente.id === Number(seleccionado) ? "selected" : ""}>${escaparHtml(cliente.nombre)}</option>`
      )
      .join("")
  );
}
