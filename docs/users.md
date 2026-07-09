# Usuarios y Credenciales — INGEGAR Platform

> **Versión:** 1.8.x · **Actualizado:** 2026-07-09
>
> Las contraseñas mostradas son las por defecto del seed (`.env` las puede sobreescribir).
> En producción, cambiar todas las contraseñas genéricas antes de entregar accesos.

---

## INGEGAR — Staff interno

| Nick / Email | Contraseña (default) | Rol | Acceso |
|---|---|---|---|
| `ingegar` / `admin@ingegarchile.cl` | `Ingegar@Super1` | `super` | Todo + todos los tenants |
| `sgarrido` / `sgarrido@ingegarchile.cl` | `Ingegar@Ops1` | `supervisor` | Módulos internos |
| `cristian` / `cristian@ingegarchile.cl` | `Ingegar@Com1` | `supervisor` | Módulos internos |
| `jesus` / `jesus@ingegarchile.cl` | `Tecnico@2026` | `tecnico` | `/mi-panel` (panel técnico) |

URL de acceso: `/login`

---

## Just Burger — Portal cliente

URL: `/portal/justburger/tickets`

### Acceso general (legacy, sin sucursal)

| Nick / Email | Contraseña (default) | Rol |
|---|---|---|
| `justburger` / `portal@justburger.cl` | `JustBurger@2026` | `client` |

### Administradora cliente (aprueba tickets)

Carolina revisa y aprueba/rechaza todas las solicitudes de sucursales antes de que lleguen a INGEGAR.

| Nick / Email | Contraseña (default) | Rol |
|---|---|---|
| `jb.carolina` / `carolina@justburger.cl` | `Carolina@JB2026` | `client` (admin) |

### Usuarios por sucursal

Cada sucursal tiene su propia cuenta. Al crear una solicitud, la sucursal queda identificada automáticamente.

| Sucursal | Nick / Email | Contraseña (default) |
|---|---|---|
| Tienda Mall Paseo Quilín | `jb.quilin` / `quilin@justburger.cl` | `JBSucursal@2026` |
| Tienda Machalí | `jb.machali` / `machali@justburger.cl` | `JBSucursal@2026` |
| Tienda Providencia | `jb.providencia` / `providencia@justburger.cl` | `JBSucursal@2026` |
| Tienda Rotonda Atenas | `jb.rotonda` / `rotonda@justburger.cl` | `JBSucursal@2026` |
| Tienda Manuel Montt | `jb.montt` / `montt@justburger.cl` | `JBSucursal@2026` |
| Tienda Toesca | `jb.toesca` / `toesca@justburger.cl` | `JBSucursal@2026` |
| Tienda Viña del Mar | `jb.vina` / `vina@justburger.cl` | `JBSucursal@2026` |
| Tienda Huechuraba | `jb.huechuraba` / `huechuraba@justburger.cl` | `JBSucursal@2026` |
| Tienda Villa Alemana | `jb.vallemana` / `vallemana@justburger.cl` | `JBSucursal@2026` |
| Tienda La Reina | `jb.lareina` / `lareina@justburger.cl` | `JBSucursal@2026` |
| Tienda Isidora | `jb.isidora` / `isidora@justburger.cl` | `JBSucursal@2026` |
| Tienda Tranqueras | `jb.tranqueras` / `tranqueras@justburger.cl` | `JBSucursal@2026` |
| Tienda La Florida | `jb.laflorida` / `laflorida@justburger.cl` | `JBSucursal@2026` |

---

## Decathlon Chile — Portal cliente

URL: `/portal/decathlon/tickets`

| Nick / Email | Contraseña (default) | Rol |
|---|---|---|
| `decathlon` / `portal@decathlon.cl` | `Decathlon@2026` | `client` |

---

## Happyland — Portal cliente

URL: `/portal/happyland/tickets`

| Nick / Email | Contraseña (default) | Rol |
|---|---|---|
| `happyland` / `portal@happyland.cl` | `Happyland@2026` | `client` |

---

## Flujo de tickets Just Burger

```
Sucursal crea ticket
       │
       ▼
Estado: pendiente_aprobación
       │  Carolina recibe notificación push
       ▼
Carolina revisa en su portal
       │
   ┌───┴───┐
   │       │
Aprueba  Rechaza
   │       │
   ▼       ▼
Estado:  Estado:
nuevo   cancelado
   │
   │  INGEGAR recibe notificación push
   ▼
INGEGAR asigna técnico → en_revision → en_ejecucion → resuelto
```

---

## Variables de entorno para sobreescribir contraseñas

```env
SEED_ADMIN_PASSWORD=...
SEED_SEBASTIAN_PASSWORD=...
SEED_CRISTIAN_PASSWORD=...
SEED_TECNICO_PASSWORD=...
SEED_JB_PASSWORD=...
SEED_DEC_PASSWORD=...
SEED_HL_PASSWORD=...
SEED_CAROLINA_PASSWORD=...
SEED_JB_BRANCH_PASSWORD=...
```
