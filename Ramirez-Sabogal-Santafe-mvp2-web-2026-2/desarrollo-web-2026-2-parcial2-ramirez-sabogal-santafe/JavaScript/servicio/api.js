
const URL_SERVICIO = "https://script.google.com/macros/s/AKfycbwLN0gpw69Um0h_WrDqRsOczL4nmLd6MOJyddFswaOzZdnp6i3t2HBmYxgWT3tKOBoa/exec";

const TIEMPO_LIMITE_MS = 30000;

async function solicitarAlServicio(url, opciones = {}) {
  if (!URL_SERVICIO.startsWith("http")) {
    throw new Error("Falta configurar la URL del servicio en JavaScript/servicio/api.js.");
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_MS);

  let respuesta;
  try {
    respuesta = await fetch(url, { ...opciones, signal: controlador.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("El servicio tardó demasiado en responder. Intenta de nuevo.");
    }
    throw new Error("No se pudo conectar con el servicio. Revisa tu conexión a Internet.");
  } finally {
    clearTimeout(temporizador);
  }

  if (!respuesta.ok) {
    throw new Error(`El servicio respondió con un error (${respuesta.status}).`);
  }

  let cuerpo;
  try {
    cuerpo = await respuesta.json();
  } catch (error) {
    throw new Error("La respuesta del servicio no es un JSON válido.");
  }

  if (!cuerpo.ok) {
    console.error("Error del servicio:", cuerpo);
    const mensaje = cuerpo.error || "El servicio no pudo completar la operación.";
    if (mensaje.includes("Acción POST no soportada: registrarAbono")) {
      throw new Error("El servicio publicado aún no reconoce el registro de abonos. Actualiza Code.gs en Apps Script y publica una nueva versión de la aplicación web.");
    }
    throw new Error(mensaje);
  }

  return cuerpo.datos;
}

// GET: lectura de registros
async function obtenerDelServicio(parametros) {
  const consulta = new URLSearchParams(parametros).toString();
  return solicitarAlServicio(`${URL_SERVICIO}?${consulta}`, { method: "GET" });
}

// POST: el JSON se envía como text/plain para que el navegador no haga una petición
// previa (preflight CORS), que Apps Script no responde.
async function enviarAlServicio(cuerpo) {
  return solicitarAlServicio(URL_SERVICIO, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(cuerpo)
  });
}

const api = {
  listar: (hoja) => obtenerDelServicio({ accion: "listar", hoja }),

  crear: (hoja, datos) => enviarAlServicio({ accion: "crear", hoja, datos }),
  actualizar: (hoja, id, datos) => enviarAlServicio({ accion: "actualizar", hoja, id, datos }),
  eliminar: (hoja, id) => enviarAlServicio({ accion: "eliminar", hoja, id }),

  guardarVentaAbierta: (venta) => enviarAlServicio({ accion: "guardarVentaAbierta", datos: venta }),
  cerrarVenta: (venta) => enviarAlServicio({ accion: "cerrarVenta", datos: venta }),
  registrarAbono: (abono) => enviarAlServicio({ accion: "registrarAbono", datos: abono }),
  registrarCompra: (compra) => enviarAlServicio({ accion: "registrarCompra", datos: compra })
};
