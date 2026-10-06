let aplicacionIniciada = false;

const cargaGlobal = document.getElementById("carga-global");
const errorGlobal = document.getElementById("error-global");
const errorGlobalMensaje = document.getElementById("error-global-mensaje");
const botonReintentar = document.getElementById("boton-reintentar");

function renderizarTodo() {
  refrescarCatalogo();
  mostrarFactura();
  renderizarTablaProductos();
  mostrarHistorial();
  mostrarCompras();
  mostrarEntidades();
}

async function cargarAplicacion() {
  document.body.classList.add("sin-datos");
  vistas.forEach((vista) => vista.classList.add("oculta"));
  errorGlobal.classList.add("oculto");
  cargaGlobal.classList.remove("oculto");

  try {
    await cargarDatosIniciales();
    renderizarTodo();
    document.body.classList.remove("sin-datos");
    cambiarVista(vistaActual);
  } catch (error) {
    errorGlobalMensaje.textContent = error.message;
    errorGlobal.classList.remove("oculto");
  } finally {
    cargaGlobal.classList.add("oculto");
  }
}

function iniciarApp() {
  if (!leerRolActivo() && !document.documentElement.classList.contains("rol-recordado")) return;
  if (aplicacionIniciada) return;
  aplicacionIniciada = true;

  iniciarMenuFactura();
  iniciarNavegacion();
  iniciarModalesGenericos();

  iniciarCatalogo();
  iniciarFactura();
  iniciarVentasAbiertas();
  iniciarDeudas();
  iniciarEdicionRapida();
  iniciarModalPago();

  iniciarProductosAdmin();
  iniciarCompras();
  iniciarEntidades();

  iniciarConfirmacion();
  iniciarFacturaOverlay();
  iniciarHistorial();

  botonReintentar.addEventListener("click", cargarAplicacion);
  cargarAplicacion();
}

document.addEventListener("DOMContentLoaded", iniciarApp);
document.addEventListener("rolSeleccionado", iniciarApp);
