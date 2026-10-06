/* Funciones de apoyo usadas por todas las vistas */

function formatearMoneda(valor) {
  return "$" + Math.round(Number(valor) || 0).toLocaleString("es-CO");
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return "—";
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return fechaIso;
  return fecha.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

// Para fechas "AAAA-MM-DD" (sin hora), evitando el desfase de zona horaria
function formatearFechaSimple(textoFecha) {
  if (!textoFecha) return "—";
  const [anio, mes, dia] = String(textoFecha).split("-").map(Number);
  if (!anio || !mes || !dia) return textoFecha;
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

function fechaHoyLocal() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// Evita que un texto que viene del servicio se interprete como HTML
function escaparHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mostrarErroresEn(contenedor, errores) {
  if (!errores || errores.length === 0) {
    contenedor.classList.add("oculto");
    contenedor.innerHTML = "";
    return;
  }
  contenedor.innerHTML = `<ul>${errores.map((error) => `<li>${escaparHtml(error)}</li>`).join("")}</ul>`;
  contenedor.classList.remove("oculto");
}

// Mensajes flotantes (éxito / error)
function mostrarNotificacion(mensaje, tipo = "exito") {
  const contenedor = document.getElementById("notificaciones");
  const aviso = document.createElement("div");
  aviso.className = `notificacion notificacion-${tipo}`;
  aviso.textContent = mensaje;
  contenedor.appendChild(aviso);
  setTimeout(() => aviso.remove(), tipo === "error" ? 6000 : 3500);
}

/*
 * Ejecuta una tarea asíncrona deshabilitando el botón mientras tanto.
 * Así se muestra el estado de carga y se evitan envíos duplicados.
 */
async function ejecutarConCarga(boton, textoCargando, tarea) {
  if (boton.disabled) return;
  const textoOriginal = boton.innerHTML;
  boton.disabled = true;
  boton.classList.add("cargando");
  boton.textContent = textoCargando;
  try {
    return await tarea();
  } finally {
    boton.disabled = false;
    boton.classList.remove("cargando");
    boton.innerHTML = textoOriginal;
  }
}

/*
 * Ventana de confirmación dentro de la aplicación (en lugar del confirm() del navegador).
 * Devuelve una promesa: true si la persona acepta, false si cancela o cierra la ventana.
 *   const ok = await confirmarEnApp({ titulo, mensaje, textoAceptar, peligro: true });
 */
function confirmarEnApp({ titulo, mensaje, textoAceptar = "Aceptar", textoCancelar = "Cancelar", peligro = false, icono = "⚠️" }) {
  const modal = document.getElementById("modal-confirmar");
  const botonAceptar = document.getElementById("confirmar-aceptar");
  const botonCancelar = document.getElementById("confirmar-cancelar");

  document.getElementById("confirmar-icono").textContent = icono;
  document.getElementById("confirmar-titulo").textContent = titulo;
  document.getElementById("confirmar-mensaje").textContent = mensaje;
  botonAceptar.textContent = textoAceptar;
  botonCancelar.textContent = textoCancelar;
  botonAceptar.classList.toggle("boton-peligro", peligro);

  modal.classList.remove("oculto");
  botonAceptar.focus();

  return new Promise((resolver) => {
    function terminar(respuesta) {
      modal.classList.add("oculto");
      botonAceptar.removeEventListener("click", alAceptar);
      botonCancelar.removeEventListener("click", alCancelar);
      modal.removeEventListener("click", alClicFondo);
      document.removeEventListener("keydown", alTeclado);
      resolver(respuesta);
    }
    const alAceptar = () => terminar(true);
    const alCancelar = () => terminar(false);
    const alClicFondo = (evento) => {
      if (evento.target === modal) terminar(false);
    };
    const alTeclado = (evento) => {
      if (evento.key === "Escape") terminar(false);
    };

    botonAceptar.addEventListener("click", alAceptar);
    botonCancelar.addEventListener("click", alCancelar);
    modal.addEventListener("click", alClicFondo);
    document.addEventListener("keydown", alTeclado);
  });
}

// Mensaje de "cargando..." o error dentro de una lista
function mostrarEstadoLista(elemento, texto, esError = false) {
  if (!texto) {
    elemento.classList.add("oculto");
    elemento.textContent = "";
    return;
  }
  elemento.textContent = texto;
  elemento.classList.toggle("aviso-error", esError);
  elemento.classList.remove("oculto");
}
