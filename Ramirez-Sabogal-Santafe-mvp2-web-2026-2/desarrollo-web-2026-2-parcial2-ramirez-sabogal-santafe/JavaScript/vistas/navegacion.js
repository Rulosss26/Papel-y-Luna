const botonesNav = document.querySelectorAll(".nav-boton");
const vistas = document.querySelectorAll(".vista");

// Acciones que se ejecutan al entrar a una vista (por ejemplo, volver a pedir datos al servicio)
const alEntrarVista = {};

let vistaActual = "vender";

function cambiarVista(nombreVista) {
  vistaActual = nombreVista;
  vistas.forEach((vista) => vista.classList.toggle("oculta", vista.id !== `vista-${nombreVista}`));
  botonesNav.forEach((boton) => boton.classList.toggle("activo", boton.dataset.vista === nombreVista));
  if (alEntrarVista[nombreVista]) alEntrarVista[nombreVista]();
}

function iniciarNavegacion() {
  botonesNav.forEach((boton) => {
    boton.addEventListener("click", () => {
      if (document.body.classList.contains("sin-datos")) return;
      cambiarVista(boton.dataset.vista);
    });
  });
}

function iniciarModalesGenericos() {
  document.body.addEventListener("click", (evento) => {
    const botonCerrar = evento.target.closest("[data-cerrar]");
    if (botonCerrar) {
      document.getElementById(botonCerrar.dataset.cerrar).classList.add("oculto");
      return;
    }

    // La ventana de confirmación maneja su propio cierre (ver confirmarEnApp)
    if (evento.target.classList.contains("modal") && !evento.target.dataset.propio) {
      evento.target.classList.add("oculto");
    }
  });
}

function abrirModal(id) {
  document.getElementById(id).classList.remove("oculto");
}

function cerrarModal(id) {
  document.getElementById(id).classList.add("oculto");
}
