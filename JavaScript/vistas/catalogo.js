const divProductos = document.getElementById("productos");
const divCategorias = document.getElementById("categorias");
const inputBuscar = document.getElementById("input-buscar");
const mensajeSinResultados = document.getElementById("sin-resultados");

function crearChipCategoria(valor, nombre) {
  const activa = String(valor) === String(categoriaActual) ? "activa" : "";
  return `<button type="button" class="chip-categoria ${activa}" data-categoria="${valor}">${escaparHtml(nombre)}</button>`;
}

function mostrarCategorias() {
  const categoriasOrdenadas = [...datos.categorias].sort((a, b) => a.nombre.localeCompare(b.nombre));
  divCategorias.innerHTML =
    crearChipCategoria("todas", "Todas") +
    categoriasOrdenadas.map((categoria) => crearChipCategoria(categoria.id, categoria.nombre)).join("");
}

function textoStock(producto) {
  if (!producto.seguimientoInventario) return "";
  const clase = producto.stock > 0 ? "stock-ok" : "stock-agotado";
  const texto = producto.stock > 0 ? `Stock: ${producto.stock}` : "Agotado";
  return `<span class="producto-stock ${clase}">${texto}</span>`;
}

function crearTarjetaProducto(producto) {
  const div = document.createElement("div");
  div.className = "producto";
  div.dataset.id = producto.id;

  div.innerHTML = `
    <div class="producto-cabecera">
      <div class="producto-datos">
        <h3>${escaparHtml(producto.nombre)}</h3>
        <span class="producto-meta">${escaparHtml(nombreCategoria(producto.categoriaId))}</span>
        ${textoStock(producto)}
      </div>
      <div class="producto-precio-col">
        <div class="producto-badges">
          <span class="id-badge">${escaparHtml(producto.codigoInterno)}</span>
          <button type="button" class="boton-icono" data-accion="editar-rapido" data-id="${producto.id}" title="Editar producto">🛠️</button>
        </div>
        <span class="precio">${formatearMoneda(producto.precioVenta)}</span>
      </div>
    </div>
    <div class="producto-pie">
      <div class="control-cantidad-tarjeta">
        <button type="button" class="btn-cant" data-accion="restar" data-id="${producto.id}">−</button>
        <input type="number" class="input-cantidad" data-id="${producto.id}" min="1" step="1" value="1" inputmode="numeric" aria-label="Cantidad de ${escaparHtml(producto.nombre)}">
        <button type="button" class="btn-cant" data-accion="sumar" data-id="${producto.id}">+</button>
      </div>
      <button type="button" class="boton boton-negro" data-accion="agregar" data-id="${producto.id}">Agregar</button>
    </div>
  `;

  return div;
}

function mostrarProductos(lista) {
  divProductos.innerHTML = "";
  mensajeSinResultados.classList.toggle("oculto", lista.length !== 0);
  lista.forEach((producto) => divProductos.appendChild(crearTarjetaProducto(producto)));
}

function filtrarProductos() {
  const texto = inputBuscar.value.trim().toLowerCase();

  const resultado = datos.productos.filter((producto) => {
    const coincideCategoria = categoriaActual === "todas" || producto.categoriaId === Number(categoriaActual);
    const coincideTexto =
      texto === "" ||
      producto.nombre.toLowerCase().includes(texto) ||
      String(producto.id).includes(texto) ||
      producto.codigoInterno.toLowerCase().includes(texto);

    return coincideCategoria && coincideTexto;
  });

  mostrarProductos(resultado);
}

function refrescarCatalogo() {
  if (categoriaActual !== "todas" && !buscarCategoria(categoriaActual)) {
    categoriaActual = "todas";
  }
  mostrarCategorias();
  filtrarProductos();
}

function obtenerInputCantidad(id) {
  return divProductos.querySelector(`.input-cantidad[data-id="${id}"]`);
}

function corregirCantidadTarjeta(input) {
  const cantidad = Math.floor(Number(input.value));
  input.value = !cantidad || cantidad < 1 ? 1 : cantidad;
}

function iniciarCatalogo() {
  inputBuscar.addEventListener("input", filtrarProductos);

  divCategorias.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-categoria]");
    if (!boton) return;

    categoriaActual = boton.dataset.categoria;
    mostrarCategorias();
    filtrarProductos();
  });

  divProductos.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button");
    if (!boton) return;

    const id = Number(boton.dataset.id);
    const accion = boton.dataset.accion;
    const input = obtenerInputCantidad(id);

    if (accion === "sumar") {
      input.value = Number(input.value) + 1;
    } else if (accion === "restar") {
      const nuevaCantidad = Number(input.value) - 1;
      input.value = nuevaCantidad < 1 ? 1 : nuevaCantidad;
    } else if (accion === "agregar") {
      corregirCantidadTarjeta(input);
      agregarProducto(buscarProducto(id), Number(input.value));
      input.value = 1;
    } else if (accion === "editar-rapido") {
      abrirEdicionRapida(id);
    }
  });

  divProductos.addEventListener("change", (evento) => {
    if (evento.target.classList.contains("input-cantidad")) {
      corregirCantidadTarjeta(evento.target);
    }
  });
}
