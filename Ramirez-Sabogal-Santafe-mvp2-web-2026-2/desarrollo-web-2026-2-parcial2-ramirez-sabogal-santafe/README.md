# Papel y Luna — Sistema POS (MVP 2)

Sistema POS para la papelería **Papel y Luna**. En este MVP 2 la aplicación deja de usar `localStorage` y trabaja sobre un **servicio externo: Google Sheets publicado con Google Apps Script**, consumido con `fetch` y `async/await`.

Integrantes: Ramírez · Sabogal · Santafé — Desarrollo Web 2026-2.

- Aplicación desplegada: `https://<usuario>.github.io/<repositorio>/` *(reemplazar por la URL real)*
- Repositorio: `https://github.com/<usuario>/<repositorio>` *(reemplazar)*

---

## Funcionalidades

**Heredadas del MVP 1 (ahora sobre el servicio)**
- Flujo de venta: buscar, agregar, modificar cantidades, eliminar, subtotal, IVA y total, método de pago (Efectivo, Nequi o Debe), valor recibido y cambio.
- Factura con opción de imprimir / guardar como PDF.
- Historial de ventas cargado desde el servicio, con detalle y factura.
- CRUD de productos con validaciones.

**Nuevas en el MVP 2**
- **Ventas abiertas:** guardar una venta como abierta, retomarla, seguir editándola y cerrarla después. Se guardan en el servicio con estado `abierta` o `cerrada`.
- **Cliente en la venta:** opcional; obligatorio si el método de pago es *Debe*.
- **Edición de productos desde la venta** (🛠️ en cada tarjeta del catálogo): nombre, categoría, precio de venta y costo. El cambio se ve al instante en el catálogo y en la venta en curso. Las ventas cerradas conservan los valores con los que se cerraron.
- **Compras:** registro con proveedor, fecha, productos, cantidades y costos; listado y detalle.
- **Inventario** (solo productos con seguimiento):
  - Cerrar una venta descuenta el stock. Las ventas abiertas no lo modifican.
  - No se puede cerrar una venta que deje el stock en negativo; se indica qué producto no alcanza.
  - Registrar una compra suma el stock y actualiza el costo del producto con el de la compra.
  - El stock se puede ajustar manualmente en el CRUD de productos.
  - El stock solo cambia cuando el servicio confirma la venta o la compra.
- **Categorías, Proveedores y Clientes:** listado, búsqueda, creación, edición y eliminación.
  - El producto **selecciona** una categoría existente (ya no es texto libre).
  - No se puede eliminar una categoría, proveedor o cliente con registros asociados (se informa cuántos).
- **Ventas con deuda (Debe):** al vender se puede registrar un pago parcial. Las ventas que aún deben aparecen en **⌛ Ventas abiertas → "Ventas con saldo pendiente"**; al entrar se ve el total, lo pagado, lo que debe y el histórico de abonos, y se puede registrar un nuevo abono viendo el nuevo saldo. La venta sigue apareciendo ahí hasta que se paga completa. Los abonos no cambian los productos, el total ni el inventario.
- Estados de carga, mensajes de error y botones deshabilitados mientras se guarda (evita envíos duplicados).
- Diseño responsive (usable en celular).

---

## Estructura del proyecto

```
├── index.html
├── CSS.css
├── img/logo.png
├── backend/
│   └── Code.gs                  ← código del servicio (Google Apps Script)
└── JavaScript/
    ├── servicio/api.js          ← ÚNICO módulo con la URL y las llamadas fetch
    ├── estado/estado.js         ← datos en memoria, constantes y búsquedas
    ├── utilidades/utilidades.js ← formato de moneda/fechas, notificaciones, estado de carga
    ├── vistas/
    │   ├── navegacion.js        ← cambio de vistas y modales
    │   ├── catalogo.js          ← catálogo, búsqueda y filtro por categoría
    │   ├── venta.js             ← carrito, totales, cliente, guardar venta abierta
    │   ├── ventasAbiertas.js    ← listar y retomar ventas abiertas
    │   ├── deudas.js            ← ventas con saldo pendiente (Debe): ver deuda y registrar abonos
    │   ├── menuFactura.js       ← botón flotante que abre/cierra el panel de la venta actual
    │   ├── edicionRapida.js     ← editar producto desde la venta
    │   ├── pago.js              ← método de pago y cierre de la venta
    │   ├── productosAdmin.js    ← CRUD de productos
    │   ├── facturas.js          ← confirmación, factura, historial y detalle
    │   ├── compras.js           ← registro, listado y detalle de compras
    │   └── entidades.js         ← CRUD de categorías, proveedores y clientes
    └── app.js                   ← arranque: carga inicial y registro de eventos
```

---

## Cómo ejecutarlo

### 1. Montar el servicio (Google Sheets + Apps Script)

1. Crear una hoja de cálculo nueva en Google Sheets.
2. Ir a **Extensiones → Apps Script**, borrar el contenido de `Código.gs` y pegar el contenido de `backend/Code.gs`. Guardar.
3. En el editor, elegir la función **`configurarHojas`** y pulsar **Ejecutar** (la primera vez pide autorizar la cuenta). Esto crea las pestañas `categorias`, `proveedores`, `clientes`, `productos`, `ventas` y `compras` con sus encabezados.
4. Elegir la función **`migrarProductosMVP1`** y pulsar **Ejecutar**. Carga los productos del MVP 1 y **migra su categoría de texto a la nueva entidad Categoría** (crea una categoría por cada texto distinto y el producto queda con `categoriaId`). Se puede ejecutar varias veces sin duplicar datos.
5. **Implementar → Nueva implementación → Tipo: Aplicación web**
   - Ejecutar como: *Yo*
   - Quién tiene acceso: *Cualquier persona*
6. Copiar la URL que termina en `/exec`.

> Cada vez que se cambie `Code.gs` hay que crear una **nueva versión** de la implementación (Implementar → Gestionar implementaciones → editar → Nueva versión) para que los cambios se publiquen en la misma URL.

### 2. Conectar el frontend

En `JavaScript/servicio/api.js` reemplazar:

```js
const URL_SERVICIO = "PEGA_AQUI_LA_URL_DE_TU_APPS_SCRIPT";
```

por la URL copiada en el paso anterior.

### 3. Abrir la aplicación

No requiere instalación ni dependencias. Se puede abrir con cualquier servidor estático, por ejemplo la extensión *Live Server* de VS Code, o:

```bash
python -m http.server 5500
# y abrir http://localhost:5500
```

### 4. Despliegue en GitHub Pages

1. Subir los cambios al repositorio del MVP 1.
2. En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
3. Esperar un par de minutos y abrir `https://<usuario>.github.io/<repositorio>/`.

---

## Contrato de la API

Todas las respuestas son JSON con la forma `{ ok: true, datos }` o `{ ok: false, error }`.

| Método | Cuerpo / parámetros | Qué hace |
|---|---|---|
| GET | `?accion=listar&hoja=productos` | Lista los registros de una hoja |
| POST | `{ accion: "crear", hoja, datos }` | Crea categoría, proveedor, cliente o producto |
| POST | `{ accion: "actualizar", hoja, id, datos }` | Actualiza (admite cambios parciales) |
| POST | `{ accion: "eliminar", hoja, id }` | Elimina (bloquea si hay registros asociados) |
| POST | `{ accion: "guardarVentaAbierta", datos }` | Crea o actualiza una venta en estado `abierta` |
| POST | `{ accion: "cerrarVenta", datos }` | Valida stock, cierra la venta y descuenta inventario |
| POST | `{ accion: "registrarCompra", datos }` | Registra la compra, suma stock y actualiza costos |

Los POST se envían con `Content-Type: text/plain` para que el navegador no haga la petición previa de CORS (*preflight*), que Apps Script no responde. El cuerpo sigue siendo JSON.

Las operaciones que tocan inventario se hacen **dentro del servicio** y con `LockService`, para que dos ventas al mismo tiempo no generen el mismo id ni dejen el stock descuadrado. El frontend actualiza su copia del stock con los productos que devuelve el servicio.

## Modelo de datos (pestañas de la hoja)

| Pestaña | Columnas |
|---|---|
| categorias | id, nombre |
| proveedores | id, nombre, telefono, correo |
| clientes | id, nombre, telefono, correo |
| productos | id, codigoInterno, nombre, **categoriaId**, precioVenta, costo, seguimientoInventario, stock |
| ventas | id, estado, fechaCreacion, fechaCierre, **clienteId**, clienteNombre, items (JSON), subtotal, iva, total, metodoPago, valorRecibido, cambio |
| compras | id, fecha, fechaRegistro, **proveedorId**, proveedorNombre, items (JSON), total |

Los `items` de ventas y compras guardan una copia del nombre, precio y costo de cada producto en ese momento; por eso una venta cerrada no cambia si después se edita el producto.

---

## Recursos utilizados

- HTML5, CSS3 y JavaScript (vanilla), con `fetch` y `async/await`.
- Google Sheets y Google Apps Script (`SpreadsheetApp`, `ContentService`, `LockService`).
- GitHub Pages para el despliegue.
- Logo propio: `img/logo.png`.
- Documentación: MDN Web Docs (Fetch API, async/await) y documentación oficial de Google Apps Script.
- Se usó inteligencia artificial como apoyo durante el desarrollo; el equipo revisó y entiende todo el código entregado.
