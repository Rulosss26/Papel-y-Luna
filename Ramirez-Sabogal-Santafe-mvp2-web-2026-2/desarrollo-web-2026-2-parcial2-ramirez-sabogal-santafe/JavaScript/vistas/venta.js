/* Venta en curso: carrito, totales, cliente y guardado como venta abierta */

const listaFactura = document.getElementById("lista-factura");
const facturaVacia = document.getElementById("factura-vacia");
const spanSubtotal = document.getElementById("subtotal");
const spanIva = document.getElementById("iva");
const spanTotal = document.getElementById("total");
const botonFinalizar = document.getElementById("boton-finalizar");
const botonGuardarAbierta = document.getElementById("boton-guardar-abierta");
const botonNuevaVentaPanel = document.getElementById("boton-nueva-venta-panel");
const tituloVenta = document.getElementById("titulo-venta");
const estadoVenta = document.getElementById("estado-venta");
const avisoCambiosVenta = document.getElementById("aviso-cambios-venta");
const selectClienteVenta = document.getElementById("select-cliente-venta");
const contadorAbiertas = document.getElementById("contador-abiertas");

function marcarCambiosVenta() {
  if (idVentaAbierta !== null) ventaConCambios = true;
}

function agregarProducto(producto, cantidad) {
  if (!producto) return;
  const linea = ventaActual.find((linea) => linea.productoId === producto.id);

  if (linea) {
    linea.cantidad += cantidad;
  } else {
    ventaActual.push({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: producto.precioVenta,
      costo: producto.costo,
      cantidad: cantidad
    });
  }

  marcarCambiosVenta();
  mostrarFactura();
  animateInvoiceIcon();
}

function cambiarCantidad(productoId, cambio) {
  const linea = ventaActual.find((linea) => linea.productoId === productoId);
  if (!linea) return;

  const nuevaCantidad = linea.cantidad + cambio;
  if (nuevaCantidad < 1) return;

  linea.cantidad = nuevaCantidad;
  marcarCambiosVenta();
  mostrarFactura();
}

// Cantidad escrita directamente en la línea de la venta
function establecerCantidad(productoId, valor) {
  const linea = ventaActual.find((linea) => linea.productoId === productoId);
  if (!linea) return;

  const cantidad = Math.floor(Number(valor));
  const nuevaCantidad = !cantidad || cantidad < 1 ? 1 : cantidad;
  if (nuevaCantidad !== linea.cantidad) {
    linea.cantidad = nuevaCantidad;
    marcarCambiosVenta();
  }
  mostrarFactura();
}

function quitarProducto(productoId) {
  ventaActual = ventaActual.filter((linea) => linea.productoId !== productoId);
  marcarCambiosVenta();
  mostrarFactura();
}

function calcularTotales() {
  const subtotal = ventaActual.reduce((acumulado, linea) => acumulado + linea.precio * linea.cantidad, 0);
  const iva = Math.round(subtotal * TASA_IVA);
  return { subtotal, iva, total: subtotal + iva };
}

// Productos con seguimiento de inventario cuya cantidad en la venta supera el stock disponible
function lineasSinStock() {
  return ventaActual
    .map((linea) => ({ linea, producto: buscarProducto(linea.productoId) }))
    .filter(({ linea, producto }) => producto && producto.seguimientoInventario && linea.cantidad > (producto.stock || 0))
    .map(({ linea, producto }) => ({ nombre: producto.nombre, disponible: producto.stock || 0, solicitado: linea.cantidad }));
}

function crearLineaFactura(linea) {
  const subtotalLinea = linea.precio * linea.cantidad;
  const producto = buscarProducto(linea.productoId);
  const sinStock = producto && producto.seguimientoInventario && linea.cantidad > (producto.stock || 0);

  const div = document.createElement("div");
  div.className = "linea-venta";
  div.innerHTML = `
    <div class="linea-cabecera">
      <span class="linea-nombre">${escaparHtml(linea.nombre)}</span>
      <div class="linea-botones">
        <button type="button" class="boton-icono" data-id="${linea.productoId}" data-accion="editar-rapido" title="Editar producto">🛠️</button>
        <button type="button" class="boton-icono" data-id="${linea.productoId}" data-accion="eliminar" title="Quitar de la venta">🧹</button>
      </div>
    </div>
    <p class="linea-precio">${formatearMoneda(linea.precio)} c/u</p>
    ${sinStock ? `<p class="aviso-error">⚠️ Stock disponible: ${producto.stock || 0}</p>` : ""}
    <div class="linea-control">
      <div class="control-cantidad-tarjeta control-cantidad-linea">
        <button type="button" class="btn-cant" data-id="${linea.productoId}" data-accion="restar">−</button>
        <input type="number" class="input-cantidad" data-id="${linea.productoId}" min="1" step="1" value="${linea.cantidad}" inputmode="numeric" aria-label="Cantidad de ${escaparHtml(linea.nombre)}">
        <button type="button" class="btn-cant" data-id="${linea.productoId}" data-accion="sumar">+</button>
      </div>
      <span><strong>${formatearMoneda(subtotalLinea)}</strong></span>
    </div>
  `;
  return div;
}

function mostrarSelectClienteVenta() {
  if (clienteVentaId !== null && !buscarCliente(clienteVentaId)) clienteVentaId = null;
  selectClienteVenta.innerHTML = opcionesClientes(clienteVentaId);
}

function mostrarFactura() {
  const hayProductos = ventaActual.length > 0;
  facturaVacia.classList.toggle("oculto", hayProductos);

  listaFactura.innerHTML = "";
  ventaActual.forEach((linea) => listaFactura.appendChild(crearLineaFactura(linea)));

  const totales = calcularTotales();
  spanSubtotal.textContent = formatearMoneda(totales.subtotal);
  spanIva.textContent = formatearMoneda(totales.iva);
  spanTotal.textContent = formatearMoneda(totales.total);

  if (idVentaAbierta === null) {
    tituloVenta.textContent = "Venta actual";
    estadoVenta.textContent = "Nueva";
    estadoVenta.classList.remove("etiqueta-abierta");
  } else {
    tituloVenta.textContent = `Venta #${idVentaAbierta}`;
    estadoVenta.textContent = "Abierta";
    estadoVenta.classList.add("etiqueta-abierta");
  }
  avisoCambiosVenta.classList.toggle("oculto", !(idVentaAbierta !== null && ventaConCambios));

  mostrarSelectClienteVenta();
  contadorAbiertas.textContent = totalPendientesVentas();
  actualizarContadorFactura();

  botonFinalizar.disabled = !hayProductos;
  botonGuardarAbierta.disabled = !hayProductos || (idVentaAbierta !== null && !ventaConCambios);
}

function hayVentaSinGuardar() {
  return ventaActual.length > 0 && (idVentaAbierta === null || ventaConCambios);
}

async function confirmarDescartarVenta() {
  if (!hayVentaSinGuardar()) return true;
  return confirmarEnApp({
    titulo: "¿Descartar la venta actual?",
    mensaje: "La venta que estás armando tiene cambios sin guardar. Si continúas, se perderán.",
    textoAceptar: "Descartar cambios",
    textoCancelar: "Seguir con la venta",
    peligro: true
  });
}

function reiniciarVenta() {
  ventaActual = [];
  idVentaAbierta = null;
  clienteVentaId = null;
  ventaConCambios = false;
  mostrarFactura();
}

function datosVentaParaServicio() {
  const totales = calcularTotales();
  return {
    id: idVentaAbierta,
    clienteId: clienteVentaId,
    items: ventaActual.map((linea) => ({ ...linea })),
    subtotal: totales.subtotal,
    iva: totales.iva,
    total: totales.total
  };
}

async function guardarComoVentaAbierta() {
  if (ventaActual.length === 0) return;

  try {
    await ejecutarConCarga(botonGuardarAbierta, "Guardando…", async () => {
      const venta = await api.guardarVentaAbierta(datosVentaParaServicio());
      guardarEnEstado("ventas", venta);
      reiniciarVenta();
      mostrarNotificacion(`Venta #${venta.id} guardada como abierta. Puedes retomarla desde "Ventas abiertas".`);
    });
  } catch (error) {
    mostrarNotificacion(error.message, "error");
  }
  mostrarFactura();
}

// Cuando un producto cambia (nombre, precio, costo) se refleja en la venta en curso
function sincronizarProductoEnVenta(producto) {
  const linea = ventaActual.find((linea) => linea.productoId === producto.id);
  if (!linea) return;

  const cambio = linea.nombre !== producto.nombre || linea.precio !== producto.precioVenta || linea.costo !== producto.costo;
  linea.nombre = producto.nombre;
  linea.precio = producto.precioVenta;
  linea.costo = producto.costo;
  if (cambio) marcarCambiosVenta();
}

function quitarProductoEliminadoDeVenta(productoId) {
  if (ventaActual.some((linea) => linea.productoId === productoId)) {
    ventaActual = ventaActual.filter((linea) => linea.productoId !== productoId);
    marcarCambiosVenta();
  }
}

function iniciarFactura() {
  listaFactura.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button");
    if (!boton) return;

    const id = Number(boton.dataset.id);
    const accion = boton.dataset.accion;

    if (accion === "sumar") cambiarCantidad(id, 1);
    if (accion === "restar") cambiarCantidad(id, -1);
    if (accion === "eliminar") quitarProducto(id);
    if (accion === "editar-rapido") abrirEdicionRapida(id);
  });

  // Al terminar de escribir la cantidad (Enter o salir del campo) se recalcula la venta
  listaFactura.addEventListener("change", (evento) => {
    if (evento.target.classList.contains("input-cantidad")) {
      establecerCantidad(Number(evento.target.dataset.id), evento.target.value);
    }
  });

  selectClienteVenta.addEventListener("change", () => {
    clienteVentaId = selectClienteVenta.value ? Number(selectClienteVenta.value) : null;
    marcarCambiosVenta();
    mostrarFactura();
  });

  botonNuevaVentaPanel.addEventListener("click", async () => {
    if (await confirmarDescartarVenta()) reiniciarVenta();
  });

  botonGuardarAbierta.addEventListener("click", guardarComoVentaAbierta);
  botonFinalizar.addEventListener("click", abrirModalPago);
}
