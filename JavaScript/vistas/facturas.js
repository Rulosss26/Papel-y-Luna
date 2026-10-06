/* Confirmación de venta, factura (imprimir/PDF), historial de ventas y detalle */

const vistaConfirmacion = document.getElementById("vista-confirmacion");
const confirmacionResumen = document.getElementById("confirmacion-resumen");
const botonVerFacturaConfirmacion = document.getElementById("boton-ver-factura-confirmacion");
const botonNuevaVenta = document.getElementById("boton-nueva-venta");

function mostrarConfirmacion(venta) {
  ventaEnRevision = venta;

  let resumen = `Venta #${venta.id} · ${formatearMoneda(venta.total)} · ${etiquetaMetodoPago(venta.metodoPago)}`;
  if (venta.clienteNombre) resumen += ` · ${venta.clienteNombre}`;
  if (venta.metodoPago === "efectivo") resumen += ` · Cambio: ${formatearMoneda(venta.cambio)}`;
  if (venta.metodoPago === "debe") resumen += ` · Pagó: ${formatearMoneda(montoPagadoVenta(venta))} · Debe: ${formatearMoneda(saldoPendienteVenta(venta))}`;
  confirmacionResumen.textContent = resumen;

  vistaConfirmacion.classList.remove("oculto");
}

function cerrarConfirmacion() {
  vistaConfirmacion.classList.add("oculto");
}

function iniciarConfirmacion() {
  botonVerFacturaConfirmacion.addEventListener("click", () => {
    cerrarConfirmacion();
    mostrarVistaFactura(ventaEnRevision);
  });

  botonNuevaVenta.addEventListener("click", cerrarConfirmacion);
}

/* ---------- Factura ---------- */

const overlayFactura = document.getElementById("overlay-factura");
const contenidoFactura = document.getElementById("contenido-factura");
const botonImprimirFactura = document.getElementById("boton-imprimir-factura");

function filasItemsVenta(venta) {
  return venta.items
    .map(
      (item) => `
        <tr>
          <td>${escaparHtml(item.nombre)}</td>
          <td class="col-centro">${item.cantidad}</td>
          <td class="col-derecha">${formatearMoneda(item.precio)}</td>
          <td class="col-derecha">${formatearMoneda(item.precio * item.cantidad)}</td>
        </tr>
      `
    )
    .join("");
}

function generarHtmlFactura(venta) {
  const filaPago =
    venta.metodoPago === "efectivo"
      ? `
        <p><span>Valor recibido</span><span>${formatearMoneda(venta.valorRecibido)}</span></p>
        <p><span>Cambio entregado</span><span>${formatearMoneda(venta.cambio)}</span></p>
      `
      : "";
  const deuda = saldoPendienteVenta(venta);
  const lineasDeuda = venta.metodoPago === "debe"
    ? `<p><span>Método de pago</span><span>Debe (crédito del cliente)</span></p>
       <p><span>Monto pagado</span><span>${formatearMoneda(montoPagadoVenta(venta))}</span></p>
       <p><span>Saldo pendiente</span><span>${formatearMoneda(deuda)}</span></p>
       ${deuda > 0 ? `<p><strong>El cliente debe: ${formatearMoneda(deuda)}</strong></p>` : `<p><strong>Pagada completamente</strong></p>`}`
    : `<p><span>Método de pago</span><span>${etiquetaMetodoPago(venta.metodoPago)}</span></p>`;

  return `
    <div class="factura-encabezado">
      <img src="img/logo.png" alt="Papel y Luna" class="factura-logo">
      <div>
        <h2>Papel y Luna</h2>
        <p>Papelería - Sistema de facturación</p>
      </div>
    </div>

    <div class="factura-info">
      <p><strong>Venta N.º</strong> ${venta.id}</p>
      <p><strong>Fecha</strong> ${formatearFecha(venta.fechaCierre)}</p>
      ${venta.clienteNombre ? `<p><strong>Cliente</strong> ${escaparHtml(venta.clienteNombre)}</p>` : ""}
      ${lineasDeuda}
    </div>

    <table class="tabla-factura">
      <thead>
        <tr><th>Producto</th><th class="col-centro">Cant.</th><th class="col-derecha">Precio</th><th class="col-derecha">Subtotal</th></tr>
      </thead>
      <tbody>${filasItemsVenta(venta)}</tbody>
    </table>

    <div class="factura-totales">
      <p><span>Subtotal</span><span>${formatearMoneda(venta.subtotal)}</span></p>
      <p><span>IVA (19%)</span><span>${formatearMoneda(venta.iva)}</span></p>
      <p class="total-final"><span>Total</span><span>${formatearMoneda(venta.total)}</span></p>
      ${filaPago}
    </div>

    <p class="factura-gracias">¡Gracias por tu compra!</p>
  `;
}

function mostrarVistaFactura(venta) {
  if (!venta) return;
  ventaEnRevision = venta;
  contenidoFactura.innerHTML = generarHtmlFactura(venta);
  overlayFactura.classList.remove("oculto");
}

function imprimirFactura() {
  window.print();
}

function iniciarFacturaOverlay() {
  botonImprimirFactura.addEventListener("click", imprimirFactura);
}

/* ---------- Detalle de venta ---------- */

const contenidoDetalleVenta = document.getElementById("contenido-detalle-venta");
const botonFacturaDesdeDetalle = document.getElementById("boton-factura-desde-detalle");

function mostrarDetalleVenta(venta) {
  if (!venta) return;
  ventaEnRevision = venta;
  const unidades = venta.items.reduce((suma, item) => suma + item.cantidad, 0);
  const saldo = saldoPendienteVenta(venta);
  const abonos = Array.isArray(venta.abonos) ? venta.abonos : [];

  contenidoDetalleVenta.innerHTML = `
    <h3>Detalle de la venta #${venta.id}</h3>
    <div class="factura-info">
      <p><strong>Estado</strong> ${saldo > 0 ? "Cerrada con deuda" : venta.metodoPago === "debe" ? "Pagada completamente" : "Cerrada"}</p>
      <p><strong>Creada</strong> ${formatearFecha(venta.fechaCreacion)}</p>
      <p><strong>Cerrada</strong> ${formatearFecha(venta.fechaCierre)}</p>
      <p><strong>Cliente</strong> ${escaparHtml(venta.clienteNombre || "Sin cliente")}</p>
      <p><strong>Método de pago</strong> ${etiquetaMetodoPago(venta.metodoPago)}</p>
      ${venta.metodoPago === "debe" ? `
        <p><strong>Total pagado</strong> ${formatearMoneda(montoPagadoVenta(venta))}</p>
        <p><strong>Saldo pendiente</strong> ${formatearMoneda(saldo)}</p>
        ${saldo > 0 ? `<p class="aviso-suave">Esta venta tiene un saldo pendiente de: ${formatearMoneda(saldo)}</p>
          <button type="button" class="boton boton-negro" data-accion="registrar-abono">Cobrar el saldo / Registrar abono</button>` : ""}
        ${abonos.length ? `<h4>Histórico de abonos</h4><ul class="lista-abonos">${abonos.map((abono) => `<li>${formatearFecha(abono.fecha)} · ${formatearMoneda(abono.monto)}${abono.saldoRestante !== undefined ? ` · Saldo después: ${formatearMoneda(abono.saldoRestante)}` : ""}</li>`).join("")}</ul>` : ""}
      ` : ""}
      <p><strong>Unidades vendidas</strong> ${unidades}</p>
    </div>

    <table class="tabla-factura">
      <thead>
        <tr><th>Producto</th><th class="col-centro">Cant.</th><th class="col-derecha">Precio</th><th class="col-derecha">Subtotal</th></tr>
      </thead>
      <tbody>${filasItemsVenta(venta)}</tbody>
    </table>

    <div class="factura-totales">
      <p><span>Subtotal</span><span>${formatearMoneda(venta.subtotal)}</span></p>
      <p><span>IVA (19%)</span><span>${formatearMoneda(venta.iva)}</span></p>
      <p class="total-final"><span>Total</span><span>${formatearMoneda(venta.total)}</span></p>
      ${
        venta.metodoPago === "debe"
          ? `<p><span>Monto pagado</span><span>${formatearMoneda(montoPagadoVenta(venta))}</span></p>
             <p><span>Saldo pendiente</span><span>${formatearMoneda(saldo)}</span></p>`
          : venta.metodoPago === "efectivo"
          ? `<p><span>Valor recibido</span><span>${formatearMoneda(venta.valorRecibido)}</span></p>
             <p><span>Cambio entregado</span><span>${formatearMoneda(venta.cambio)}</span></p>`
          : ""
      }
    </div>
  `;
  abrirModal("modal-detalle-venta");
}

/* ---------- Historial ---------- */

const historialLista = document.getElementById("historial-lista");
const historialVacio = document.getElementById("historial-vacio");
const historialEstado = document.getElementById("historial-estado");
const modalAbono = document.getElementById("modal-abono");
const resumenAbono = document.getElementById("resumen-abono");
const erroresAbono = document.getElementById("errores-abono");
const campoAbono = document.getElementById("campo-abono");
const saldoRestanteAbono = document.getElementById("saldo-restante-abono");
const botonConfirmarAbono = document.getElementById("boton-confirmar-abono");
let ventaAbonoActual = null;

function abrirModalAbono(venta) {
  if (!venta) return;
  const saldo = saldoPendienteVenta(venta);
  if (saldo <= 0) {
    mostrarNotificacion("Esta venta ya fue pagada completamente.", "error");
    return;
  }
  ventaAbonoActual = venta;
  const pagado = montoPagadoVenta(venta);
  resumenAbono.innerHTML = `
    <p><strong>Venta original:</strong> #${venta.id}</p>
    <p><strong>Monto original:</strong> ${formatearMoneda(venta.total)}</p>
    <p><strong>Pagado antes:</strong> ${formatearMoneda(pagado)}</p>
    <p><strong>Saldo actual:</strong> ${formatearMoneda(saldo)}</p>`;
  campoAbono.value = "";
  campoAbono.max = saldo;
  campoAbono.placeholder = `Ej: ${Math.ceil(saldo / 2)}`;
  actualizarSaldoRestanteAbono();
  mostrarErroresEn(erroresAbono, []);
  abrirModal("modal-abono");
}

function actualizarSaldoRestanteAbono() {
  const saldo = ventaAbonoActual ? saldoPendienteVenta(ventaAbonoActual) : 0;
  const monto = Number(campoAbono.value) || 0;
  saldoRestanteAbono.textContent = formatearMoneda(Math.max(saldo - monto, 0));
}

async function confirmarAbono() {
  if (!ventaAbonoActual) return;
  const saldo = saldoPendienteVenta(ventaAbonoActual);
  const monto = Number(campoAbono.value);
  const errores = [];
  if (!campoAbono.value || !Number.isFinite(monto) || monto <= 0) errores.push("Ingresa un abono mayor a 0.");
  else if (monto > saldo) errores.push("El abono no puede superar el saldo pendiente.");
  if (errores.length) {
    mostrarErroresEn(erroresAbono, errores);
    return;
  }

  try {
    await ejecutarConCarga(botonConfirmarAbono, "Registrando…", async () => {
      const respuesta = await api.registrarAbono({ ventaId: ventaAbonoActual.id, monto });
      guardarEnEstado("ventas", respuesta.venta);
      ventaAbonoActual = respuesta.venta;
      cerrarModal("modal-abono");
      mostrarHistorial();
      mostrarDetalleVenta(respuesta.venta);
      mostrarNotificacion(saldoPendienteVenta(respuesta.venta) === 0 ? "La deuda quedó pagada completamente." : "Abono registrado. El saldo sigue pendiente.");
    });
  } catch (error) {
    mostrarErroresEn(erroresAbono, [error.message]);
  }
}

function filaHistorial(venta) {
  const cliente = venta.clienteNombre ? ` · ${escaparHtml(venta.clienteNombre)}` : "";
  const detallePago = venta.metodoPago === "debe"
    ? `Debe (${formatearMoneda(montoPagadoVenta(venta))} pagado | ${formatearMoneda(saldoPendienteVenta(venta))} pendiente)`
    : etiquetaMetodoPago(venta.metodoPago);
  return `
    <div class="historial-item" data-id="${venta.id}">
      <div>
        <p class="historial-titulo">Venta #${venta.id}</p>
        <p class="historial-detalle">${formatearFecha(venta.fechaCierre)} · ${detallePago}${cliente}</p>
      </div>
      <div class="historial-derecha">
        <span class="historial-total">${formatearMoneda(venta.total)}</span>
        <button type="button" class="boton boton-secundario" data-accion="ver-detalle" data-id="${venta.id}">Ver detalle</button>
        <button type="button" class="boton boton-negro" data-accion="ver-factura" data-id="${venta.id}">Ver factura</button>
      </div>
    </div>
  `;
}

function mostrarHistorial() {
  const cerradas = ventasCerradas().sort((a, b) => new Date(b.fechaCierre) - new Date(a.fechaCierre));
  historialLista.innerHTML = cerradas.map(filaHistorial).join("");
  historialVacio.classList.toggle("oculto", cerradas.length !== 0);
}

// Al entrar al historial se vuelve a consultar el servicio
async function recargarHistorial() {
  mostrarEstadoLista(historialEstado, "Actualizando desde el servicio…");
  try {
    await recargarHoja("ventas");
    mostrarEstadoLista(historialEstado, "");
    mostrarHistorial();
    mostrarFactura();
  } catch (error) {
    mostrarEstadoLista(historialEstado, error.message, true);
  }
}

function iniciarHistorial() {
  alEntrarVista.historial = recargarHistorial;

  historialLista.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-accion]");
    if (!boton) return;

    const venta = buscarPorId(datos.ventas, boton.dataset.id);
    if (boton.dataset.accion === "ver-factura") mostrarVistaFactura(venta);
    if (boton.dataset.accion === "ver-detalle") mostrarDetalleVenta(venta);
  });

  contenidoDetalleVenta.addEventListener("click", (evento) => {
    if (evento.target.closest('[data-accion="registrar-abono"]')) abrirModalAbono(ventaEnRevision);
  });

  campoAbono.addEventListener("input", actualizarSaldoRestanteAbono);
  botonConfirmarAbono.addEventListener("click", confirmarAbono);

  botonFacturaDesdeDetalle.addEventListener("click", () => {
    cerrarModal("modal-detalle-venta");
    mostrarVistaFactura(ventaEnRevision);
  });
}
