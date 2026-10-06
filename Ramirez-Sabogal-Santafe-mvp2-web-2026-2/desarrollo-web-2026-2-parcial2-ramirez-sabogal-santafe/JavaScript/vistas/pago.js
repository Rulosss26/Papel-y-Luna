/* Modal de pago y cierre de la venta (descuenta inventario cuando el servicio confirma) */

const modalPago = document.getElementById("modal-pago");
const spanPagoTotalValor = document.getElementById("pago-total-valor");
const opcionesPago = document.getElementById("opciones-pago");
const selectClientePago = document.getElementById("select-cliente-pago");
const etiquetaClientePago = document.getElementById("etiqueta-cliente-pago");
const camposEfectivo = document.getElementById("campos-efectivo");
const campoRecibido = document.getElementById("campo-recibido");
const spanPagoCambioValor = document.getElementById("pago-cambio-valor");
const avisoPagoInsuficiente = document.getElementById("aviso-pago-insuficiente");
const erroresPago = document.getElementById("errores-pago");
const botonConfirmarVenta = document.getElementById("boton-confirmar-venta");
const opcionesDeuda = document.getElementById("opciones-deuda");
const camposDeudaParcial = document.getElementById("campos-deuda-parcial");
const campoPagoParcial = document.getElementById("campo-pago-parcial");
const totalDeudaParcial = document.getElementById("total-deuda-parcial");
const saldoDeudaParcial = document.getElementById("saldo-deuda-parcial");
const botonCrearClientePago = document.getElementById("boton-crear-cliente-pago");
let volverPagoDespuesDeCrearCliente = false;

function tipoDeudaSeleccionado() {
  return document.querySelector('input[name="tipo-deuda"]:checked')?.value || "total";
}

function mostrarOpcionesPago() {
  opcionesPago.innerHTML = METODOS_PAGO.map(
    (metodo, indice) =>
      `<label><input type="radio" name="metodo-pago" value="${metodo.valor}" ${indice === 0 ? "checked" : ""}> ${metodo.etiqueta}</label>`
  ).join("");
}

function metodoPagoSeleccionado() {
  const radio = document.querySelector('input[name="metodo-pago"]:checked');
  return radio ? radio.value : METODOS_PAGO[0].valor;
}

function actualizarCamposPago() {
  const metodo = metodoPagoSeleccionado();
  const esEfectivo = metodo === "efectivo";
  camposEfectivo.classList.toggle("oculto", !esEfectivo);
  if (!esEfectivo) avisoPagoInsuficiente.classList.add("oculto");
  const esDebe = metodo === "debe";
  opcionesDeuda.classList.toggle("oculto", !esDebe);
  camposDeudaParcial.classList.toggle("oculto", !esDebe || tipoDeudaSeleccionado() !== "parcial");

  etiquetaClientePago.textContent = metodo === "debe" ? "Cliente (obligatorio para Debe)" : "Cliente (opcional)";
  mostrarErroresEn(erroresPago, []);
}

function actualizarSaldoParcial() {
  const total = calcularTotales().total;
  const pagado = Number(campoPagoParcial.value);
  totalDeudaParcial.value = total;
  saldoDeudaParcial.value = Math.max(total - (Number.isFinite(pagado) ? pagado : 0), 0);
  if (campoPagoParcial.value && pagado > total) {
    mostrarErroresEn(erroresPago, ["El monto pagado no puede superar el total de la venta."]);
  } else {
    mostrarErroresEn(erroresPago, []);
  }
}

function actualizarCambio() {
  const total = calcularTotales().total;
  const recibido = Number(campoRecibido.value) || 0;
  const cambio = recibido - total;

  spanPagoCambioValor.textContent = formatearMoneda(Math.max(cambio, 0));
  avisoPagoInsuficiente.classList.toggle("oculto", recibido === 0 || cambio >= 0);
}

function abrirModalPago() {
  if (ventaActual.length === 0) return;

  spanPagoTotalValor.textContent = formatearMoneda(calcularTotales().total);
  document.querySelector(`input[name="metodo-pago"][value="${METODOS_PAGO[0].valor}"]`).checked = true;
  selectClientePago.innerHTML = opcionesClientes(clienteVentaId);
  campoRecibido.value = "";
  document.querySelector('input[name="tipo-deuda"][value="total"]').checked = true;
  campoPagoParcial.value = "";
  totalDeudaParcial.value = calcularTotales().total;
  saldoDeudaParcial.value = calcularTotales().total;
  actualizarCamposPago();
  actualizarCambio();

  // Aviso anticipado si algún producto no tiene stock suficiente
  const sinStock = lineasSinStock();
  if (sinStock.length > 0) mostrarErroresEn(erroresPago, mensajesSinStock(sinStock));

  abrirModal("modal-pago");
}

function mensajesSinStock(lista) {
  return lista.map(
    (item) => `Stock insuficiente de "${item.nombre}": disponible ${item.disponible}, en la venta ${item.solicitado}.`
  );
}

async function confirmarVenta() {
  const metodo = metodoPagoSeleccionado();
  const totales = calcularTotales();
  const errores = [];
  let valorRecibido = null;
  let cambio = null;
  const tipoDeuda = metodo === "debe" ? tipoDeudaSeleccionado() : null;
  let montoPagado = totales.total;

  if (metodo === "efectivo") {
    valorRecibido = Number(campoRecibido.value) || 0;
    if (valorRecibido < totales.total) {
      avisoPagoInsuficiente.classList.remove("oculto");
      errores.push("El valor recibido es menor al total.");
    }
    cambio = valorRecibido - totales.total;
  }

  if (metodo === "debe" && clienteVentaId === null) {
    errores.push('El método de pago "Debe" requiere seleccionar un cliente.');
  }

  if (metodo === "debe") {
    montoPagado = tipoDeuda === "parcial" ? Number(campoPagoParcial.value) : 0;
    if (tipoDeuda === "parcial" && (!campoPagoParcial.value || !Number.isFinite(montoPagado) || montoPagado <= 0)) {
      errores.push("Ingresa un monto pagado mayor a 0 para registrar el pago parcial.");
    } else if (tipoDeuda === "parcial" && montoPagado > totales.total) {
      errores.push("El monto pagado no puede superar el total de la venta.");
    }
  }

  errores.push(...mensajesSinStock(lineasSinStock()));

  mostrarErroresEn(erroresPago, errores);
  if (errores.length > 0) return;

  try {
    await ejecutarConCarga(botonConfirmarVenta, "Registrando venta…", async () => {
      const respuesta = await api.cerrarVenta({
        ...datosVentaParaServicio(),
        metodoPago: metodo,
        valorRecibido,
        cambio,
        tipoDeuda,
        montoPagado
      });

      // El stock solo cambia aquí, cuando el servicio ya confirmó la venta
      guardarEnEstado("ventas", respuesta.venta);
      respuesta.productos.forEach((producto) => guardarEnEstado("productos", producto));

      reiniciarVenta();
      cerrarModal("modal-pago");
      refrescarCatalogo();
      renderizarTablaProductos();
      mostrarHistorial();
      mostrarConfirmacion(respuesta.venta);
    });
  } catch (error) {
    mostrarErroresEn(erroresPago, [error.message]);
    // Si el servicio detectó stock insuficiente, el stock local puede estar desactualizado: se vuelve a pedir
    if (error.message.startsWith("Stock insuficiente")) {
      try {
        await recargarHoja("productos");
        refrescarCatalogo();
        renderizarTablaProductos();
        mostrarFactura();
      } catch (errorRecarga) {
        /* se mantiene el mensaje original */
      }
    }
  }
}

function iniciarModalPago() {
  mostrarOpcionesPago();

  opcionesPago.addEventListener("change", () => {
    actualizarCamposPago();
    actualizarCambio();
  });

  opcionesDeuda.addEventListener("change", () => {
    actualizarCamposPago();
    actualizarSaldoParcial();
  });

  selectClientePago.addEventListener("change", () => {
    clienteVentaId = selectClientePago.value ? Number(selectClientePago.value) : null;
    marcarCambiosVenta();
    mostrarErroresEn(erroresPago, []);
    mostrarFactura();
  });

  campoRecibido.addEventListener("input", actualizarCambio);
  campoPagoParcial.addEventListener("input", actualizarSaldoParcial);
  botonCrearClientePago.addEventListener("click", () => {
    volverPagoDespuesDeCrearCliente = true;
    cerrarModal("modal-pago");
    cambiarVista("clientes");
    document.querySelector('#vista-clientes [data-accion="nuevo"]')?.click();
  });
  botonConfirmarVenta.addEventListener("click", confirmarVenta);
}
