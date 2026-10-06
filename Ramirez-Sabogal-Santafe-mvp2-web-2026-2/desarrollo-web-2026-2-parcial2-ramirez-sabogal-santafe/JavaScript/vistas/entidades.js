/*
 * Gestión de Categorías, Proveedores y Clientes (listado, búsqueda, creación, edición y eliminación).
 * Las tres vistas comparten el mismo código y se diferencian por su configuración.
 */

const CONFIG_ENTIDADES = {
  categorias: {
    titulo: "Categorías",
    singular: "categoría",
    femenino: true,
    campos: [{ clave: "nombre", etiqueta: "Nombre", tipo: "text" }],
    asociados: {
      etiqueta: "Productos",
      descripcion: "producto(s)",
      contar: (id) => datos.productos.filter((producto) => producto.categoriaId === id).length
    }
  },
  proveedores: {
    titulo: "Proveedores",
    singular: "proveedor",
    campos: [
      { clave: "nombre", etiqueta: "Nombre", tipo: "text" },
      { clave: "telefono", etiqueta: "Teléfono", tipo: "tel" },
      { clave: "correo", etiqueta: "Correo", tipo: "email" }
    ],
    asociados: {
      etiqueta: "Compras",
      descripcion: "compra(s)",
      contar: (id) => datos.compras.filter((compra) => compra.proveedorId === id).length
    }
  },
  clientes: {
    titulo: "Clientes",
    singular: "cliente",
    campos: [
      { clave: "nombre", etiqueta: "Nombre", tipo: "text" },
      { clave: "telefono", etiqueta: "Teléfono", tipo: "tel" },
      { clave: "correo", etiqueta: "Correo", tipo: "email" }
    ],
    asociados: {
      etiqueta: "Ventas",
      descripcion: "venta(s)",
      contar: (id) => datos.ventas.filter((venta) => venta.clienteId === id).length
    }
  }
};

const tituloModalEntidad = document.getElementById("titulo-modal-entidad");
const erroresEntidad = document.getElementById("errores-entidad");
const formularioEntidad = document.getElementById("formulario-entidad");
const camposEntidad = document.getElementById("campos-entidad");
const botonGuardarEntidad = document.getElementById("boton-guardar-entidad");

let entidadEnFormulario = null; // "categorias" | "proveedores" | "clientes"
let registroEnEdicion = null; // id o null si es nuevo

/* ---------- Estructura de cada vista ---------- */

function construirVistaEntidad(hoja) {
  const config = CONFIG_ENTIDADES[hoja];
  const vista = document.getElementById(`vista-${hoja}`);

  vista.innerHTML = `
    <section class="panel-productos">
      <div class="barra-catalogo">
        <h2>${config.titulo}</h2>
        <div class="barra-acciones">
          <input type="text" class="input-buscar-entidad" data-hoja="${hoja}" placeholder="Buscar ${config.titulo.toLowerCase()}" autocomplete="off">
          <button type="button" class="boton boton-negro" data-accion="nuevo" data-hoja="${hoja}">+ ${config.femenino ? "Nueva" : "Nuevo"} ${config.singular}</button>
        </div>
      </div>

      <div class="tabla-scroll">
        <table class="tabla-datos">
          <thead>
            <tr>
              ${config.campos.map((campo) => `<th>${campo.etiqueta}</th>`).join("")}
              <th>${config.asociados.etiqueta}</th>
              ${hoja === "clientes" ? "<th>Cuenta por cobrar</th>" : ""}
              <th></th>
            </tr>
          </thead>
          <tbody id="tabla-${hoja}-cuerpo"></tbody>
        </table>
      </div>
      <p id="vacio-${hoja}" class="texto-suave oculto"></p>
    </section>
  `;
}

function filaEntidad(hoja, registro) {
  const config = CONFIG_ENTIDADES[hoja];
  const ventasCliente = hoja === "clientes" ? datos.ventas.filter((venta) => venta.clienteId === registro.id) : [];
  const deudasActivas = ventasCliente.filter((venta) => saldoPendienteVenta(venta) > 0);
  const totalDeuda = deudasActivas.reduce((suma, venta) => suma + saldoPendienteVenta(venta), 0);
  const abonosCliente = ventasCliente.flatMap((venta) => (Array.isArray(venta.abonos) ? venta.abonos.map((abono) => ({ ...abono, ventaId: venta.id })) : []));
  const cuentaCliente = hoja === "clientes" ? `
      <td data-label="Cuenta por cobrar">
        <strong>${formatearMoneda(totalDeuda)}</strong>
        ${deudasActivas.length ? `<details><summary>${deudasActivas.length} deuda(s) activa(s)</summary>
          <ul>${deudasActivas.map((venta) => `<li>Venta #${venta.id}: ${formatearMoneda(saldoPendienteVenta(venta))}${Array.isArray(venta.abonos) && venta.abonos.length ? `<ul>${venta.abonos.map((abono) => `<li>Abono ${formatearFecha(abono.fecha)}: ${formatearMoneda(abono.monto)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul>
        </details>` : `<span class="texto-suave">Sin saldo pendiente</span>`}
        ${abonosCliente.length ? `<details><summary>Histórico de ${abonosCliente.length} abono(s)</summary><ul>${abonosCliente.map((abono) => `<li>Venta #${abono.ventaId} · ${formatearFecha(abono.fecha)}: ${formatearMoneda(abono.monto)}</li>`).join("")}</ul></details>` : ""}
      </td>` : "";
  return `
    <tr>
      ${config.campos.map((campo) => `<td data-label="${campo.etiqueta}">${escaparHtml(registro[campo.clave])}</td>`).join("")}
      <td data-label="${config.asociados.etiqueta}">${config.asociados.contar(registro.id)}</td>
      ${cuentaCliente}
      <td class="celda-acciones">
        <button type="button" class="boton-icono" data-accion="editar" data-hoja="${hoja}" data-id="${registro.id}" title="Editar">🛠️</button>
        <button type="button" class="boton-icono" data-accion="eliminar" data-hoja="${hoja}" data-id="${registro.id}" title="Eliminar">🧹</button>
      </td>
    </tr>
  `;
}

function mostrarEntidad(hoja) {
  const config = CONFIG_ENTIDADES[hoja];
  const vista = document.getElementById(`vista-${hoja}`);
  const texto = vista.querySelector(".input-buscar-entidad").value.trim().toLowerCase();

  const filtrados = [...datos[hoja]]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .filter(
      (registro) =>
        texto === "" || config.campos.some((campo) => String(registro[campo.clave] ?? "").toLowerCase().includes(texto))
    );

  document.getElementById(`tabla-${hoja}-cuerpo`).innerHTML = filtrados.map((registro) => filaEntidad(hoja, registro)).join("");

  const vacio = document.getElementById(`vacio-${hoja}`);
  vacio.textContent =
    datos[hoja].length === 0 ? `Todavía no hay ${config.titulo.toLowerCase()} registrados.` : "No hay resultados para tu búsqueda.";
  vacio.classList.toggle("oculto", filtrados.length !== 0);
}

function mostrarEntidades() {
  Object.keys(CONFIG_ENTIDADES).forEach(mostrarEntidad);
}

/* ---------- Formulario ---------- */

function abrirFormularioEntidad(hoja, id) {
  const config = CONFIG_ENTIDADES[hoja];
  const registro = id ? buscarPorId(datos[hoja], id) : null;

  entidadEnFormulario = hoja;
  registroEnEdicion = registro ? registro.id : null;
  tituloModalEntidad.textContent = registro
    ? `Editar ${config.singular}`
    : `${config.femenino ? "Nueva" : "Nuevo"} ${config.singular}`;

  camposEntidad.innerHTML = config.campos
    .map(
      (campo) => `
        <label for="entidad-${campo.clave}">${campo.etiqueta}</label>
        <input type="${campo.tipo}" id="entidad-${campo.clave}" data-clave="${campo.clave}" value="${escaparHtml(registro ? registro[campo.clave] : "")}">
      `
    )
    .join("");

  mostrarErroresEn(erroresEntidad, []);
  abrirModal("modal-entidad");
  camposEntidad.querySelector("input").focus();
}

function leerFormularioEntidad() {
  const valores = {};
  camposEntidad.querySelectorAll("input").forEach((input) => {
    valores[input.dataset.clave] = input.value.trim();
  });
  return valores;
}

function validarEntidad(hoja, valores) {
  const config = CONFIG_ENTIDADES[hoja];
  const errores = [];

  if (!valores.nombre) errores.push(`El nombre ${config.femenino ? "de la" : "del"} ${config.singular} es obligatorio.`);

  if (hoja === "categorias") {
    const repetida = datos.categorias.some(
      (categoria) => categoria.id !== registroEnEdicion && categoria.nombre.toLowerCase() === valores.nombre.toLowerCase()
    );
    if (repetida) errores.push(`Ya existe una categoría llamada "${valores.nombre}".`);
  } else {
    if (!/^[0-9+\-\s()]{7,20}$/.test(valores.telefono)) errores.push("El teléfono debe tener entre 7 y 20 dígitos.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.correo)) errores.push("Escribe un correo válido (ejemplo@correo.com).");
  }

  return errores;
}

async function guardarEntidad(evento) {
  evento.preventDefault();
  const hoja = entidadEnFormulario;
  const valores = leerFormularioEntidad();

  const errores = validarEntidad(hoja, valores);
  mostrarErroresEn(erroresEntidad, errores);
  if (errores.length > 0) return;

  const esNuevo = registroEnEdicion === null;

  try {
    await ejecutarConCarga(botonGuardarEntidad, "Guardando…", async () => {
      const guardado = esNuevo ? await api.crear(hoja, valores) : await api.actualizar(hoja, registroEnEdicion, valores);
      guardarEnEstado(hoja, guardado);
      refrescarDependientesDeEntidades();
      cerrarModal("modal-entidad");
      if (hoja === "clientes" && esNuevo && volverPagoDespuesDeCrearCliente) {
        volverPagoDespuesDeCrearCliente = false;
        clienteVentaId = guardado.id;
        abrirModalPago();
      }
      const config = CONFIG_ENTIDADES[hoja];
      const terminacion = config.femenino ? "a" : "o";
      mostrarNotificacion(`"${guardado.nombre}" ${esNuevo ? "cread" : "actualizad"}${terminacion}.`);
    });
  } catch (error) {
    mostrarErroresEn(erroresEntidad, [error.message]);
  }
}

async function eliminarEntidad(hoja, id, boton) {
  const config = CONFIG_ENTIDADES[hoja];
  const registro = buscarPorId(datos[hoja], id);
  if (!registro) return;

  // No se puede eliminar si tiene registros asociados
  const cantidad = config.asociados.contar(registro.id);
  if (cantidad > 0) {
    mostrarNotificacion(
      `No se puede eliminar "${registro.nombre}" porque tiene ${cantidad} ${config.asociados.descripcion} asociado(s).`,
      "error"
    );
    return;
  }

  const confirmado = await confirmarEnApp({
    titulo: `¿Eliminar ${config.femenino ? "la" : "el"} ${config.singular}?`,
    mensaje: `Se eliminará "${registro.nombre}". Esta acción no se puede deshacer.`,
    textoAceptar: "Eliminar",
    peligro: true,
    icono: "🧹"
  });
  if (!confirmado) return;

  try {
    await ejecutarConCarga(boton, "⏳", async () => {
      await api.eliminar(hoja, registro.id);
      quitarDeEstado(hoja, registro.id);
      refrescarDependientesDeEntidades();
      mostrarNotificacion(`"${registro.nombre}" eliminad${config.femenino ? "a" : "o"}.`);
    });
  } catch (error) {
    mostrarNotificacion(error.message, "error");
  }
}

// Categorías, proveedores y clientes aparecen en otras vistas (catálogo, tabla de productos, venta)
function refrescarDependientesDeEntidades() {
  mostrarEntidades();
  refrescarCatalogo();
  renderizarTablaProductos();
  mostrarFactura();
  mostrarCompras();
}

function iniciarEntidades() {
  Object.keys(CONFIG_ENTIDADES).forEach((hoja) => {
    construirVistaEntidad(hoja);
    const vista = document.getElementById(`vista-${hoja}`);

    vista.querySelector(".input-buscar-entidad").addEventListener("input", () => mostrarEntidad(hoja));

    vista.addEventListener("click", (evento) => {
      const boton = evento.target.closest("button[data-accion]");
      if (!boton) return;

      if (boton.dataset.accion === "nuevo") abrirFormularioEntidad(hoja, null);
      if (boton.dataset.accion === "editar") abrirFormularioEntidad(hoja, Number(boton.dataset.id));
      if (boton.dataset.accion === "eliminar") eliminarEntidad(hoja, Number(boton.dataset.id), boton);
    });
  });

  formularioEntidad.addEventListener("submit", guardarEntidad);
}
