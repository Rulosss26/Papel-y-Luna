/* Listado de ventas abiertas guardadas en el servicio y opción de retomarlas */

const botonVentasAbiertas = document.getElementById("boton-ventas-abiertas");
const abiertasLista = document.getElementById("abiertas-lista");
const abiertasVacio = document.getElementById("abiertas-vacio");
const abiertasEstado = document.getElementById("abiertas-estado");

function filaVentaAbierta(venta) {
  const cantidadProductos = venta.items.reduce((suma, item) => suma + item.cantidad, 0);
  const cliente = venta.clienteId ? (buscarCliente(venta.clienteId) || {}).nombre || venta.clienteNombre : "Sin cliente";
  const esLaActual = venta.id === idVentaAbierta;

  return `
    <div class="historial-item">
      <div>
        <p class="historial-titulo">Venta #${venta.id} ${esLaActual ? '<span class="etiqueta-estado etiqueta-abierta">En pantalla</span>' : ""}</p>
        <p class="historial-detalle">${formatearFecha(venta.fechaCreacion)} · ${escaparHtml(cliente)} · ${cantidadProductos} producto(s)</p>
      </div>
      <div class="historial-derecha">
        <span class="historial-total">${formatearMoneda(venta.total)}</span>
        <button type="button" class="boton boton-negro" data-accion="retomar" data-id="${venta.id}">Retomar</button>
      </div>
    </div>
  `;
}

function mostrarVentasAbiertas() {
  const abiertas = ventasAbiertas().sort((a, b) => b.id - a.id);
  abiertasLista.innerHTML = abiertas.map(filaVentaAbierta).join("");
  abiertasVacio.classList.toggle("oculto", abiertas.length !== 0);

  // Ventas con deuda (método "Debe"): siguen apareciendo aquí hasta que se paguen por completo
  mostrarVentasConDeuda();
  contadorAbiertas.textContent = totalPendientesVentas();
}

async function abrirVentasAbiertas() {
  abrirModal("modal-ventas-abiertas");
  mostrarVentasAbiertas();
  mostrarEstadoLista(abiertasEstado, "Actualizando desde el servicio…");
  try {
    await recargarHoja("ventas");
    mostrarEstadoLista(abiertasEstado, "");
    mostrarVentasAbiertas();
  } catch (error) {
    mostrarEstadoLista(abiertasEstado, error.message, true);
  }
}

async function retomarVenta(id) {
  const venta = buscarPorId(datos.ventas, id);
  if (!venta || venta.estado !== "abierta") {
    mostrarNotificacion("Esa venta ya no está abierta.", "error");
    return;
  }

  // Si es la misma venta que ya está en pantalla, solo se vuelve a ella (sin perder cambios)
  if (venta.id === idVentaAbierta) {
    cerrarModal("modal-ventas-abiertas");
    cambiarVista("vender");
    return;
  }

  if (!(await confirmarDescartarVenta())) return;

  // Como la venta sigue abierta, sus líneas toman los datos actuales de cada producto
  const eliminados = [];
  const lineas = [];
  venta.items.forEach((item) => {
    const producto = buscarProducto(item.productoId);
    if (!producto) {
      eliminados.push(item.nombre);
      return;
    }
    lineas.push({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: producto.precioVenta,
      costo: producto.costo,
      cantidad: item.cantidad
    });
  });

  ventaActual = lineas;
  idVentaAbierta = venta.id;
  clienteVentaId = venta.clienteId && buscarCliente(venta.clienteId) ? venta.clienteId : null;
  ventaConCambios = eliminados.length > 0;

  cerrarModal("modal-ventas-abiertas");
  cambiarVista("vender");
  mostrarFactura();

  if (eliminados.length > 0) {
    mostrarNotificacion(`Se quitaron productos que ya no existen: ${eliminados.join(", ")}`, "error");
  } else {
    mostrarNotificacion(`Venta #${venta.id} retomada.`);
  }
}

function iniciarVentasAbiertas() {
  botonVentasAbiertas.addEventListener("click", abrirVentasAbiertas);

  abiertasLista.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-accion='retomar']");
    if (!boton) return;
    retomarVenta(Number(boton.dataset.id));
  });
}
