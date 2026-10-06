/* Edición de un producto directamente desde el flujo de venta (nombre, categoría, precio y costo) */

const formularioEdicionRapida = document.getElementById("formulario-edicion-rapida");
const erroresEdicionRapida = document.getElementById("errores-edicion-rapida");
const edicionRapidaCodigo = document.getElementById("edicion-rapida-codigo");
const rapidoNombre = document.getElementById("rapido-nombre");
const rapidoCategoria = document.getElementById("rapido-categoria");
const rapidoPrecio = document.getElementById("rapido-precio");
const rapidoCosto = document.getElementById("rapido-costo");
const botonGuardarRapido = document.getElementById("boton-guardar-rapido");

let productoEdicionRapida = null;

function abrirEdicionRapida(id) {
  const producto = buscarProducto(id);
  if (!producto) return;

  productoEdicionRapida = id;
  edicionRapidaCodigo.textContent = `Código ${producto.codigoInterno}`;
  rapidoNombre.value = producto.nombre;
  rapidoCategoria.innerHTML = opcionesCategorias(producto.categoriaId);
  rapidoPrecio.value = producto.precioVenta;
  rapidoCosto.value = producto.costo;
  mostrarErroresEn(erroresEdicionRapida, []);
  abrirModal("modal-edicion-rapida");
}

function validarEdicionRapida() {
  const nombre = rapidoNombre.value.trim();
  const categoriaId = Number(rapidoCategoria.value);
  const precioVenta = Number(rapidoPrecio.value);
  const costo = Number(rapidoCosto.value);
  const errores = [];

  if (!nombre) errores.push("El nombre es obligatorio.");
  if (!rapidoCategoria.value || !buscarCategoria(categoriaId)) errores.push("Selecciona una categoría.");
  if (rapidoPrecio.value === "" || Number.isNaN(precioVenta) || precioVenta < 0) {
    errores.push("El precio de venta debe ser un número mayor o igual a 0.");
  }
  if (rapidoCosto.value === "" || Number.isNaN(costo) || costo < 0) {
    errores.push("El costo debe ser un número mayor o igual a 0.");
  }

  return { errores, cambios: { nombre, categoriaId, precioVenta, costo } };
}

async function guardarEdicionRapida(evento) {
  evento.preventDefault();

  const { errores, cambios } = validarEdicionRapida();
  mostrarErroresEn(erroresEdicionRapida, errores);
  if (errores.length > 0) return;

  try {
    await ejecutarConCarga(botonGuardarRapido, "Guardando…", async () => {
      // Solo se envían los campos editables: el stock no se toca desde aquí
      const actualizado = await api.actualizar("productos", productoEdicionRapida, cambios);
      guardarEnEstado("productos", actualizado);
      sincronizarProductoEnVenta(actualizado);

      refrescarCatalogo();
      mostrarFactura();
      renderizarTablaProductos();
      cerrarModal("modal-edicion-rapida");
      mostrarNotificacion(`"${actualizado.nombre}" actualizado.`);
    });
  } catch (error) {
    mostrarErroresEn(erroresEdicionRapida, [error.message]);
  }
}

function iniciarEdicionRapida() {
  formularioEdicionRapida.addEventListener("submit", guardarEdicionRapida);
}
