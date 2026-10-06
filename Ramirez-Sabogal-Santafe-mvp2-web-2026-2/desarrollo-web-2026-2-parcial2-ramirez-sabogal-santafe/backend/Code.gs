
const TOLERANCIA_PESOS = 1; // margen (en pesos) al comparar totales enviados por el cliente
const METODOS_PAGO = ["efectivo", "nequi", "debe"];

// Estructura de cada hoja: columnas en orden y tipo de cada una.
// Tipos: "numero", "texto", "booleano", "json"
const ESQUEMA = {
  categorias: {
    columnas: ["id", "nombre"],
    tipos: { id: "numero", nombre: "texto" }
  },
  proveedores: {
    columnas: ["id", "nombre", "telefono", "correo"],
    tipos: { id: "numero", nombre: "texto", telefono: "texto", correo: "texto" }
  },
  clientes: {
    columnas: ["id", "nombre", "telefono", "correo"],
    tipos: { id: "numero", nombre: "texto", telefono: "texto", correo: "texto" }
  },
  productos: {
    columnas: ["id", "codigoInterno", "nombre", "categoriaId", "precioVenta", "costo", "seguimientoInventario", "stock"],
    tipos: {
      id: "numero", codigoInterno: "texto", nombre: "texto", categoriaId: "numero",
      precioVenta: "numero", costo: "numero", seguimientoInventario: "booleano", stock: "numero"
    }
  },
  ventas: {
    columnas: ["id", "estado", "fechaCreacion", "fechaCierre", "clienteId", "clienteNombre", "items",
      "subtotal", "iva", "total", "metodoPago", "valorRecibido", "cambio", "montoPagado", "montoDeuda",
      "tipoDeuda", "estadoDeuda", "abonos"],
    tipos: {
      id: "numero", estado: "texto", fechaCreacion: "texto", fechaCierre: "texto", clienteId: "numero",
      clienteNombre: "texto", items: "json", subtotal: "numero", iva: "numero", total: "numero",
      metodoPago: "texto", valorRecibido: "numero", cambio: "numero", montoPagado: "numero", montoDeuda: "numero",
      tipoDeuda: "texto", estadoDeuda: "texto", abonos: "json"
    }
  },
  compras: {
    columnas: ["id", "fecha", "fechaRegistro", "proveedorId", "proveedorNombre", "items", "total"],
    tipos: {
      id: "numero", fecha: "texto", fechaRegistro: "texto", proveedorId: "numero",
      proveedorNombre: "texto", items: "json", total: "numero"
    }
  }
};

// Hojas que se pueden crear / editar / eliminar con las acciones genéricas.
// Ventas y compras solo se modifican con sus acciones propias (así una venta cerrada no se puede corregir).
const HOJAS_CRUD = ["categorias", "proveedores", "clientes", "productos"];


/* ============================================================
 * Puntos de entrada
 * ============================================================ */

function doGet(e) {
  return ejecutar(() => {
    const parametros = (e && e.parameter) || {};
    const accion = parametros.accion || "listar";
    if (accion !== "listar") throw new Error(`Acción GET no soportada: ${accion}`);
    return leerRegistros(validarNombreHoja(parametros.hoja));
  });
}

function doPost(e) {
  return ejecutar(() => {
    let cuerpo;
    try {
      cuerpo = JSON.parse(e.postData.contents);
    } catch (error) {
      throw new Error("El cuerpo de la petición no es un JSON válido.");
    }

    const candado = LockService.getScriptLock();
    candado.waitLock(20000); // evita que dos peticiones simultáneas generen el mismo id o descuadren el stock
    try {
      switch (cuerpo.accion) {
        case "crear": return crearRegistro(validarHojaCrud(cuerpo.hoja), cuerpo.datos || {});
        case "actualizar": return actualizarRegistro(validarHojaCrud(cuerpo.hoja), Number(cuerpo.id), cuerpo.datos || {});
        case "eliminar": return eliminarRegistro(validarHojaCrud(cuerpo.hoja), Number(cuerpo.id));
        case "guardarVentaAbierta": return guardarVentaAbierta(cuerpo.datos || {});
        case "cerrarVenta": return cerrarVenta(cuerpo.datos || {});
        case "registrarAbono": return registrarAbono(cuerpo.datos || {});
        case "registrarCompra": return registrarCompra(cuerpo.datos || {});
        default: throw new Error(`Acción POST no soportada: ${cuerpo.accion}`);
      }
    } finally {
      candado.releaseLock();
    }
  });
}

function ejecutar(funcion) {
  let respuesta;
  try {
    respuesta = { ok: true, datos: funcion() };
  } catch (error) {
    respuesta = { ok: false, error: error.message || String(error) };
  }
  return ContentService.createTextOutput(JSON.stringify(respuesta)).setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================
 * Lectura / escritura de hojas
 * ============================================================ */

function validarNombreHoja(nombre) {
  if (!ESQUEMA[nombre]) throw new Error(`La hoja "${nombre}" no existe en el servicio.`);
  return nombre;
}

function validarHojaCrud(nombre) {
  validarNombreHoja(nombre);
  if (!HOJAS_CRUD.includes(nombre)) throw new Error(`La hoja "${nombre}" no admite esta operación.`);
  return nombre;
}

function obtenerHoja(nombre) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!hoja) throw new Error(`No existe la pestaña "${nombre}". Ejecuta la función configurarHojas() en Apps Script.`);
  return hoja;
}

function convertirDesdeCelda(valor, tipo) {
  if (valor === "" || valor === null || valor === undefined) {
    if (tipo === "json") return [];
    return null;
  }
  if (valor instanceof Date) return valor.toISOString();
  if (tipo === "numero") return Number(valor);
  if (tipo === "booleano") return valor === true || String(valor).toLowerCase() === "true";
  if (tipo === "json") {
    try { return JSON.parse(valor); } catch (error) { return []; }
  }
  return String(valor);
}

function convertirHaciaCelda(valor, tipo) {
  if (valor === null || valor === undefined) return "";
  if (tipo === "json") return JSON.stringify(valor);
  if (tipo === "booleano") return valor === true;
  if (tipo === "texto") return String(valor);
  return valor;
}

// Devuelve [{ fila, registro }] donde fila es el número de fila en la hoja (1 = encabezados)
function leerTabla(nombreHoja) {
  const hoja = obtenerHoja(nombreHoja);
  const { columnas, tipos } = ESQUEMA[nombreHoja];
  const valores = hoja.getDataRange().getValues();
  const encabezados = valores[0].map(String);

  const resultado = [];
  for (let i = 1; i < valores.length; i++) {
    const filaValores = valores[i];
    if (filaValores.every((celda) => celda === "" || celda === null)) continue;

    const registro = {};
    columnas.forEach((columna) => {
      const indice = encabezados.indexOf(columna);
      registro[columna] = convertirDesdeCelda(indice === -1 ? "" : filaValores[indice], tipos[columna]);
    });
    resultado.push({ fila: i + 1, registro });
  }
  return resultado;
}

function leerRegistros(nombreHoja) {
  return leerTabla(nombreHoja).map((entrada) => entrada.registro);
}

function escribirFila(nombreHoja, numeroFila, registro) {
  const hoja = obtenerHoja(nombreHoja);
  const { columnas, tipos } = ESQUEMA[nombreHoja];

  // Las columnas de texto se marcan como texto plano para que Sheets no convierta
  // fechas, teléfonos o códigos como "2E34" en números.
  columnas.forEach((columna, indice) => {
    if (tipos[columna] === "texto" || tipos[columna] === "json") {
      hoja.getRange(numeroFila, indice + 1).setNumberFormat("@");
    }
  });

  const valores = columnas.map((columna) => convertirHaciaCelda(registro[columna], tipos[columna]));
  hoja.getRange(numeroFila, 1, 1, columnas.length).setValues([valores]);
}

function agregarFila(nombreHoja, registro) {
  const hoja = obtenerHoja(nombreHoja);
  escribirFila(nombreHoja, hoja.getLastRow() + 1, registro);
}

function siguienteId(tabla) {
  return tabla.reduce((maximo, entrada) => Math.max(maximo, Number(entrada.registro.id) || 0), 0) + 1;
}

function buscarPorId(tabla, id) {
  return tabla.find((entrada) => entrada.registro.id === id) || null;
}


/* ============================================================
 * Validaciones
 * ============================================================ */

function textoLimpio(valor) {
  return valor === null || valor === undefined ? "" : String(valor).trim();
}

function esNumeroValido(valor) {
  return typeof valor === "number" && !Number.isNaN(valor) && Number.isFinite(valor);
}

function esEnteroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0;
}

function validarContacto(datos, etiqueta) {
  if (!datos.nombre) throw new Error(`El nombre del ${etiqueta} es obligatorio.`);
  if (!/^[0-9+\-\s()]{7,20}$/.test(datos.telefono || "")) {
    throw new Error(`El teléfono del ${etiqueta} debe tener entre 7 y 20 dígitos.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo || "")) {
    throw new Error(`El correo del ${etiqueta} no es válido.`);
  }
}

// Limpia y valida un registro antes de guardarlo. idActual sirve para ignorarse a sí mismo en las validaciones de duplicados.
function prepararRegistro(nombreHoja, datos, idActual) {
  if (nombreHoja === "categorias") {
    const registro = { nombre: textoLimpio(datos.nombre) };
    if (!registro.nombre) throw new Error("El nombre de la categoría es obligatorio.");
    const repetida = leerRegistros("categorias").some(
      (categoria) => categoria.id !== idActual && categoria.nombre.toLowerCase() === registro.nombre.toLowerCase()
    );
    if (repetida) throw new Error(`Ya existe una categoría llamada "${registro.nombre}".`);
    return registro;
  }

  if (nombreHoja === "proveedores" || nombreHoja === "clientes") {
    const registro = {
      nombre: textoLimpio(datos.nombre),
      telefono: textoLimpio(datos.telefono),
      correo: textoLimpio(datos.correo)
    };
    validarContacto(registro, nombreHoja === "clientes" ? "cliente" : "proveedor");
    return registro;
  }

  if (nombreHoja === "productos") {
    const seguimientoInventario = datos.seguimientoInventario === true;
    const registro = {
      codigoInterno: textoLimpio(datos.codigoInterno),
      nombre: textoLimpio(datos.nombre),
      categoriaId: Number(datos.categoriaId),
      precioVenta: Number(datos.precioVenta),
      costo: Number(datos.costo),
      seguimientoInventario: seguimientoInventario,
      stock: seguimientoInventario ? Number(datos.stock) : null
    };

    if (!registro.nombre) throw new Error("El nombre del producto es obligatorio.");
    if (!registro.codigoInterno) throw new Error("El código interno del producto es obligatorio.");
    if (!leerRegistros("categorias").some((categoria) => categoria.id === registro.categoriaId)) {
      throw new Error("La categoría seleccionada no existe.");
    }
    if (!esNumeroValido(registro.precioVenta) || registro.precioVenta < 0) {
      throw new Error("El precio de venta debe ser un número mayor o igual a 0.");
    }
    if (!esNumeroValido(registro.costo) || registro.costo < 0) {
      throw new Error("El costo debe ser un número mayor o igual a 0.");
    }
    if (seguimientoInventario && (!Number.isInteger(registro.stock) || registro.stock < 0)) {
      throw new Error("El stock debe ser un número entero mayor o igual a 0.");
    }
    const codigoRepetido = leerRegistros("productos").some(
      (producto) => producto.id !== idActual && producto.codigoInterno === registro.codigoInterno
    );
    if (codigoRepetido) throw new Error(`El código interno ${registro.codigoInterno} ya está en uso.`);
    return registro;
  }

  throw new Error(`La hoja "${nombreHoja}" no admite esta operación.`);
}


/* ============================================================
 * CRUD genérico (categorías, proveedores, clientes, productos)
 * ============================================================ */

function crearRegistro(nombreHoja, datos) {
  const tabla = leerTabla(nombreHoja);
  const registro = Object.assign({ id: siguienteId(tabla) }, prepararRegistro(nombreHoja, datos, null));
  agregarFila(nombreHoja, registro);
  return registro;
}

function actualizarRegistro(nombreHoja, id, datos) {
  const tabla = leerTabla(nombreHoja);
  const entrada = buscarPorId(tabla, id);
  if (!entrada) throw new Error("El registro que intentas actualizar ya no existe.");

  // Se mezclan los datos actuales con los recibidos: así se pueden enviar actualizaciones parciales
  // (por ejemplo, editar un producto desde la venta sin tocar su stock).
  const combinado = Object.assign({}, entrada.registro, datos);
  const registro = Object.assign({ id: id }, prepararRegistro(nombreHoja, combinado, id));
  escribirFila(nombreHoja, entrada.fila, registro);
  return registro;
}

function contarAsociados(nombreHoja, id) {
  if (nombreHoja === "categorias") {
    return { cantidad: leerRegistros("productos").filter((p) => p.categoriaId === id).length, que: "producto(s)" };
  }
  if (nombreHoja === "proveedores") {
    return { cantidad: leerRegistros("compras").filter((c) => c.proveedorId === id).length, que: "compra(s)" };
  }
  if (nombreHoja === "clientes") {
    return { cantidad: leerRegistros("ventas").filter((v) => v.clienteId === id).length, que: "venta(s)" };
  }
  return { cantidad: 0, que: "" };
}

function eliminarRegistro(nombreHoja, id) {
  const tabla = leerTabla(nombreHoja);
  const entrada = buscarPorId(tabla, id);
  if (!entrada) throw new Error("El registro que intentas eliminar ya no existe.");

  const asociados = contarAsociados(nombreHoja, id);
  if (asociados.cantidad > 0) {
    throw new Error(
      `No se puede eliminar "${entrada.registro.nombre}" porque tiene ${asociados.cantidad} ${asociados.que} asociado(s).`
    );
  }

  obtenerHoja(nombreHoja).deleteRow(entrada.fila);
  return { id: id };
}


/* ============================================================
 * Ventas
 * ============================================================ */

function limpiarItemsVenta(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("La venta debe tener al menos un producto.");

  return items.map((item) => {
    const limpio = {
      productoId: Number(item.productoId),
      nombre: textoLimpio(item.nombre),
      precio: Number(item.precio),
      costo: Number(item.costo),
      cantidad: Number(item.cantidad)
    };
    if (!esEnteroPositivo(limpio.cantidad)) throw new Error(`La cantidad de "${limpio.nombre}" no es válida.`);
    if (!esNumeroValido(limpio.precio) || limpio.precio < 0) throw new Error(`El precio de "${limpio.nombre}" no es válido.`);
    if (!esNumeroValido(limpio.costo)) limpio.costo = 0;
    return limpio;
  });
}

function buscarCliente(clienteId, obligatorio) {
  if (clienteId === null || clienteId === undefined || clienteId === "") {
    if (obligatorio) throw new Error('El método de pago "Debe" requiere asociar un cliente.');
    return null;
  }
  const cliente = leerRegistros("clientes").find((c) => c.id === Number(clienteId));
  if (!cliente) throw new Error("El cliente seleccionado no existe.");
  return cliente;
}

function guardarVentaAbierta(datos) {
  const items = limpiarItemsVenta(datos.items);
  const cliente = buscarCliente(datos.clienteId, false);
  const tabla = leerTabla("ventas");
  const ahora = new Date().toISOString();

  let entrada = null;
  if (datos.id) {
    entrada = buscarPorId(tabla, Number(datos.id));
    if (!entrada) throw new Error("La venta abierta ya no existe.");
    if (entrada.registro.estado !== "abierta") throw new Error("Esta venta ya fue cerrada y no se puede modificar.");
  }

  const venta = {
    id: entrada ? entrada.registro.id : siguienteId(tabla),
    estado: "abierta",
    fechaCreacion: entrada ? entrada.registro.fechaCreacion : ahora,
    fechaCierre: null,
    clienteId: cliente ? cliente.id : null,
    clienteNombre: cliente ? cliente.nombre : null,
    items: items,
    subtotal: Number(datos.subtotal) || 0,
    iva: Number(datos.iva) || 0,
    total: Number(datos.total) || 0,
    metodoPago: null,
    valorRecibido: null,
    cambio: null,
    montoPagado: null,
    montoDeuda: null,
    tipoDeuda: null,
    estadoDeuda: null,
    abonos: []
  };

  if (entrada) escribirFila("ventas", entrada.fila, venta);
  else agregarFila("ventas", venta);
  return venta;
}

function cerrarVenta(datos) {
  const items = limpiarItemsVenta(datos.items);
  const metodoPago = textoLimpio(datos.metodoPago);
  if (!METODOS_PAGO.includes(metodoPago)) throw new Error("El método de pago no es válido.");

  const cliente = buscarCliente(datos.clienteId, metodoPago === "debe");
  const total = Number(datos.total);
  if (!esNumeroValido(total) || total < 0) throw new Error("El total de la venta no es válido.");

  let valorRecibido = null;
  let cambio = null;
  let montoPagado = total;
  let tipoDeuda = null;
  if (metodoPago === "debe") {
    tipoDeuda = datos.tipoDeuda === "parcial" ? "parcial" : "total";
    montoPagado = tipoDeuda === "parcial" ? Number(datos.montoPagado) : 0;
    if (tipoDeuda === "parcial" && (!esNumeroValido(montoPagado) || montoPagado <= 0 || montoPagado > total)) {
      throw new Error("El pago parcial debe ser mayor a 0 y no puede superar el total de la venta.");
    }
  }
  const montoDeuda = metodoPago === "debe" ? total - montoPagado : 0;
  if (metodoPago === "efectivo") {
    valorRecibido = Number(datos.valorRecibido);
    if (!esNumeroValido(valorRecibido) || valorRecibido + TOLERANCIA_PESOS < total) {
      throw new Error("El valor recibido es menor al total.");
    }
    cambio = Math.max(valorRecibido - total, 0);
  }

  // Validación de inventario: se agrupan las cantidades por producto.
  const tablaProductos = leerTabla("productos");
  const cantidades = {};
  items.forEach((item) => {
    cantidades[item.productoId] = (cantidades[item.productoId] || 0) + item.cantidad;
  });

  const sinStock = [];
  Object.keys(cantidades).forEach((productoId) => {
    const entrada = buscarPorId(tablaProductos, Number(productoId));
    const item = items.find((i) => i.productoId === Number(productoId));
    if (!entrada) throw new Error(`El producto "${item.nombre}" ya no existe en el catálogo.`);
    const producto = entrada.registro;
    if (producto.seguimientoInventario && (producto.stock || 0) < cantidades[productoId]) {
      sinStock.push(`${producto.nombre} (disponible: ${producto.stock || 0}, en la venta: ${cantidades[productoId]})`);
    }
  });
  if (sinStock.length > 0) throw new Error(`Stock insuficiente: ${sinStock.join("; ")}.`);

  // Venta: si venía de una venta abierta se actualiza esa fila, si no se crea una nueva.
  const tablaVentas = leerTabla("ventas");
  let entradaVenta = null;
  if (datos.id) {
    entradaVenta = buscarPorId(tablaVentas, Number(datos.id));
    if (!entradaVenta) throw new Error("La venta abierta ya no existe.");
    if (entradaVenta.registro.estado !== "abierta") throw new Error("Esta venta ya fue cerrada.");
  }

  const ahora = new Date().toISOString();
  const venta = {
    id: entradaVenta ? entradaVenta.registro.id : siguienteId(tablaVentas),
    estado: "cerrada",
    fechaCreacion: entradaVenta ? entradaVenta.registro.fechaCreacion : ahora,
    fechaCierre: ahora,
    clienteId: cliente ? cliente.id : null,
    clienteNombre: cliente ? cliente.nombre : null,
    items: items,
    subtotal: Number(datos.subtotal) || 0,
    iva: Number(datos.iva) || 0,
    total: total,
    metodoPago: metodoPago,
    valorRecibido: valorRecibido,
    cambio: cambio,
    montoPagado: montoPagado,
    montoDeuda: montoDeuda,
    tipoDeuda: tipoDeuda,
    estadoDeuda: montoDeuda > 0 ? "pendiente" : "pagada",
    abonos: metodoPago === "debe" && montoPagado > 0 ? [{ fecha: ahora, monto: montoPagado }] : []
  };

  if (entradaVenta) escribirFila("ventas", entradaVenta.fila, venta);
  else agregarFila("ventas", venta);

  // Descuento de stock (solo productos con seguimiento de inventario)
  const productosActualizados = [];
  Object.keys(cantidades).forEach((productoId) => {
    const entrada = buscarPorId(tablaProductos, Number(productoId));
    const producto = entrada.registro;
    if (!producto.seguimientoInventario) return;
    producto.stock = (producto.stock || 0) - cantidades[productoId];
    escribirFila("productos", entrada.fila, producto);
    productosActualizados.push(producto);
  });

  return { venta: venta, productos: productosActualizados };
}

function registrarAbono(datos) {
  const id = Number(datos.ventaId);
  const monto = Number(datos.monto);
  if (!esNumeroValido(id) || id <= 0) throw new Error("La venta indicada no es válida.");
  if (!esNumeroValido(monto) || monto <= 0) throw new Error("El abono debe ser un monto mayor a 0.");

  const tablaVentas = leerTabla("ventas");
  const entrada = buscarPorId(tablaVentas, id);
  if (!entrada || entrada.registro.estado !== "cerrada") throw new Error("No se encontró la venta cerrada.");
  const venta = JSON.parse(JSON.stringify(entrada.registro));
  if (venta.metodoPago !== "debe") throw new Error("Esta venta no tiene saldo por cobrar.");

  const montoPagadoAnterior = venta.montoPagado !== null && venta.montoPagado !== undefined && Number.isFinite(Number(venta.montoPagado))
    ? Number(venta.montoPagado)
    : 0;
  const montoDeuda = venta.montoDeuda !== null && venta.montoDeuda !== undefined && Number.isFinite(Number(venta.montoDeuda))
    ? Math.max(Number(venta.montoDeuda), 0)
    : Math.max(Number(venta.total) - montoPagadoAnterior, 0);
  if (montoDeuda <= 0) throw new Error("Esta venta ya fue pagada completamente.");
  if (monto > montoDeuda) throw new Error(`El abono no puede superar el saldo pendiente (${montoDeuda}).`);

  const ahora = new Date().toISOString();
  venta.montoPagado = montoPagadoAnterior + monto;
  venta.montoDeuda = Math.max(montoDeuda - monto, 0);
  venta.estadoDeuda = venta.montoDeuda === 0 ? "pagada" : "pendiente";
  venta.abonos = Array.isArray(venta.abonos) ? venta.abonos : [];
  venta.abonos.push({
    fecha: ahora,
    monto: monto,
    saldoAnterior: montoDeuda,
    saldoRestante: venta.montoDeuda
  });
  escribirFila("ventas", entrada.fila, venta);
  return { venta: venta };
}


/* ============================================================
 * Compras
 * ============================================================ */

function registrarCompra(datos) {
  const proveedor = leerRegistros("proveedores").find((p) => p.id === Number(datos.proveedorId));
  if (!proveedor) throw new Error("Toda compra debe asociarse a un proveedor existente.");

  const fecha = textoLimpio(datos.fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha de la compra no es válida.");

  if (!Array.isArray(datos.items) || datos.items.length === 0) {
    throw new Error("La compra debe tener al menos un producto.");
  }

  const tablaProductos = leerTabla("productos");
  const vistos = {};
  const items = datos.items.map((item) => {
    const productoId = Number(item.productoId);
    const entrada = buscarPorId(tablaProductos, productoId);
    if (!entrada) throw new Error("Uno de los productos de la compra no existe.");
    if (vistos[productoId]) throw new Error(`El producto "${entrada.registro.nombre}" está repetido en la compra.`);
    vistos[productoId] = true;

    const cantidad = Number(item.cantidad);
    const costoUnitario = Number(item.costoUnitario);
    if (!esEnteroPositivo(cantidad)) throw new Error(`La cantidad de "${entrada.registro.nombre}" debe ser un entero mayor a 0.`);
    if (!esNumeroValido(costoUnitario) || costoUnitario < 0) {
      throw new Error(`El costo de "${entrada.registro.nombre}" debe ser un número mayor o igual a 0.`);
    }
    return { productoId: productoId, nombre: entrada.registro.nombre, cantidad: cantidad, costoUnitario: costoUnitario };
  });

  const tablaCompras = leerTabla("compras");
  const compra = {
    id: siguienteId(tablaCompras),
    fecha: fecha,
    fechaRegistro: new Date().toISOString(),
    proveedorId: proveedor.id,
    proveedorNombre: proveedor.nombre,
    items: items,
    total: items.reduce((suma, item) => suma + item.cantidad * item.costoUnitario, 0)
  };
  agregarFila("compras", compra);

  // Inventario: se suma el stock (si tiene seguimiento) y se actualiza el costo con el de esta compra.
  const productosActualizados = items.map((item) => {
    const entrada = buscarPorId(tablaProductos, item.productoId);
    const producto = entrada.registro;
    producto.costo = item.costoUnitario;
    if (producto.seguimientoInventario) producto.stock = (producto.stock || 0) + item.cantidad;
    escribirFila("productos", entrada.fila, producto);
    return producto;
  });

  return { compra: compra, productos: productosActualizados };
}


/* ============================================================
 * Configuración inicial y migración (se ejecutan a mano desde el editor de Apps Script)
 * ============================================================ */

// 1) Crea las pestañas y actualiza encabezados (incluidas las nuevas columnas de deuda, sin borrar filas).
function configurarHojas() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ESQUEMA).forEach((nombre) => {
    let hoja = libro.getSheetByName(nombre);
    if (!hoja) hoja = libro.insertSheet(nombre);
    const columnas = ESQUEMA[nombre].columnas;
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
    hoja.setFrozenRows(1);
  });
}

// 2) Migración del MVP 1: los productos tenían la categoría como texto libre.
//    Se crea una categoría (entidad) por cada texto distinto y el producto pasa a referenciarla con categoriaId.
//    Es idempotente: si se ejecuta dos veces no duplica categorías ni productos (compara por código interno).
const PRODUCTOS_MVP1 = [
  { codigoInterno: "X6UE", nombre: "Cuaderno Argollado 100 Hojas", categoria: "Cuadernos", precioVenta: 8500, costo: 5500, seguimientoInventario: true, stock: 40 },
  { codigoInterno: "WK3D", nombre: "Cuaderno 7 Materias", categoria: "Cuadernos", precioVenta: 30000, costo: 19000, seguimientoInventario: true, stock: 25 },
  { codigoInterno: "4ERF", nombre: "Libreta de Notas Bolsillo", categoria: "Cuadernos", precioVenta: 3900, costo: 2200, seguimientoInventario: true, stock: 60 },
  { codigoInterno: "KHVM", nombre: "Esfero Punta Fina Azul", categoria: "Escritura", precioVenta: 1500, costo: 800, seguimientoInventario: true, stock: 150 },
  { codigoInterno: "H4LX", nombre: "Lápiz de Mina HB x 12", categoria: "Escritura", precioVenta: 9800, costo: 6200, seguimientoInventario: true, stock: 45 },
  { codigoInterno: "CJU4", nombre: "Set de Marcadores Permanentes", categoria: "Escritura", precioVenta: 15400, costo: 9800, seguimientoInventario: true, stock: 30 },
  { codigoInterno: "D3DQ", nombre: "Resaltadores Pastel x5", categoria: "Arte", precioVenta: 12900, costo: 8200, seguimientoInventario: true, stock: 35 },
  { codigoInterno: "EGZD", nombre: "Set de Colores x24", categoria: "Arte", precioVenta: 22000, costo: 14500, seguimientoInventario: true, stock: 20 },
  { codigoInterno: "5W77", nombre: "Tijeras Punta Roma", categoria: "Oficina", precioVenta: 4700, costo: 2600, seguimientoInventario: true, stock: 50 },
  { codigoInterno: "5DHQ", nombre: "Pegante en Barra 40g", categoria: "Oficina", precioVenta: 3200, costo: 1700, seguimientoInventario: true, stock: 70 },
  { codigoInterno: "ZVRM", nombre: "Corrector Líquido", categoria: "Oficina", precioVenta: 2800, costo: 1500, seguimientoInventario: true, stock: 65 },
  { codigoInterno: "RFV9", nombre: "Carpeta Plástica con Gancho", categoria: "Oficina", precioVenta: 3500, costo: 1900, seguimientoInventario: true, stock: 55 },
  { codigoInterno: "GNZG", nombre: "Calculadora Científica", categoria: "Accesorios", precioVenta: 45900, costo: 29000, seguimientoInventario: true, stock: 15 },
  { codigoInterno: "EDP9", nombre: "Agenda Ejecutiva 2026", categoria: "Accesorios", precioVenta: 32500, costo: 20000, seguimientoInventario: true, stock: 18 },
  { codigoInterno: "PCF5", nombre: "Mochila Escolar Reforzada", categoria: "Accesorios", precioVenta: 68000, costo: 42000, seguimientoInventario: true, stock: 12 }
];

function migrarProductosMVP1() {
  configurarHojas();

  PRODUCTOS_MVP1.forEach((productoMvp1) => {
    // categoría en texto -> entidad categoría
    let categoria = leerRegistros("categorias").find(
      (c) => c.nombre.toLowerCase() === productoMvp1.categoria.trim().toLowerCase()
    );
    if (!categoria) categoria = crearRegistro("categorias", { nombre: productoMvp1.categoria.trim() });

    const yaExiste = leerRegistros("productos").some((p) => p.codigoInterno === productoMvp1.codigoInterno);
    if (yaExiste) return;

    crearRegistro("productos", {
      codigoInterno: productoMvp1.codigoInterno,
      nombre: productoMvp1.nombre,
      categoriaId: categoria.id,
      precioVenta: productoMvp1.precioVenta,
      costo: productoMvp1.costo,
      seguimientoInventario: productoMvp1.seguimientoInventario,
      stock: productoMvp1.stock
    });
  });
}
