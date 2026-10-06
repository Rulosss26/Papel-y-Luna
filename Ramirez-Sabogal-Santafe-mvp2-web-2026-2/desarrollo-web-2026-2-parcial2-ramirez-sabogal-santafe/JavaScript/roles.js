const CLAVE_ROL = "rolActivo";
const rolesPermitidos = ["cajero", "administrador"];

function leerRolActivo() {
  try {
    const rol = localStorage.getItem(CLAVE_ROL);
    return rolesPermitidos.includes(rol) ? rol : null;
  } catch (_) {
    return null;
  }
}

function aplicarRol(rol) {
  const esAdministrador = rol === "administrador";
  document.querySelectorAll(".solo-administrador").forEach((boton) => {
    boton.hidden = !esAdministrador;
  });
  document.documentElement.classList.remove("rol-pendiente");
  document.documentElement.classList.add("rol-recordado");
  document.getElementById("splash-screen").setAttribute("aria-hidden", "true");
}

document.addEventListener("DOMContentLoaded", () => {
  const splash = document.getElementById("splash-screen");
  const mensaje = document.getElementById("splash-mensaje");
  const botones = splash.querySelectorAll("[data-rol]");
  const botonCambiarRol = document.getElementById("cambiar-rol");
  let rolEnMemoria = leerRolActivo();

  if (rolEnMemoria) aplicarRol(rolEnMemoria);
  else document.documentElement.classList.add("rol-pendiente");

  botones.forEach((boton) => {
    boton.addEventListener("click", () => {
      const rol = boton.dataset.rol;
      botones.forEach((elemento) => { elemento.disabled = true; });
      mensaje.textContent = "Preparando tu espacio…";

      try {
        localStorage.setItem(CLAVE_ROL, rol);
        rolEnMemoria = rol;
      } catch (_) {
        rolEnMemoria = rol;
        mensaje.textContent = "No se pudo guardar el rol; se conservará mientras esta pestaña esté abierta.";
      }

      window.setTimeout(() => {
        aplicarRol(rolEnMemoria);
        splash.classList.add("splash-saliendo");
        window.setTimeout(() => {
          splash.hidden = true;
          splash.classList.remove("splash-saliendo");
          document.dispatchEvent(new CustomEvent("rolSeleccionado", { detail: { rol: rolEnMemoria } }));
        }, 300);
      }, 300);
    });
  });

  botonCambiarRol.addEventListener("click", () => {
    // Al cambiar de rol se cierra el panel de la venta actual
    if (typeof closeFacturaMenu === "function") closeFacturaMenu();
    try { localStorage.removeItem(CLAVE_ROL); } catch (_) { }
    rolEnMemoria = null;
    document.documentElement.classList.remove("rol-recordado");
    document.documentElement.classList.add("rol-pendiente");
    splash.hidden = false;
    splash.removeAttribute("aria-hidden");
    mensaje.textContent = "";
    botones.forEach((boton) => { boton.disabled = false; });
  });
});
