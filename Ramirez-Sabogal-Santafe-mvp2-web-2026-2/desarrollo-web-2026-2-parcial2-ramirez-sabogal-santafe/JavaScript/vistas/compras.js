/* Registro, listado y detalle de compras (suman stock y actualizan el costo de los productos) */

const botonNuevaCompra = document.getElementById("boton-nueva-compra");
const comprasLista = document.getElementById("compras-lista");
const comprasVacio = document.getElementById("compras-vacio");
const comprasEstado = document.getElementById("compras-estado");

const formularioCompra = document.getElementById("formulario-compra");
const erroresCompra = document.getElementById("errores-compra");
const compraProveedor = document.getElementById("compra-proveedor");
const compraFecha = document.getElementById("compra-fecha");
const compraLineas = document.getElementById("compra-lineas");
const botonAgregarLineaCompra = document.getElementById("boton-agregar-linea-compra");
const compraTotal = document.getElementById("compra-total");
const botonRegistrarCompra = document.getElementById("boton-registrar-compra");
const contenidoDetalleCompra = document.getElementById("contenido-detalle-compra");

/* ---------- Listado ---------- */

function filaCompra(compra) {
  const unidades = compra.items.reduce((suma, item) => suma + item.cantidad, 0);
  return `
    <div class="historial-item">
      <div>
        <p class="historial-titulo">Compra #${compra.id}</p>
        <p class="historial-detalle">${formatearFechaSimple(compra.fecha)} · ${escaparHtml(compra.proveedorNombre)} · ${unidades} unidad(es)</p>
      </div>
      <div class="historial-derecha">
        <span class="historial-total">${formatearMoneda(compra.total)}</span>
        <button type="button" class="boton boton-negro" data-accion="ver-compra" data-id="${compra.id}">Ver detalle</button>
      </div>
    </div>
  `;
}

function mostrarCompras() {
  const ordenadas = [...datos.compras].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  comprasLista.innerHTML = ordenadas.map(filaCompra).join("");
  comprasVacio.classList.toggle("oculto", ordenadas.length !== 0);
}

async function recargarCompras() {
  mostrarEstadoLista(comprasEstado, "Actualizando desde el servicio…");
  try {
    await recargarHoja("compras");
    mostrarEstadoLista(comprasEstado, "");
    mostrarCompras();
  } catch (error) {
    mostrarEstadoLista(comprasEstado, error.message, true);
  }
}

function mostrarDetalleCompra(compra) {
  if (!compra) return;
  const proveedor = buscarProveedor(compra.proveedorId);

  contenidoDetalleCompra.innerHTML = `
    <h3>Detalle de la compra #${compra.id}</h3>
    <div class="factura-info">
      <p><strong>Proveedor</strong> ${escaparHtml(compra.proveedorNombre)}</p>
      ${proveedor ? `<p><strong>Contacto</strong> ${escaparHtml(proveedor.telefono)} · ${escaparHtml(proveedor.correo)}</p>` : ""}
      <p><strong>Fecha de la compra</strong> ${formatearFechaSimple(compra.fecha)}</p>
      <p><strong>Registrada</strong> ${formatearFecha(compra.fechaRegistro)}</p>
    </div>

    <table class="tabla-factura">
      <thead>
        <tr><th>Producto</th><th class="col-centro">Cant.</th><th class="col-derecha">Costo unit.</th><th class="col-derecha">Subtotal</th></tr>
      </thead>
      <tbody>
        ${compra.items
          .map(
            (item) => `
              <tr>
                <td>${escaparHtml(item.nombre)}</td>
                <td class="col-centro">${item.cantidad}</td>
                <td class="col-derecha">${formatearMoneda(item.costoUnitario)}</td>
                <td class="col-derecha">${formatearMoneda(item.costoUnitario * item.cantidad)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>

    <div class="factura-totales">
      <p class="total-final"><span>Total</span><span>${formatearMoneda(compra.total)}</span></p>
    </div>
  `;
  abrirModal("modal-detalle-compra");
}

/* ---------- Formulario de nueva compra ---------- */

function opcionesProveedores() {
  if (datos.proveedores.length === 0) return `<option value="">Primero crea un proveedor</option>`;
  return (
    `<option value="">Selecciona un proveedor</option>` +
    [...datos.proveedores]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((proveedor) => `<option value="${proveedor.id}">${escaparHtml(proveedor.nombre)}</option>`)
      .join("")
  );
}

function opcionesProductosCompra() {
  return (
    `<option value="">Selecciona un producto</option>` +
    [...datos.productos]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(
        (producto) =>
          `<option value="${producto.id}">${escaparHtml(producto.nombre)} (${escaparHtml(producto.codigoInterno)})</option>`
      )
      .join("")
  );
}

function agregarLineaCompra() {
  const fila = document.createElement("div");
  fila.className = "compra-linea";
  fila.innerHTML = `
    <div class="compra-campo compra-campo-producto">
      <span class="etiqueta-mini">Producto</span>
      <select class="compra-producto">${opcionesProductosCompra()}</select>
    </div>
    <div class="compra-campo">
      <span class="etiqueta-mini">Cantidad</span>
      <input type="number" class="compra-cantidad" min="1" step="1" value="1">
    </div>
    <div class="compra-campo">
      <span class="etiqueta-mini">Costo unitario</span>
      <input type="number" class="compra-costo" min="0" step="1">
    </div>
    <div class="compra-campo compra-subtotal-col">
      <span class="etiqueta-mini">Subtotal</span>
      <span class="compra-subtotal">$0</span>
    </div>
    <button type="button" class="boton-icono compra-quitar" title="Quitar">🧹</button>
  `;
  compraLineas.appendChild(fila);
  actualizarTotalCompra();
}

function leerLineasCompra() {
  return [...compraLineas.querySelectorAll(".compra-linea")].map((fila) => ({
    fila,
    productoId: fila.querySelector(".compra-producto").value,
    cantidad: fila.querySelector(".compra-cantidad").value,
    costoUnitario: fila.querySelector(".compra-costo").value
  }));
}

function actualizarTotalCompra() {
  let total = 0;
  leerLineasCompra().forEach((linea) => {
    const subtotal = (Number(linea.cantidad) || 0) * (Number(linea.costoUnitario) || 0);
    linea.fila.querySelector(".compra-subtotal").textContent = formatearMoneda(subtotal);
    total += subtotal;
  });
  compraTotal.textContent = formatearMoneda(total);
}

function abrirModalCompra() {
  formularioCompra.reset();
  compraProveedor.innerHTML = opcionesProveedores();
  compraFecha.value = fechaHoyLocal();
  compraFecha.max = fechaHoyLocal();
  compraLineas.innerHTML = "";
  agregarLineaCompra();

  const avisos = [];
  if (datos.proveedores.length === 0) avisos.push("Primero debes crear al menos un proveedor (sección Proveedores).");
  if (datos.productos.length === 0) avisos.push("Primero debes crear productos (sección Productos).");
  mostrarErroresEn(erroresCompra, avisos);

  abrirModal("modal-compra");
}

function validarCompra() {
  const errores = [];
  const proveedorId = Number(compraProveedor.value);
  const fecha = compraFecha.value;

  if (!compraProveedor.value || !buscarProveedor(proveedorId)) errores.push("Selecciona un proveedor.");
  if (!fecha) errores.push("Selecciona la fecha de la compra.");
  else if (fecha > fechaHoyLocal()) errores.push("La fecha de la compra no puede ser futura.");

  const lineas = leerLineasCompra();
  if (lineas.length === 0) errores.push("Agrega al menos un producto.");

  const vistos = new Set();
  const items = [];
  lineas.forEach((linea, indice) => {
    const numero = indice + 1;
    const producto = buscarProducto(linea.productoId);
    const cantidad = Number(linea.cantidad);
    const costoUnitario = Number(linea.costoUnitario);

    if (!producto) {
      errores.push(`Fila ${numero}: selecciona un producto.`);
      return;
    }
    if (vistos.has(producto.id)) errores.push(`Fila ${numero}: "${producto.nombre}" ya está en la compra.`);
    vistos.add(producto.id);
    if (!Number.isInteger(cantidad) || cantidad < 1) errores.push(`Fila ${numero}: la cantidad debe ser un entero mayor a 0.`);
    if (linea.costoUnitario === "" || Number.isNaN(costoUnitario) || costoUnitario < 0) {
      errores.push(`Fila ${numero}: el costo debe ser un número mayor o igual a 0.`);
    }
    items.push({ productoId: producto.id, cantidad, costoUnitario });
  });

  return { errores, compra: { proveedorId, fecha, items } };
}

async function registrarCompra(evento) {
  evento.preventDefault();

  const { errores, compra } = validarCompra();
  mostrarErroresEn(erroresCompra, errores);
  if (errores.length > 0) return;

  try {
    await ejecutarConCarga(botonRegistrarCompra, "Registrando compra…", async () => {
      const respuesta = await api.registrarCompra(compra);

      // El stock y el costo solo cambian cuando el servicio confirma la compra
      guardarEnEstado("compras", respuesta.compra);
      respuesta.productos.forEach((producto) => {
        guardarEnEstado("productos", producto);
        sincronizarProductoEnVenta(producto);
      });

      mostrarCompras();
      renderizarTablaProductos();
      refrescarCatalogo();
      mostrarFactura();
      mostrarEntidades();
      cerrarModal("modal-compra");
      mostrarNotificacion(`Compra #${respuesta.compra.id} registrada. Inventario actualizado.`);
    });
  } catch (error) {
    mostrarErroresEn(erroresCompra, [error.message]);
  }
}

function iniciarCompras() {
  alEntrarVista.compras = recargarCompras;

  botonNuevaCompra.addEventListener("click", abrirModalCompra);
  botonAgregarLineaCompra.addEventListener("click", agregarLineaCompra);
  formularioCompra.addEventListener("submit", registrarCompra);

  compraLineas.addEventListener("input", actualizarTotalCompra);

  compraLineas.addEventListener("change", (evento) => {
    // Al elegir un producto se propone su costo actual
    if (evento.target.classList.contains("compra-producto")) {
      const producto = buscarProducto(evento.target.value);
      const campoCostoLinea = evento.target.closest(".compra-linea").querySelector(".compra-costo");
      if (producto) campoCostoLinea.value = producto.costo;
      actualizarTotalCompra();
    }
  });

  compraLineas.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".compra-quitar");
    if (!boton) return;
    boton.closest(".compra-linea").remove();
    actualizarTotalCompra();
  });

  comprasLista.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-accion='ver-compra']");
    if (!boton) return;
    mostrarDetalleCompra(buscarPorId(datos.compras, boton.dataset.id));
  });
}
