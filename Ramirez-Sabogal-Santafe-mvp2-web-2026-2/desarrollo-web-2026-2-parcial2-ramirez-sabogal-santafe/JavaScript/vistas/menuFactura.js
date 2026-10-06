const invoiceButton = document.getElementById("invoice-icon");
const invoiceMenu = document.getElementById("invoice-menu");
const invoicePanel = document.getElementById("panel-factura");
const invoiceCount = document.getElementById("invoice-count");
const CLAVE_MENU_FACTURA = "menuFacturaAbierto";

function openFacturaMenu() {
  if (!invoiceMenu || !invoiceButton) return;
  invoiceMenu.classList.add("abierto");
  document.body.classList.add("panel-venta-abierto"); // en computador el contenido se corre para no quedar tapado
  invoiceButton.classList.add("activo");
  invoiceButton.setAttribute("aria-expanded", "true");
  invoiceButton.setAttribute("aria-label", "Cerrar venta actual");
  invoiceMenu.setAttribute("aria-hidden", "false");
  try { localStorage.setItem(CLAVE_MENU_FACTURA, "true"); } catch (_) { }
}

function closeFacturaMenu() {
  if (!invoiceMenu || !invoiceButton) return;
  invoiceMenu.classList.remove("abierto");
  document.body.classList.remove("panel-venta-abierto");
  invoiceButton.classList.remove("activo");
  invoiceButton.setAttribute("aria-expanded", "false");
  invoiceButton.setAttribute("aria-label", "Abrir venta actual");
  invoiceMenu.setAttribute("aria-hidden", "true");
  try { localStorage.setItem(CLAVE_MENU_FACTURA, "false"); } catch (_) { }
}

function toggleFacturaMenu() {
  if (invoiceMenu?.classList.contains("abierto")) closeFacturaMenu();
  else openFacturaMenu();
}

function animateInvoiceIcon() {
  if (!invoiceButton) return;
  invoiceButton.classList.remove("pulse");
  void invoiceButton.offsetWidth;
  invoiceButton.classList.add("pulse");
}

function actualizarContadorFactura() {
  if (!invoiceCount || typeof ventaActual === "undefined") return;
  const cantidad = ventaActual.reduce((total, linea) => total + linea.cantidad, 0);
  invoiceCount.textContent = cantidad > 99 ? "99+" : String(cantidad);
  invoiceCount.setAttribute("aria-label", `${cantidad} ${cantidad === 1 ? "producto" : "productos"}`);
}

function iniciarMenuFactura() {
  if (!invoiceButton || !invoiceMenu || !invoicePanel) return;

  // El panel de la venta SOLO se cierra cuando la persona lo decide:
  // con el botón flotante o con el botón "✕ Cerrar" del panel.
  // (Antes se cerraba con cualquier clic afuera o con Esc, y se perdía de vista al agregar productos o pagar.)
  invoiceButton.addEventListener("click", toggleFacturaMenu);
  const botonCerrarPanel = document.getElementById("boton-cerrar-panel-venta");
  if (botonCerrarPanel) botonCerrarPanel.addEventListener("click", closeFacturaMenu);
  invoiceButton.addEventListener("animationend", (evento) => {
    if (evento.animationName === "invoicePulse") invoiceButton.classList.remove("pulse");
  });

  try {
    if (localStorage.getItem(CLAVE_MENU_FACTURA) === "true") openFacturaMenu();
    else closeFacturaMenu();
  } catch (_) {
    closeFacturaMenu();
  }
  actualizarContadorFactura();
}
