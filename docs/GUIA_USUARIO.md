# Guía de uso — INGEGAR One

> Esta guía explica **qué hace cada parte de la plataforma y cómo se usa**, en lenguaje simple,
> para cualquier persona del equipo o de un cliente — no requiere saber programación.
> Si buscas documentación técnica (arquitectura, modelos de datos, cómo desplegar), esa vive en
> `docs/ARQUITECTURA.md` y el `README.md` de la raíz — este documento es su versión "para humanos".

---

## 1. La idea en una frase

INGEGAR One reemplaza las planillas de Excel, los WhatsApp sueltos y las carpetas de Drive por
**un solo lugar** donde vive todo el ciclo de un trabajo: desde que un cliente reporta un problema,
hasta que INGEGAR lo resuelve, lo cobra y queda archivado.

---

## 2. Las tres puertas de entrada

La plataforma se ve distinta según quién entra. No es "una app con permisos" — son **tres
experiencias separadas**, cada una mostrando solo lo que le corresponde a esa persona.

| Puerta | Quién entra | Para qué |
|---|---|---|
| **INGEGAR One** (la app interna) | Administración de INGEGAR (dueños, supervisores) | Gestionar todo: tickets, cotizaciones, informes, plata, personal, flota |
| **Portal del cliente** (`/portal/nombre-del-cliente`) | El cliente (ej. Just Burger) | Reportar problemas, ver el estado de sus solicitudes, descargar sus documentos |
| **Mi Panel** (`/mi-panel`) | Los técnicos en terreno | Ver sus asignaciones del día, subir evidencia, registrar gastos, avanzar un trabajo |

Un técnico nunca ve la app interna. Un cliente nunca ve la app interna. Cada quien entra a su
puerta y ve exactamente lo que necesita — nada más.

---

## 3. El flujo completo de un trabajo (de punta a punta)

Esto es lo más importante de entender, porque casi todos los módulos son una estación de este
mismo camino:

```
1. Alguien reporta un problema           →  nace un TICKET
   (un cliente desde su portal, o INGEGAR directo)

2. Si hace falta cotizar antes           →  se genera una PROPUESTA (PT)
   de mandar al técnico                     desde el Cotizador, antes o junto con el ticket

3. El técnico va a terreno,              →  sube la ORDEN DE TRABAJO (OT)
   hace el trabajo, y firma una              firmada, desde su celular
   orden de trabajo en papel/tablet

4. La administración revisa todo         →  genera el INFORME TÉCNICO (IT)
   y redacta el informe final                y se lo envía al cliente

5. Con el trabajo cerrado,               →  nace un TRABAJO en Flujo de Caja
   se cobra                                 (orden de compra → factura → pago)
```

**PT / OT / IT** son las tres siglas que vas a ver todo el tiempo dentro de un ticket:

- **PT — Propuesta Técnica**: el presupuesto. Se arma *antes* del trabajo (o junto con el ticket)
  cuando el cliente necesita saber el costo primero. La genera y sube la administración.
- **OT — Orden de Trabajo**: el papel (o foto/PDF) que el técnico firma en terreno, prueba de que
  el trabajo se hizo. **La sube el técnico**, desde su celular, apenas termina.
- **IT — Informe Técnico**: el reporte final con fotos, actividades realizadas y conclusiones — lo
  redacta y envía la administración una vez que el técnico ya hizo su parte.

Dentro de la ficha de cada ticket (tanto en INGEGAR One como en Mi Panel) vas a ver estos tres
casilleros uno al lado del otro, cada uno mostrando si falta, si ya está subido, o si ya se generó,
con un botón para verlo. **Un técnico solo ve y sube su casillero de OT** — los otros dos (PT/IT)
son de administración.

---

## 4. Módulos de INGEGAR One (la app interna)

### Inicio (Dashboard)
La primera pantalla al entrar. Muestra, de un vistazo: qué necesita tu atención hoy (facturas
vencidas, vehículos con documentos por vencer, tickets sin asignar), y un resumen del período que
elijas (facturación, tickets resueltos con su desglose por urgencia y por estado).

### Tickets
El corazón operativo. Cada ticket es un problema reportado — con su cliente, sucursal, nivel de
urgencia, quién lo atiende, y todo su historial de conversación y documentos. Desde acá se asigna
un técnico, se sigue el avance, y se generan/ven los tres documentos PT/OT/IT del punto anterior.

### Propuestas (Cotizador)
Donde se arma una cotización para un cliente: ítems, precios, ajustes, y un diseño en PDF listo
para enviar. Cada propuesta queda con un número correlativo único (el "N° de presupuesto") que
nunca se repite ni se reutiliza.

### Informes
El editor del Informe Técnico (IT): secciones de texto, fotos del trabajo, y el PDF final. Se puede
generar antes o después de cerrar el ticket, y queda guardado en la carpeta del cliente.

### Carpetas de clientes
Todas las propuestas e informes ya generados, organizados por cliente, para reabrir, editar o
volver a descargar sin tener que buscar en el ticket original.

### Flujo de Caja
El control financiero: cada trabajo ejecutado, su orden de compra, su factura, si ya se cobró o
está vencido, y el margen (ingreso menos costos). La pantalla principal muestra primero "qué
requiere una decisión hoy" (facturas vencidas, trabajos sin OC) antes que cualquier número
decorativo.

### Reportes
Análisis más profundo sobre Flujo de Caja: márgenes, antigüedad de cuentas por cobrar, tendencia
mensual, desglose por cliente — para mirar tendencias, no para operar el día a día (eso es Flujo
de Caja).

### Conciliación
Un chequeo cruzado: ¿todo trabajo cobrado tiene su ticket de origen? ¿todo ticket cerrado tiene su
OT y su informe? Señala los casos donde algo falta y da un botón directo para resolverlo — nunca
asume ni completa nada solo, cada corrección es una decisión humana.

### Técnicos, Vehículos, Herramientas, Clientes (Recursos)
El inventario de la empresa: quién trabaja, qué vehículo maneja, qué activos tiene asignados, y la
ficha de cada cliente (con sus sucursales y sus usuarios de portal). Cada técnico tiene su carpeta
de documentos (contrato, carnet, licencias) con alertas cuando algo está por vencer.

### Personas (RR.HH.), Permisos, Liquidaciones
Gestión de personal: fichas de empleado, solicitudes de vacaciones/permisos con su aprobación, y
liquidaciones de sueldo mensuales.

### Documentación y acreditación
Una vista de "prepara todo lo que necesito para acreditar a un técnico o a la empresa en una faena"
— junta documentos que ya existen (no crea copias nuevas) para armar un paquete rápido.

### Gastos
Los gastos que un técnico hace en terreno (bencina, viáticos, materiales): el técnico los registra
con su comprobante, un supervisor los aprueba o rechaza, y quedan listos para pagar.

### Pipeline comercial
*(Actualmente oculto del menú — no se está usando.)* Seguimiento de propuestas enviadas en formato
kanban. Sigue existiendo por si se retoma más adelante, pero hoy no aporta al trabajo diario.

---

## 5. El Portal del Cliente

Cada cliente (Just Burger, Happyland, etc.) tiene su propio portal, con sus colores y su logo,
como si fuera una app aparte — se puede instalar en el celular igual que cualquier app.

Desde ahí, el cliente puede:

- **Ver sus solicitudes** y crear una nueva cuando tiene un problema — eligiendo el nivel de
  urgencia (emergencia / urgente / normal / preventivo) y si quiere cotización antes o autoriza
  resolver de inmediato.
- **Ver el detalle de cada ticket**: estado, conversación con INGEGAR, fotos, y sus documentos
  (orden de trabajo, informes técnicos).
- **Ver sus propuestas e informes técnicos** en una biblioteca, con vista previa y descarga.
- **Ver reportes** de sus propias solicitudes (por sucursal, por urgencia, tendencia mensual).
- Si el cliente tiene varias sucursales (como Just Burger), un **administrador del cliente**
  (ej. Carolina) puede además aprobar o rechazar las solicitudes que crean las sucursales antes de
  que lleguen a INGEGAR, y gestionar qué sucursales y qué usuarios existen.

---

## 6. Mi Panel (el técnico en terreno)

La vista pensada para usarse desde el celular, en movimiento:

- **Tickets**: los que tiene asignados, ordenados por urgencia.
- **Agenda**: su cronograma de asignaciones.
- Dentro de cada ticket: puede avanzar el estado, dejar un comentario, subir fotos/evidencia, y
  **subir su Orden de Trabajo (OT)** — el único de los tres documentos que le corresponde a él.
- **Gastos**: registrar un gasto de terreno con su comprobante.
- **RR.HH.**: pedir un permiso/vacaciones, firmar documentos.

---

## 7. Roles — quién ve qué

| Rol | Qué ve |
|---|---|
| **Super** | Todo, en todos los clientes — configuración incluida (correlativos, credenciales de servicios externos) |
| **Supervisor** | Todo lo operativo (tickets, cotizador, informes, flujo de caja, RR.HH.), sin las configuraciones más sensibles |
| **Técnico** | Solo `Mi Panel` — sus propias asignaciones, gastos y documentos. Nunca entra a la app interna |
| **Cliente** | Solo su propio portal — nunca ve datos de otro cliente, ni entra a la app interna |

---

## 8. Notificaciones

La plataforma puede avisar por notificación push (al celular, si la app está instalada) cuando algo
cambia — por ejemplo, cuando un ticket cambia de estado. Funciona tanto del lado de INGEGAR (avisos
internos) como del lado del cliente (avisos de sus propias solicitudes). En iPhone solo funciona si
el portal quedó instalado como app (no desde Safari abierto normal).

---

## 9. Cosas que la plataforma **no** hace (todavía)

Para que quede claro qué es una limitación conocida y no un error:

- El cliente no puede cambiar su propio correo de acceso desde el portal — si necesita cambiarlo,
  hoy hay que pedírselo a INGEGAR.
- El módulo de Pipeline comercial existe pero está oculto — no se usa activamente.
- Algunas pantallas del portal todavía se sienten menos pulidas que el resto de la app — es un
  trabajo de pulido visual en curso, no una falla de funcionamiento.

Estos y otros pendientes reales quedan siempre documentados en `docs/architecture/GAP_REGISTER.md`
(la lista viva de mejoras conocidas) — si algo de esta guía y ese documento no coinciden, el gap
register manda, porque se actualiza con cada cambio real.

---

*Última actualización: 2026-08-08.*
