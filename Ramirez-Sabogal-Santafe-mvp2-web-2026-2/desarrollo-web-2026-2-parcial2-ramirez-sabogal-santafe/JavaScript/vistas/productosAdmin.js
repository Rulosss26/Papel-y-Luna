/* CRUD de productos (los cambios se envían al servicio) */

const tablaProductosCuerpo = document.getElementById("tabla-productos-cuerpo");
const productosVacio = document.getElementById("productos-vacio");
const botonNuevoProducto = document.getElementById("boton-nuevo-producto");

const tituloModalProducto = document.getElementById("titulo-modal-producto");
const erroresProducto = document.getElementById("errores-producto");
const formularioProducto = document.getElementById("formulario-producto");
const botonGuardarProducto = document.getElementById("boton-guardar-producto");

const campoNombre = document.getElementById("campo-nombre");
const campoCategoria = document.getElementById("campo-categoria");
const campoPrecio = document.getElementById("campo-precio");
const campoCosto = document.getElementById("campo-costo");
const campoCodigo = document.getElementById("campo-codigo");
const campoInventario = document.getElementById("campo-inventario");
const campoStock = document.getElementById("campo-stock");

function generarCodigoInterno() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo;

  do {
    codigo = "";
    for (let i = 0; i < 4; i++) {
      codigo += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
  } while (datos.productos.some((producto) => producto.codigoInterno === codigo));

  return codigo;
}

function filaProducto(producto) {
  return `
    <tr data-id="${producto.id}">
      <td data-label="Código">${escaparHtml(producto.codigoInterno)}</td>
      <td data-label="Nombre">${escaparHtml(producto.nombre)}</td>
      <td data-label="Categoría">${escaparHtml(nombreCategoria(producto.categoriaId))}</td>
      <td data-label="Precio venta">${formatearMoneda(producto.precioVenta)}</td>
      <td data-label="Costo">${formatearMoneda(producto.costo)}</td>
      <td data-label="Stock">${producto.seguimientoInventario ? producto.stock : "—"}</td>
      <td data-label="Inventario">${producto.seguimientoInventario ? "Sí" : "No"}</td>
      <td class="celda-acciones">
        <button type="button" class="boton-icono" data-accion="editar" data-id="${producto.id}" title="Editar">🛠️</button>
        <button type="button" class="boton-icono" data-accion="eliminar" data-id="${producto.id}" title="Eliminar">🧹</button>
      </td>
    </tr>
  `;
}

function renderizarTablaProductos() {
  tablaProductosCuerpo.innerHTML = datos.productos.map(filaProducto).join("");
  productosVacio.classList.toggle("oculto", datos.productos.length !== 0);
}

function actualizarVisibilidadStock() {
  const rastrea = campoInventario.value === "si";
  campoStock.disabled = !rastrea;
  if (!rastrea) campoStock.value = "";
}

function validarFormularioProducto() {
  const nombre = campoNombre.value.trim();
  const categoriaId = Number(campoCategoria.value);
  const precioVenta = Number(campoPrecio.value);
  const costo = Number(campoCosto.value);
  const seguimientoInventario = campoInventario.value === "si";
  const stock = seguimientoInventario ? Number(campoStock.value) : null;

  const errores = [];

  if (!nombre) errores.push("El nombre es obligatorio.");
  if (!campoCategoria.value || !buscarCategoria(categoriaId)) errores.push("Selecciona una categoría existente.");
  if (campoPrecio.value === "" || Number.isNaN(precioVenta) || precioVenta < 0) {
    errores.push("El precio de venta debe ser un número mayor o igual a 0.");
  }
  if (campoCosto.value === "" || Number.isNaN(costo) || costo < 0) {
    errores.push("El costo debe ser un número mayor o igual a 0.");
  }
  if (seguimientoInventario && (campoStock.value === "" || !Number.isInteger(stock) || stock < 0)) {
    errores.push("El stock debe ser un número entero mayor o igual a 0 cuando hay seguimiento de inventario.");
  }

  return {
    errores,
    datosProducto: { codigoInterno: campoCodigo.value, nombre, categoriaId, precioVenta, costo, seguimientoInventario, stock }
  };
}

function abrirModalNuevoProducto() {
  productoEnEdicion = null;
  tituloModalProducto.textContent = "Nuevo producto";
  formularioProducto.reset();
  campoCategoria.innerHTML = opcionesCategorias(null);
  campoCodigo.value = generarCodigoInterno();
  campoInventario.value = "si";
  actualizarVisibilidadStock();
  mostrarErroresEn(erroresProducto, datos.categorias.length === 0 ? ["Primero debes crear al menos una categoría (sección Categorías)."] : []);
  abrirModal("modal-producto");
}

function abrirModalEditarProducto(id) {
  const producto = buscarProducto(id);
  if (!producto) return;

  productoEnEdicion = id;
  tituloModalProducto.textContent = "Editar producto";
  campoNombre.value = producto.nombre;
  campoCategoria.innerHTML = opcionesCategorias(producto.categoriaId);
  campoPrecio.value = producto.precioVenta;
  campoCosto.value = producto.costo;
  campoCodigo.value = producto.codigoInterno;
  campoInventario.value = producto.seguimientoInventario ? "si" : "no";
  campoStock.value = producto.seguimientoInventario ? producto.stock : "";
  actualizarVisibilidadStock();
  mostrarErroresEn(erroresProducto, []);
  abrirModal("modal-producto");
}

function despuesDeCambiarProductos() {
  renderizarTablaProductos();
  refrescarCatalogo();
  mostrarFactura();
  mostrarEntidades();
}

async function manejarSubmitProducto(evento) {
  evento.preventDefault();

  const { errores, datosProducto } = validarFormularioProducto();
  mostrarErroresEn(erroresProducto, errores);
  if (errores.length > 0) return;

  try {
    await ejecutarConCarga(botonGuardarProducto, "Guardando…", async () => {
      const guardado =
        productoEnEdicion === null
          ? await api.crear("productos", datosProducto)
          : await api.actualizar("productos", productoEnEdicion, datosProducto);

      guardarEnEstado("productos", guardado);
      sincronizarProductoEnVenta(guardado);
      despuesDeCambiarProductos();
      cerrarModal("modal-producto");
      mostrarNotificacion(productoEnEdicion === null ? "Producto creado." : "Producto actualizado.");
    });
  } catch (error) {
    mostrarErroresEn(erroresProducto, [error.message]);
  }
}

async function eliminarProducto(id, boton) {
  const producto = buscarProducto(id);
  if (!producto) return;

  const confirmado = await confirmarEnApp({
    titulo: "¿Eliminar producto?",
    mensaje: `Se eliminará "${producto.nombre}" del catálogo. Esta acción no se puede deshacer.`,
    textoAceptar: "Eliminar",
    peligro: true,
    icono: "🧹"
  });
  if (!confirmado) return;

  try {
    await ejecutarConCarga(boton, "⏳", async () => {
      await api.eliminar("productos", id);
      quitarDeEstado("productos", id);
      quitarProductoEliminadoDeVenta(id);
      despuesDeCambiarProductos();
      mostrarNotificacion(`"${producto.nombre}" eliminado.`);
    });
  } catch (error) {
    mostrarNotificacion(error.message, "error");
  }
}

function iniciarProductosAdmin() {
  botonNuevoProducto.addEventListener("click", abrirModalNuevoProducto);
  campoInventario.addEventListener("change", actualizarVisibilidadStock);
  formularioProducto.addEventListener("submit", manejarSubmitProducto);

  tablaProductosCuerpo.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button");
    if (!boton) return;

    const id = Number(boton.dataset.id);
    if (boton.dataset.accion === "editar") abrirModalEditarProducto(id);
    if (boton.dataset.accion === "eliminar") eliminarProducto(id, boton);
  });
}
