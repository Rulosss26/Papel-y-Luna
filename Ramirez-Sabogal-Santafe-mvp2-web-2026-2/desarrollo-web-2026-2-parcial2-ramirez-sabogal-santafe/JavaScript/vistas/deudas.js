/*
 * Ventas con deuda (método de pago "Debe").
 * Aparecen en "Ventas abiertas" mientras tengan saldo pendiente. Desde ahí se puede entrar a cada una,
 * ver cuánto debe el cliente, registrar un abono y ver el nuevo saldo.
 * Registrar un abono NO cambia los productos ni el total de la venta, ni el inventario.
 */

const deudasLista = document.getElementById("deudas-lista");
const deudasVacio = document.getElementById("deudas-vacio");

const contenidoDeuda = document.getElementById("contenido-deuda");
const formularioDeuda = document.getElementById("formulario-deuda");
const campoAbonoDeuda = document.getElementById("campo-abono-deuda");
const botonPagarTodoDeuda = document.getElementById("boton-pagar-todo-deuda");
const nuevoSaldoDeuda = document.getElementById("nuevo-saldo-deuda");
const erroresDeuda = document.getElementById("errores-deuda");
const botonRegistrarAbonoDeuda = document.getElementById("boton-registrar-abono-deuda");
const botonVolverAbiertas = document.getElementById("boton-volver-abiertas");

let ventaDeudaActual = null;

/* ---------- Lista dentro de "Ventas abiertas" ---------- */

function filaVentaConDeuda(venta) {
  return `
    <div class="historial-item">
      <div>
        <p class="historial-titulo">
          Venta #${venta.id}
          <span class="etiqueta-estado etiqueta-deuda">Debe ${formatearMoneda(saldoPendienteVenta(venta))}</span>
        </p>
        <p class="historial-detalle">
          ${formatearFecha(venta.fechaCierre)} · ${escaparHtml(venta.clienteNombre || "Sin cliente")} ·
          Total ${formatearMoneda(venta.total)} · Pagado ${formatearMoneda(montoPagadoVenta(venta))}
        </p>
      </div>
      <div class="historial-derecha">
        <button type="button" class="boton boton-negro" data-accion="ver-deuda" data-id="${venta.id}">Ver deuda / Abonar</button>
      </div>
    </div>
  `;
}

function mostrarVentasConDeuda() {
  const conDeuda = ventasConDeuda().sort((a, b) => b.id - a.id);
  deudasLista.innerHTML = conDeuda.map(filaVentaConDeuda).join("");
  deudasVacio.classList.toggle("oculto", conDeuda.length !== 0);
}

/* ---------- Ventana de la deuda ---------- */

function htmlDetalleDeuda(venta) {
  const saldo = saldoPendienteVenta(venta);
  const abonos = Array.isArray(venta.abonos) ? venta.abonos : [];

  const filasProductos = venta.items
    .map(
      (item) => `
        <tr>
          <td>${escaparHtml(item.nombre)}</td>
          <td class="col-centro">${item.cantidad}</td>
          <td class="col-derecha">${formatearMoneda(item.precio * item.cantidad)}</td>
        </tr>
      `
    )
    .join("");

  const filasAbonos = abonos.length
    ? abonos
        .map(
          (abono, indice) => `
            <tr>
              <td>Abono ${indice + 1}</td>
              <td>${formatearFecha(abono.fecha)}</td>
              <td class="col-derecha">${formatearMoneda(abono.monto)}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="3" class="texto-suave">Todavía no ha hecho abonos.</td></tr>`;

  return `
    <h3>Venta #${venta.id} · ${saldo > 0 ? "Con saldo pendiente" : "Pagada completamente ✨"}</h3>
    <div class="factura-info">
      <p><strong>Cliente</strong> ${escaparHtml(venta.clienteNombre || "Sin cliente")}</p>
      <p><strong>Fecha de la venta</strong> ${formatearFecha(venta.fechaCierre)}</p>
    </div>

    <table class="tabla-factura">
      <thead><tr><th>Producto</th><th class="col-centro">Cant.</th><th class="col-derecha">Subtotal</th></tr></thead>
      <tbody>${filasProductos}</tbody>
    </table>

    <div class="resumen-deuda">
      <p><span>Total de la venta</span><strong>${formatearMoneda(venta.total)}</strong></p>
      <p><span>Ha pagado</span><strong>${formatearMoneda(montoPagadoVenta(venta))}</strong></p>
      <p class="resumen-deuda-saldo"><span>${saldo > 0 ? "Debe" : "Pagó todo lo que debía"}</span><strong>${formatearMoneda(saldo)}</strong></p>
    </div>

    <h4>Abonos</h4>
    <table class="tabla-factura">
      <thead><tr><th>Pago</th><th>Fecha</th><th class="col-derecha">Valor</th></tr></thead>
      <tbody>${filasAbonos}</tbody>
    </table>
  `;
}

function mostrarDeuda(venta) {
  ventaDeudaActual = venta;
  const saldo = saldoPendienteVenta(venta);

  contenidoDeuda.innerHTML = htmlDetalleDeuda(venta);

  // Si ya pagó todo, se ocultan el campo y el botón de abonar
  const pagada = saldo <= 0;
  formularioDeuda.classList.toggle("oculto", pagada);
  botonRegistrarAbonoDeuda.classList.toggle("oculto", pagada);

  campoAbonoDeuda.value = "";
  campoAbonoDeuda.max = Math.round(saldo);
  mostrarErroresEn(erroresDeuda, []);
  actualizarNuevoSaldoDeuda();
}

function abrirDeuda(id) {
  const venta = buscarPorId(datos.ventas, id);
  if (!venta) return;
  cerrarModal("modal-ventas-abiertas");
  mostrarDeuda(venta);
  abrirModal("modal-deuda");
}

function actualizarNuevoSaldoDeuda() {
  if (!ventaDeudaActual) return;
  const abono = Math.max(Number(campoAbonoDeuda.value) || 0, 0);
  const nuevoSaldo = Math.max(saldoPendienteVenta(ventaDeudaActual) - abono, 0);
  nuevoSaldoDeuda.textContent =
    abono > 0 && nuevoSaldo === 0 ? "$0 · ¡Queda a paz y salvo! ✨" : formatearMoneda(nuevoSaldo);
}

async function registrarAbonoDeuda() {
  const saldo = saldoPendienteVenta(ventaDeudaActual);
  const monto = Number(campoAbonoDeuda.value);
  const errores = [];

  if (!campoAbonoDeuda.value || !Number.isFinite(monto) || monto <= 0) errores.push("Escribe un valor mayor a 0.");
  else if (monto > saldo) errores.push(`El abono no puede ser mayor a lo que debe (${formatearMoneda(saldo)}).`);

  mostrarErroresEn(erroresDeuda, errores);
  if (errores.length > 0) return;

  try {
    await ejecutarConCarga(botonRegistrarAbonoDeuda, "Registrando abono…", async () => {
      const respuesta = await api.registrarAbono({ ventaId: ventaDeudaActual.id, monto });
      const ventaActualizada = respuesta.venta;

      guardarEnEstado("ventas", ventaActualizada);
      mostrarDeuda(ventaActualizada); // se queda en la misma venta mostrando el nuevo saldo
      mostrarHistorial();
      mostrarEntidades();
      mostrarFactura(); // actualiza el contador de "Ventas abiertas"

      const nuevoSaldo = saldoPendienteVenta(ventaActualizada);
      mostrarNotificacion(
        nuevoSaldo === 0
          ? `✨ ${ventaActualizada.clienteNombre} pagó todo lo que debía de la venta #${ventaActualizada.id}.`
          : `Abono registrado. Nuevo saldo: ${formatearMoneda(nuevoSaldo)}.`
      );
    });
  } catch (error) {
    mostrarErroresEn(erroresDeuda, [error.message]);
  }
}

function iniciarDeudas() {
  deudasLista.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-accion='ver-deuda']");
    if (!boton) return;
    abrirDeuda(Number(boton.dataset.id));
  });

  campoAbonoDeuda.addEventListener("input", () => {
    mostrarErroresEn(erroresDeuda, []);
    actualizarNuevoSaldoDeuda();
  });

  botonPagarTodoDeuda.addEventListener("click", () => {
    campoAbonoDeuda.value = Math.round(saldoPendienteVenta(ventaDeudaActual));
    mostrarErroresEn(erroresDeuda, []);
    actualizarNuevoSaldoDeuda();
  });

  botonRegistrarAbonoDeuda.addEventListener("click", registrarAbonoDeuda);

  botonVolverAbiertas.addEventListener("click", () => {
    cerrarModal("modal-deuda");
    abrirVentasAbiertas();
  });
}
