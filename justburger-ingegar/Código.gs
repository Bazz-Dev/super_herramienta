// ════════════════════════════════════════════════════════════════════════════
//  JUST BURGER — Sistema de Mantención  v2.1
//  Ingegar Chile SpA
//
//  Cambios v2.1:
//   • Técnicos ven TODOS sus tickets asignados (todos los estados)
//   • Password_Plain: admin puede ver/resetear contraseñas desde UI
//   • getUserPassword: expone contraseña plain para UI admin
//   • generateWorkReport: genera reporte de cierre estructurado
//   • Normalización de nombres para matching de técnico más robusto
// ════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  SPREADSHEET_ID : '13wZ8gGljtVLPmCPoqEt-BgA5aeeHnOy-7CVgYOfbmho',
  FOLDER_APP_ID  : '1dxcS9SD4G05_NstKtalDTosGNwcnWGoJ',
  TIMEZONE       : 'America/Santiago',
  ADMIN_EMAILS   : 'sherrera@ingegarchile.cl,sgarrido@ingegarchile.cl,cmunoz@ingegarchile.cl',
  CLIENT_EMAIL   : 'carolina.manan@justburger.cl',
  MAX_FILE_MB    : 50,
  MAX_VIDEO_MB   : 50,
  MAX_VIDEO_SEC  : 30,
  VIDEO_TYPES    : ['video/mp4','video/quicktime','video/webm','video/x-m4v']
};

const SH = { T:'Tickets', S:'Sucursales', TEC:'Tecnicos', H:'Historial', CFG:'Config', U:'Usuarios' };

const COLS_T   = ['Ticket_ID','Fecha_Creacion','Creado_Por','Sucursal','Urgencia','Categoria',
                  'Titulo','Descripcion','Estado','Fecha_Estimada','Fecha_Cierre','Tecnico',
                  'OT_Numero','Carpeta_Drive','Resumen_Trabajo','Comentario_Cliente',
                  'Notas_Internas','Ultima_Actualizacion','Mostrar','Vehiculo_Patente','Vehiculo_Descripcion',
                  'Parent_Ticket_ID','Root_Ticket_ID','Source_Type','Source_Note','Merged_Into',
                  'Colaboradores']; // v2.2: F08 soporte técnicos colaboradores
const COLS_H   = ['Ticket_ID','Fecha','Estado_Anterior','Estado_Nuevo','Usuario','Nota','Avance_Parent_ID'];
const COLS_S   = ['Nombre','Ciudad','Activa'];
const COLS_TEC = ['Nombre','Especialidad','Activo'];
const COLS_CFG = ['Tipo','Valor','Orden'];
// v2.1: Password_Plain añadido al final para visibilidad admin (uso interno)
const COLS_U   = ['UserID','Username','Password_Hash','Role','Nombre','Email','Especialidad','Activo','Ultimo_Login','Created_At','Password_Plain'];

const ROLES = ['admin','cliente','tecnico'];

// ────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ────────────────────────────────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Just Burger · Mantención')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width,initial-scale=1.0');
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS BÁSICOS
// ────────────────────────────────────────────────────────────────────────────
function _ss()  { return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }
function _now() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'); }

function _hashPassword(plainPass) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(plainPass||''));
  return bytes.map(b => ((b<0?b+256:b)).toString(16).padStart(2,'0')).join('');
}

// v2.1: Normaliza texto para comparación robusta (elimina tildes, minúsculas, trim)
function _norm(s) {
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
// v2.2: Obtiene el rol de un usuario por su username (para validación de permisos)
function _getUserRole(username) {
  try {
    const found = _findUserRow(username);
    if (!found) return 'cliente'; // por defecto el rol menos privilegiado
    return String(found.row[3]||'cliente').toLowerCase().trim();
  } catch(e) { return 'cliente'; }
}

function _hist(tid, estAnt, estNue, usr, nota, parentId) {
  const sh = _ss().getSheetByName(SH.H);
  if (!sh) return;
  const headers = sh.getRange(1,1,1,Math.max(1, sh.getLastColumn())).getValues()[0].map(h => String(h).trim());
  const hasParentCol = headers.indexOf('Avance_Parent_ID') >= 0;
  const row = [tid, _now(), estAnt, estNue, usr||'sistema', nota||''];
  if (hasParentCol) row.push(parentId||'');
  sh.appendRow(row);
}

function _getLastAvanceId(tid) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    if (!sh || sh.getLastRow() <= 1) return '';
    const data = sh.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const apIdx = headers.indexOf('Avance_Parent_ID');
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (String(data[i][2]) !== '[AVANCE]') continue;
      if (apIdx >= 0 && data[i][apIdx]) return String(data[i][apIdx]);
      try {
        const meta = JSON.parse(String(data[i][5]||''));
        if (meta && meta.avanceId) return String(meta.avanceId);
      } catch(e) {}
      return '';
    }
    return '';
  } catch(e) { return ''; }
}

function _mkSheet(ss, name, cols) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(cols);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,cols.length).setFontWeight('bold').setBackground('#E52432').setFontColor('#fff').setFontSize(9);
  }
  return sh;
}

// ────────────────────────────────────────────────────────────────────────────
// AUTH — sesiones y login
// ────────────────────────────────────────────────────────────────────────────
function _issueSession(user, role, name) {
  try {
    const token = Utilities.getUuid().replace(/-/g, '');
    const pr = PropertiesService.getScriptProperties();
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    pr.setProperty('sess_' + token, JSON.stringify({user, role, name, expiresAt}));
    return token;
  } catch(e) { return ''; }
}

function checkSession(token) {
  try {
    if (!token) return {success:false};
    const pr = PropertiesService.getScriptProperties();
    const raw = pr.getProperty('sess_' + token);
    if (!raw) return {success:false};
    const s = JSON.parse(raw);
    if (!s || !s.expiresAt || Date.now() > s.expiresAt) {
      pr.deleteProperty('sess_' + token);
      return {success:false};
    }
    return {success:true, user:s.user, role:s.role, name:s.name, sessionToken:token};
  } catch(e) { return {success:false}; }
}

function endSession(token) {
  try {
    if (token) PropertiesService.getScriptProperties().deleteProperty('sess_' + token);
    return {success:true};
  } catch(e) { return {success:true}; }
}

function checkLogin(user, pass) {
  const u = String(user||'').toLowerCase().trim();
  const p = String(pass||'').trim();
  if (!u || !p) return {success:false};

  try {
    const userRow = _findUserRow(u);
    if (userRow) {
      const activo = String(userRow.row[7]||'').toLowerCase();
      if (activo === 'no' || activo === 'false' || activo === '0') return {success:false, error:'Usuario inactivo'};
      const storedHash = String(userRow.row[2]||'');
      if (storedHash === _hashPassword(p)) {
        const name = String(userRow.row[4]||u);
        const role = String(userRow.row[3]||'cliente').toLowerCase();
        _updateLastLogin(userRow.rowIdx);
        return {success:true, user:u, role:role, name:name, sessionToken:_issueSession(u,role,name)};
      }
    }
  } catch(e) { /* sigue al fallback */ }

  try {
    const pr = PropertiesService.getScriptProperties();
    const au = (pr.getProperty('admin_user')||'admin').toLowerCase();
    const ap =  pr.getProperty('admin_pass') || 'Ingegar@2026';
    const cu = (pr.getProperty('client_user')||'carolina').toLowerCase();
    const cp =  pr.getProperty('client_pass') || 'Justburg3r!';
    const cn =  pr.getProperty('client_name') || 'Carolina (Just Burger)';
    if (u===au && p===ap) {
      const res = {success:true, user:u, role:'admin', name:'Ingegar Chile SpA'};
      res.sessionToken = _issueSession(res.user, res.role, res.name);
      return res;
    }
    if (u===cu && p===cp) {
      const res = {success:true, user:u, role:'cliente', name:cn};
      res.sessionToken = _issueSession(res.user, res.role, res.name);
      return res;
    }
  } catch(e) {}

  return {success:false};
}

function _findUserRow(username) {
  const sh = _ss().getSheetByName(SH.U);
  if (!sh || sh.getLastRow() <= 1) return null;
  const data    = sh.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  // Bug3/4 fix: usar índice por header, no hardcodeado
  const usrIdx = headers.indexOf('Username');
  const lookupIdx = usrIdx >= 0 ? usrIdx : 1; // fallback índice 1
  const lo = _norm(username);
  for (let i = 1; i < data.length; i++) {
    if (_norm(String(data[i][lookupIdx]||'')) === lo) {
      return {row: data[i], rowIdx: i+1, headers};
    }
  }
  return null;
}

// Helper: obtener Nombre de usuario usando header-based lookup (robusto ante reordenamiento)
function _getFullName(userObj) {
  if (!userObj) return '';
  if (userObj.headers) {
    const idx = userObj.headers.indexOf('Nombre');
    if (idx >= 0) return String(userObj.row[idx]||'');
  }
  return String(userObj.row[4]||''); // fallback a índice canónico
}
function _getUserPass(userObj) {
  if (!userObj) return '';
  if (userObj.headers) {
    const idx = userObj.headers.indexOf('Password_Plain');
    if (idx >= 0) return String(userObj.row[idx]||'');
  }
  return String(userObj.row[10]||'');
}
function _getUserRole2(userObj) {
  if (!userObj) return 'cliente';
  if (userObj.headers) {
    const idx = userObj.headers.indexOf('Role');
    if (idx >= 0) return String(userObj.row[idx]||'cliente').toLowerCase().trim();
  }
  return String(userObj.row[3]||'cliente').toLowerCase().trim();
}
function _getUserPassHash(userObj) {
  if (!userObj) return '';
  if (userObj.headers) {
    const idx = userObj.headers.indexOf('Password_Hash');
    if (idx >= 0) return String(userObj.row[idx]||'');
  }
  return String(userObj.row[2]||'');
}

function _updateLastLogin(rowIdx) {
  try {
    const sh = _ss().getSheetByName(SH.U);
    if (!sh) return;
    // Bug4 fix: usar header para encontrar columna Ultimo_Login
    const headers = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(h=>String(h).trim());
    const colIdx  = headers.indexOf('Ultimo_Login');
    sh.getRange(rowIdx, colIdx >= 0 ? colIdx+1 : 9).setValue(_now());
  } catch(e) {}
}

// ────────────────────────────────────────────────────────────────────────────
// USUARIOS — CRUD y migración
// ────────────────────────────────────────────────────────────────────────────
function setupUsuarios() {
  const ss = _ss();
  let sh = ss.getSheetByName(SH.U);
  if (sh) {
    const existing = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(h => String(h).trim());
    const missing = COLS_U.filter(c => !existing.includes(c));
    missing.forEach(col => {
      const nc = sh.getLastColumn() + 1;
      sh.getRange(1,nc).setValue(col).setFontWeight('bold').setBackground('#E52432').setFontColor('#fff');
    });
    return missing.length ? 'Columnas agregadas: ' + missing.join(', ') : 'Hoja Usuarios OK';
  }
  _mkSheet(ss, SH.U, COLS_U);
  return 'Hoja Usuarios creada';
}

function createDefaultUsers() {
  setupUsuarios();
  const created = [];
  const skipped = [];

  if (!_findUserRow('admin')) {
    _writeUser({username:'admin', pass:'Ingegar@2026', role:'admin',
      nombre:'Ingegar Chile SpA', email:'soporte@ingegarchile.cl', especialidad:'Coordinación'});
    created.push('admin');
  } else skipped.push('admin');

  if (!_findUserRow('carolina')) {
    _writeUser({username:'carolina', pass:'Justburg3r!', role:'cliente',
      nombre:'Carolina Mañán', email:CONFIG.CLIENT_EMAIL, especialidad:''});
    created.push('carolina');
  } else skipped.push('carolina');

  if (!_findUserRow('jesus')) {
    _writeUser({username:'jesus', pass:'Jesus@2026', role:'tecnico',
      nombre:'Jesús Pérez', email:'', especialidad:'Multidisciplinario'});
    created.push('jesus');
  } else skipped.push('jesus');

  try {
    const tecSh = _ss().getSheetByName(SH.TEC);
    if (tecSh) {
      const tecs = tecSh.getDataRange().getValues();
      const exists = tecs.some(r => _norm(String(r[0]||'')).includes('jes'));
      if (!exists) tecSh.appendRow(['Jesús Pérez','Multidisciplinario','Sí']);
    }
  } catch(e) {}

  return {success:true, created, skipped,
    message:'Creados: '+(created.length?created.join(', '):'ninguno')+
            ' | Ya existían: '+(skipped.length?skipped.join(', '):'ninguno')};
}

// v2.1: almacena Password_Plain al final para visibilidad de admin
function _writeUser(u) {
  const sh = _ss().getSheetByName(SH.U);
  if (!sh) throw new Error('Hoja Usuarios no existe — ejecuta setupUsuarios()');
  // Verificar columnas existentes para mapeo dinámico
  const headers = sh.getLastRow() >= 1
    ? sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(h=>String(h).trim())
    : COLS_U;
  const uid = 'u_' + Utilities.getUuid().replace(/-/g,'').substring(0,12);
  const vals = {
    UserID: uid,
    Username: String(u.username||'').toLowerCase().trim(),
    Password_Hash: _hashPassword(u.pass),
    Role: String(u.role||'cliente').toLowerCase(),
    Nombre: u.nombre || u.username,
    Email: u.email || '',
    Especialidad: u.especialidad || '',
    Activo: 'Sí',
    Ultimo_Login: '',
    Created_At: _now(),
    Password_Plain: u.pass || ''
  };
  // Usar COLS_U para orden canónico
  sh.appendRow(COLS_U.map(col => vals[col] !== undefined ? vals[col] : ''));
  return uid;
}

function migrateCredsToUsuarios() {
  setupUsuarios();
  try {
    const pr = PropertiesService.getScriptProperties();
    const moves = [];

    const au = (pr.getProperty('admin_user')||'admin').toLowerCase();
    const ap =  pr.getProperty('admin_pass') || 'Ingegar@2026';
    if (!_findUserRow(au)) {
      _writeUser({username:au, pass:ap, role:'admin', nombre:'Ingegar Chile SpA'});
      moves.push('admin: '+au);
    }

    const cu = (pr.getProperty('client_user')||'carolina').toLowerCase();
    const cp =  pr.getProperty('client_pass') || 'Justburg3r!';
    const cn =  pr.getProperty('client_name') || 'Carolina Mañán';
    if (!_findUserRow(cu)) {
      _writeUser({username:cu, pass:cp, role:'cliente', nombre:cn, email:CONFIG.CLIENT_EMAIL});
      moves.push('cliente: '+cu);
    }

    return {success:true, moves, message:moves.length?moves.join(', '):'Nada que migrar'};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// v2.1: incluye plainPass en la respuesta para la UI de admin
function getUsers() {
  try {
    const sh = _ss().getSheetByName(SH.U);
    if (!sh || sh.getLastRow() <= 1) return {success:true, users:[]};
    const data = sh.getDataRange().getValues();
    const headers = data[0].map(h=>String(h).trim());
    const ppIdx = headers.indexOf('Password_Plain');
    const users = data.slice(1)
      .filter(r => r[1])
      .map(r => ({
        userId:       String(r[0]||''),
        user:         String(r[1]||''),
        role:         String(r[3]||'cliente'),
        name:         String(r[4]||r[1]),
        email:        String(r[5]||''),
        especialidad: String(r[6]||''),
        activo:       String(r[7]||'Sí'),
        lastLogin:    r[8] instanceof Date ? Utilities.formatDate(r[8], CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm') : String(r[8]||''),
        plainPass:    ppIdx >= 0 ? String(r[ppIdx]||'') : '',
        createdAt:    r[9] instanceof Date ? Utilities.formatDate(r[9], CONFIG.TIMEZONE, 'yyyy-MM-dd') : String(r[9]||''),
        builtin:      ['admin','carolina','jesus'].includes(String(r[1]||'').toLowerCase())
      }));
    return {success:true, users};
  } catch(e) { return {success:false, users:[], error:e.toString()}; }
}

function addUser(username, pass, role, name, email, especialidad) {
  try {
    if (!username || !pass) return {success:false, error:'Usuario y contraseña requeridos'};
    if (!ROLES.includes(String(role||'').toLowerCase())) role = 'cliente';
    if (_findUserRow(username)) return {success:false, error:'Usuario ya existe'};
    setupUsuarios();
    _writeUser({username, pass, role, nombre:name||username, email:email||'', especialidad:especialidad||''});
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// v2.2: Editar datos de usuario existente (nombre, email, rol, especialidad)
function updateUserInfo(username, data) {
  try {
    const sh = _ss().getSheetByName(SH.U);
    if (!sh || sh.getLastRow() <= 1) return {success:false, error:'Hoja Usuarios no existe'};
    const rows = sh.getDataRange().getValues();
    const headers = rows[0].map(h => String(h).trim());
    const lo = _norm(username);
    const ri = rows.findIndex((r, i) => i > 0 && _norm(String(r[1]||'')) === lo);
    if (ri < 0) return {success:false, error:'Usuario no encontrado'};
    const fieldsMap = {
      nombre:       headers.indexOf('Nombre'),
      email:        headers.indexOf('Email'),
      role:         headers.indexOf('Role'),
      especialidad: headers.indexOf('Especialidad')
    };
    let changed = false;
    if (data.nombre      !== undefined && fieldsMap.nombre       >= 0) { sh.getRange(ri+1, fieldsMap.nombre+1).setValue(String(data.nombre||'')); changed=true; }
    if (data.email       !== undefined && fieldsMap.email        >= 0) { sh.getRange(ri+1, fieldsMap.email+1).setValue(String(data.email||'')); changed=true; }
    if (data.especialidad!== undefined && fieldsMap.especialidad >= 0) { sh.getRange(ri+1, fieldsMap.especialidad+1).setValue(String(data.especialidad||'')); changed=true; }
    if (data.role        !== undefined && fieldsMap.role         >= 0) {
      const newRole = String(data.role||'cliente').toLowerCase();
      if (ROLES.includes(newRole)) { sh.getRange(ri+1, fieldsMap.role+1).setValue(newRole); changed=true; }
    }
    return {success:true, changed};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function deleteUser(username) {
  try {
    const lo = _norm(username);
    if (['admin','carolina','jesus'].includes(lo)) {
      return {success:false, error:'Usuario sistema — usa "desactivar" en lugar de eliminar'};
    }
    const sh = _ss().getSheetByName(SH.U);
    if (!sh) return {success:false, error:'Hoja Usuarios no existe'};
    const data = sh.getDataRange().getValues();
    for (let i = data.length-1; i >= 1; i--) {
      if (_norm(data[i][1]) === lo) {
        sh.deleteRow(i+1);
        return {success:true};
      }
    }
    return {success:false, error:'Usuario no encontrado'};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function setUserActive(username, active) {
  try {
    const found = _findUserRow(username);
    if (!found) return {success:false, error:'Usuario no encontrado'};
    _ss().getSheetByName(SH.U).getRange(found.rowIdx, 8).setValue(active ? 'Sí' : 'No');
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// v2.1: actualiza hash + plain simultáneamente
function updateUserPassword(username, newPass) {
  try {
    const found = _findUserRow(username);
    if (!found) return {success:false, error:'Usuario no encontrado'};
    if (!newPass || String(newPass).length < 6) return {success:false, error:'Contraseña debe tener al menos 6 caracteres'};
    const sh = _ss().getSheetByName(SH.U);
    // Actualizar hash (columna 3)
    sh.getRange(found.rowIdx, 3).setValue(_hashPassword(newPass));
    // Actualizar plain (buscar columna dinámicamente)
    const headers = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(h=>String(h).trim());
    const ppIdx = headers.indexOf('Password_Plain');
    if (ppIdx >= 0) {
      sh.getRange(found.rowIdx, ppIdx + 1).setValue(newPass);
    } else {
      // Si no existe la columna, agregarla
      const nc = sh.getLastColumn() + 1;
      sh.getRange(1, nc).setValue('Password_Plain').setFontWeight('bold').setBackground('#E52432').setFontColor('#fff');
      sh.getRange(found.rowIdx, nc).setValue(newPass);
    }
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// v2.1: NUEVA — devuelve contraseña en texto plano para UI admin
function getUserPassword(username) {
  try {
    const found = _findUserRow(username);
    if (!found) return {success:false, error:'Usuario no encontrado'};
    const sh = _ss().getSheetByName(SH.U);
    const headers = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(h=>String(h).trim());
    const ppIdx = headers.indexOf('Password_Plain');
    const plain = ppIdx >= 0 ? String(found.row[ppIdx]||'') : '';
    return {success:true, password: plain || '', pass: plain || '', hasPlain: !!plain};
    // v2.2: 'password' es el campo que lee el frontend (r.password)
  } catch(e) { return {success:false, error:e.toString()}; }
}

// ────────────────────────────────────────────────────────────────────────────
// CREDENCIALES legacy (compatibilidad con UI existente)
// ────────────────────────────────────────────────────────────────────────────
function getCredentials() {
  try {
    const adm = _findUserRow('admin');
    const cli = _findUserRow('carolina');
    return {success:true,
      admin_user:  adm ? adm.row[1] : 'admin',
      client_user: cli ? cli.row[1] : 'carolina',
      client_name: cli ? cli.row[4] : 'Carolina Mañán'};
  } catch(e) {
    return {success:true, admin_user:'admin', client_user:'carolina', client_name:'Carolina Mañán'};
  }
}

function updateCredentials(type, user, pass, name) {
  try {
    const oldUsername = type === 'admin' ? 'admin' : 'carolina';
    const found = _findUserRow(oldUsername);
    if (found) {
      const sh = _ss().getSheetByName(SH.U);
      if (user) sh.getRange(found.rowIdx, 2).setValue(String(user||'').toLowerCase().trim());
      if (pass) {
        sh.getRange(found.rowIdx, 3).setValue(_hashPassword(pass));
        // Actualizar plain también
        const headers = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(h=>String(h).trim());
        const ppIdx = headers.indexOf('Password_Plain');
        if (ppIdx >= 0) sh.getRange(found.rowIdx, ppIdx+1).setValue(pass);
      }
      if (name) sh.getRange(found.rowIdx, 5).setValue(name);
    }
    const pr = PropertiesService.getScriptProperties();
    pr.setProperty(type+'_user', String(user||'').toLowerCase().trim());
    pr.setProperty(type+'_pass', String(pass||''));
    if (name) pr.setProperty(type+'_name', String(name));
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// ────────────────────────────────────────────────────────────────────────────
// INIT DATA
// ────────────────────────────────────────────────────────────────────────────
function getInitData() {
  try {
    const ss = _ss();
    const rv = n => { const s = ss.getSheetByName(n); return s ? s.getDataRange().getValues() : [[]]; };
    const sucursales = rv(SH.S).slice(1)
      .filter(r => r[0] && String(r[0]).trim())
      .filter(r => !/^no$/i.test(String(r[2]||'').trim()))
      .map(r => String(r[0]).trim()).filter(Boolean);
    const tecnicos = rv(SH.TEC).slice(1)
      .filter(r => r[0] && !/^no$/i.test(String(r[2]||'').trim()))
      .map(r => ({nombre:String(r[0]).trim(), especialidad:String(r[1]||'').trim()}))
      .filter(t => t.nombre);
    const cfg = rv(SH.CFG).slice(1);
    const byT = t => cfg.filter(r=>r[0]===t).sort((a,b)=>(a[2]||99)-(b[2]||99)).map(r=>String(r[1]).trim()).filter(Boolean);
    return {success:true, sucursales, tecnicos,
      estados:byT('estado'), urgencias:byT('urgencia'), categorias:byT('categoria')};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// ────────────────────────────────────────────────────────────────────────────
// TICKETS — CRUD
// ────────────────────────────────────────────────────────────────────────────
function getTickets(role, usuario) {
  try {
    const sheet = _ss().getSheetByName(SH.T);
    if (!sheet || sheet.getLastRow() <= 1) return {success:true, tickets:[]};
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());

    // v2.1: técnicos ven sus tickets aunque tengan Mostrar='no' o estén cerrados
    let tickets = data.slice(1).filter(r => r[0]).map(row => {
      const t = {};
      headers.forEach((h,i) => { t[h] = row[i] instanceof Date
        ? Utilities.formatDate(row[i], CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm')
        : String(row[i] === null || row[i] === undefined ? '' : row[i]); });
      return t;
    }).filter(t => {
      if (!t.Ticket_ID) return false;
      // v2.2: ocultar tickets fusionados (hijos) para todos los roles
      // Los tickets con Merged_Into son hijos de una fusión; se ven desde el ticket padre
      if (t.Merged_Into && t.Merged_Into.trim() && t.Estado === 'Fusionado') return false;
      if (role === 'admin') return true;
      if (role === 'tecnico') return true; // filtro adicional abajo
      return !/^no$/i.test(String(t.Mostrar));
    });

    // v2.2: Filtro técnico mejorado con colaboradores (F08)
    if (role === 'tecnico' && usuario) {
      const uNorm = _norm(usuario);
      const userObj = _findUserRow(usuario);
      const fullName = userObj ? _norm(_getFullName(userObj)) : ''; // Bug3 fix: header-based
      const firstName = fullName.split(' ')[0] || '';
      const lastName  = fullName.split(' ')[1] || '';

      tickets = tickets.filter(t => {
        // Check Tecnico principal
        const tec = _norm(String(t.Tecnico||''));
        const matchesTecnico = tec && (
          tec === uNorm ||
          (fullName && tec === fullName) ||
          (fullName && firstName.length > 2 && tec.includes(firstName)) ||
          (lastName && lastName.length > 2 && tec.includes(lastName)) ||
          (uNorm.length > 2 && tec.includes(uNorm)) ||
          (fullName && fullName.includes(tec) && tec.length > 3)
        );
        if (matchesTecnico) return true;

        // v2.2 F08: Check Colaboradores column
        const colabs = String(t.Colaboradores||'');
        if (colabs.trim()) {
          const colaborList = colabs.split(',').map(c => _norm(c.trim()));
          if (colaborList.includes(uNorm)) return true;
          if (fullName && colaborList.includes(fullName)) return true;
        }
        return false;
      });
    }

    // Enriquecer con hasFiles, item counts
    try {
      const hSh = _ss().getSheetByName(SH.H);
      if (hSh && hSh.getLastRow() > 1) {
        const hData = hSh.getDataRange().getValues();
        const hHeaders = hData[0].map(h => String(h).trim());
        const apIdx = hHeaders.indexOf('Avance_Parent_ID');
        const docMap = {};
        const inicialMap = {};
        const itemMap = {};
        for (let i = 1; i < hData.length; i++) {
          const tid = String(hData[i][0]||'');
          if (!tid) continue;
          const ea = String(hData[i][2]||'');
          const pid = apIdx >= 0 ? String(hData[i][apIdx]||'') : '';
          if (ea === '[DOC]') {
            docMap[tid] = (docMap[tid]||0) + 1;
            if (pid === '__inicial__' || pid === '__ticket_inicial__') inicialMap[tid] = (inicialMap[tid]||0) + 1;
          }
          if (ea === '[ITEM]') {
            if (!itemMap[tid]) itemMap[tid] = {total:0, pending:0};
            itemMap[tid].total++;
            let meta = {};
            try { meta = JSON.parse(String(hData[i][5]||'{}')); } catch(e) {}
            if (!meta.estado || meta.estado === 'pendiente' || meta.estado === 'proceso') itemMap[tid].pending++;
          }
        }
        tickets.forEach(t => {
          const tid = t.Ticket_ID;
          t.fileCount    = docMap[tid] || 0;
          t.hasFiles     = t.fileCount > 0;
          t.hasInicial   = (inicialMap[tid]||0) > 0;
          t.itemCount    = (itemMap[tid]||{}).total   || 0;
          t.pendingCount = (itemMap[tid]||{}).pending || 0;
        });
      } else {
        tickets.forEach(t => { t.fileCount=0; t.hasFiles=false; t.hasInicial=false; t.itemCount=0; t.pendingCount=0; });
      }
    } catch(e) { /* enriquecimiento opcional */ }

    return {success:true, tickets: tickets.reverse()};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function buildTicketId(urgencia, sucursal) {
  const yymmdd = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyMMdd');
  const m = {Emergencia:'EM', Urgencia:'UR', 'No urgente':'RQ', Preventivo:'PR'};
  const code = m[urgencia] || 'RQ';
  const corr = getTodayCorrelative();
  const suc = String(sucursal||'')
    .replace(/^tienda\s+/i,'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,12);
  const base = yymmdd + '-JB-' + code + corr + (suc ? '-'+suc : '');
  try {
    const sheet = _ss().getSheetByName(SH.T);
    if (!sheet || sheet.getLastRow() <= 1) return base;
    const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const tidIdx = headers.indexOf('Ticket_ID');
    if (tidIdx < 0) return base;
    const existing = new Set(sheet.getRange(2, tidIdx+1, sheet.getLastRow()-1, 1).getValues().flat().map(v => String(v||'').trim()).filter(Boolean));
    if (!existing.has(base)) return base;
    for (let seq = 2; seq < 999; seq++) {
      const cand = base + '-' + seq;
      if (!existing.has(cand)) return cand;
    }
    return base + '-' + Date.now().toString(36);
  } catch(e) { return base; }
}

function getTodayCorrelative() {
  try {
    const sheet = _ss().getSheetByName(SH.T);
    if (!sheet || sheet.getLastRow() <= 1) return 1;
    const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const data  = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const ci = headers.indexOf('Fecha_Creacion');
    return ci < 0 ? 1 : data.slice(1).filter(r => String(r[ci]).startsWith(today)).length + 1;
  } catch(e) { return 1; }
}

function createTicket(data) {
  try {
    const sheet   = _ss().getSheetByName(SH.T);
    const headers = sheet.getDataRange().getValues()[0].map(h => String(h).trim());
    const now = _now();
    const id  = buildTicketId(data.urgencia, data.sucursal);
    let carpetaUrl = '';
    try {
      const root   = DriveApp.getFolderById(CONFIG.FOLDER_APP_ID);
      const folder = root.createFolder(id);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      carpetaUrl = folder.getUrl();
    } catch(fe) { Logger.log('Folder: ' + fe); }
    const v = {
      Ticket_ID:id, Fecha_Creacion:now, Creado_Por:data.creado_por||'',
      Sucursal:data.sucursal||'', Urgencia:data.urgencia||'', Categoria:data.categoria||'',
      Titulo:data.titulo||'', Descripcion:data.descripcion||'', Estado:'Nuevo',
      Fecha_Estimada:'', Fecha_Cierre:'', Tecnico:'', OT_Numero:'',
      Carpeta_Drive:carpetaUrl, Resumen_Trabajo:'', Comentario_Cliente:'',
      Notas_Internas:'', Ultima_Actualizacion:now, Mostrar:'Sí',
      Vehiculo_Patente:'', Vehiculo_Descripcion:'',
      Parent_Ticket_ID: data.parent_ticket_id || '',
      Root_Ticket_ID:   data.root_ticket_id   || data.parent_ticket_id || '',
      Source_Type:      data.source_type       || '',
      Source_Note:      data.source_note       || '',
      Merged_Into:      ''
    };
    sheet.appendRow(headers.map(h => v[h] !== undefined ? v[h] : ''));
    _hist(id, '[CREADO]', 'Nuevo', data.creado_por||'sistema', 'Requerimiento creado', '');
    _notifyAdmins(id, data.titulo, data.sucursal, data.urgencia, data.descripcion, data.creado_por, carpetaUrl);

    // v2.2: guardar items si se envían junto con el ticket (F01 flujo paso 2→3)
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      data.items.forEach((item, idx) => {
        try {
          saveItem(id, {
            titulo:      item.titulo      || item.title  || 'Sin título',
            descripcion: item.desc        || item.descripcion || '',
            estado:      'pendiente',
            item_order:  idx + 1,
            created_at:  _now()
          }, data.creado_por || 'sistema');
        } catch(eItem) { Logger.log('Error guardando item ' + idx + ': ' + eItem); }
      });
    }

    return {success:true, id, carpetaUrl};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function updateTicket(id, updates, usuario) {
  try {
    const sheet   = _ss().getSheetByName(SH.T);
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const ri = data.findIndex((r,i) => i > 0 && String(r[0]) === String(id));
    if (ri < 1) return {success:false, error:'No encontrado'};
    const nota = updates._nota || ''; delete updates._nota;
    if (updates.Estado) {
      const ci = headers.indexOf('Estado'), oldEst = ci >= 0 ? String(data[ri][ci]) : '';
      // v2.2 F07: validar permisos de cambio de estado por rol
      const actorRole = _getUserRole(usuario);
      const estadosAdminOnly = ['Resuelto','Cancelado','Bloqueado'];
      const estadosPermitidosTecnico = ['En ejecucion','Esperando aprobacion'];
      if (actorRole === 'tecnico' && estadosAdminOnly.includes(updates.Estado)) {
        return {success:false, error:'El técnico no puede asignar el estado "'+updates.Estado+'". Requiere aprobación del administrador.'};
      }
      if (oldEst !== updates.Estado) {
        const parentId = _getLastAvanceId(id);
        _hist(id, oldEst, updates.Estado, usuario||'sistema', nota, parentId);
        if (['Resuelto','Cancelado','Fusionado','Cerrado'].includes(updates.Estado) && !updates.Fecha_Cierre)
          updates.Fecha_Cierre = _now().split(' ')[0];
        const ti = headers.indexOf('Titulo'), titulo = ti >= 0 ? String(data[ri][ti]) : id;
        _notifyCliente(id, titulo, oldEst, updates.Estado, nota);
      }
    }
    updates.Ultima_Actualizacion = _now();
    Object.entries(updates).forEach(([f,val]) => {
      const c = headers.indexOf(f);
      if (c >= 0) sheet.getRange(ri+1, c+1).setValue(val);
    });
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function updateTicketOT(tid, newOT, usuario) {
  try {
    const sheet  = _ss().getSheetByName(SH.T);
    const data   = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const otIdx  = headers.indexOf('OT_Numero');
    const tidIdx = headers.indexOf('Ticket_ID');
    if (otIdx < 0 || tidIdx < 0) return {success:false, error:'Columnas faltantes'};
    const row = data.findIndex((r,i) => i>0 && String(r[tidIdx]) === String(tid));
    if (row < 1) return {success:false, error:'Ticket no encontrado'};
    const prevOT = String(data[row][otIdx]||'').trim();
    const cleanOT = String(newOT||'').trim();
    if (prevOT === cleanOT) return {success:true, unchanged:true};
    sheet.getRange(row+1, otIdx+1).setValue(cleanOT);
    const parentId = _getLastAvanceId(tid);
    const noteText = prevOT ? ('OT: '+prevOT+' → '+cleanOT) : ('OT establecido: '+cleanOT);
    _hist(tid, '[OT]', '', usuario||'sistema', noteText, parentId);
    return {success:true, prevOT, newOT:cleanOT};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function deleteTicket(id) {
  try {
    const ss = _ss(), sheet = ss.getSheetByName(SH.T);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const ri = data.findIndex((r,i) => i > 0 && String(r[0]) === String(id));
    if (ri < 1) return {success:false, error:'Ticket no encontrado'};
    const folderColIdx = headers.indexOf('Carpeta_Drive');
    const folderUrl = folderColIdx >= 0 ? String(data[ri][folderColIdx]||'') : '';
    let folderDeleted = false;
    if (folderUrl) {
      try {
        const m = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        const fid = m ? m[1] : null;
        if (fid) { DriveApp.getFolderById(fid).setTrashed(true); folderDeleted = true; }
      } catch(e) {}
    }
    sheet.deleteRow(ri+1);
    const hsh = ss.getSheetByName(SH.H);
    let histDeleted = 0;
    if (hsh && hsh.getLastRow() > 1) {
      const hd = hsh.getDataRange().getValues();
      for (let i = hd.length-1; i >= 1; i--) {
        if (String(hd[i][0]) === String(id)) { hsh.deleteRow(i+1); histDeleted++; }
      }
    }
    return {success:true, folderDeleted, histDeleted};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function getHistorial(ticketId) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    if (!sh || sh.getLastRow() <= 1) return {success:true, historial:[]};
    const data = sh.getDataRange().getValues(), h = data[0].map(x => String(x).trim());
    return {success:true, historial: data.slice(1)
      .filter(r => String(r[0]) === String(ticketId))
      .map(row => { const t = {}; h.forEach((k,i) => t[k] = row[i] instanceof Date
        ? Utilities.formatDate(row[i], CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
        : String(row[i]||'')); return t; })
      .reverse()};
  } catch(e) { return {success:true, historial:[]}; }
}

// ────────────────────────────────────────────────────────────────────────────
// SETUP TRABAJO + AVANCES + ITEMS
// ────────────────────────────────────────────────────────────────────────────
function saveTicketSetup(tid, data, usuario) {
  try {
    const upd = {};
    // Acepta tanto casing camelCase (tecnico/ot/fechaEstimada) como ColumnName (Tecnico/OT_Numero/Fecha_Estimada)
    const tecVal   = data.tecnico       ?? data.Tecnico;
    const otVal    = data.ot            ?? data.OT_Numero;
    const fechaVal = data.fechaEstimada ?? data.Fecha_Estimada;
    if (tecVal   !== undefined && tecVal   !== null) upd.Tecnico        = tecVal;
    if (otVal    !== undefined && otVal    !== null) upd.OT_Numero      = otVal;
    if (fechaVal !== undefined && fechaVal !== null) upd.Fecha_Estimada = fechaVal;
    if (data.carpeta)       upd.Carpeta_Drive  = data.carpeta;

    // v2.2 F09: auto En revision cuando admin asigna técnico
    if (tecVal && String(tecVal).trim()) {
      try {
        const sheet2 = _ss().getSheetByName(SH.T);
        const data2  = sheet2.getDataRange().getValues();
        const hdr2   = data2[0].map(h=>String(h).trim());
        const ri2    = data2.findIndex((r,i)=>i>0&&String(r[0])===String(tid));
        if (ri2 > 0) {
          const estIdx2 = hdr2.indexOf('Estado');
          const estActual = estIdx2 >= 0 ? String(data2[ri2][estIdx2]) : '';
          if (estActual === 'Nuevo') {
            upd.Estado = 'En revision'; // técnico asignado → En revisión
          }
        }
      } catch(e2) { Logger.log('Auto-estado setup: ' + e2); }
    }

    if (Object.keys(upd).length) updateTicket(tid, upd, usuario);
    const meta = JSON.stringify({
      tecnico       : tecVal   || '',
      ot            : otVal    || '',
      fechaEstimada : fechaVal || ''
    });
    _hist(tid, '[INICIO]', '', usuario || 'sistema', meta, '');
    if (tecVal) _notifyTecnico(tid, tecVal, usuario);
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function saveAdminAvance(tid, avance, usuario) {
  try {
    const upd = {};
    if (avance.tecnico)     upd.Tecnico         = avance.tecnico;
    if (avance.ot)          upd.OT_Numero       = avance.ot;
    if (avance.resumen)     upd.Resumen_Trabajo = avance.resumen;
    if (Object.keys(upd).length) updateTicket(tid, upd, usuario);

    const avId = avance.avanceId || ('av_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2,7));
    const meta = JSON.stringify({
      avanceId      : avId,
      tecnico       : avance.tecnico       || '',
      ot            : avance.ot            || '',
      fechaAvance   : avance.fechaAvance   || _now().substring(0,10),
      fechaEstimada : avance.fechaEstimada || ''
    });

    _hist(tid, '[AVANCE]', avance.fechaAvance || '', usuario || 'sistema', meta, avId);
    if (avance.resumen && avance.resumen.trim())
      _hist(tid, '[COM]', 'admin', usuario || 'sistema', avance.resumen.trim(), avId);
    if (avance.notas && avance.notas.trim())
      _hist(tid, '[NOTA]', 'admin', usuario || 'sistema', avance.notas.trim(), avId);

    // AUTO estado
    if (!avance.nuevoEstado || !avance.nuevoEstado.trim()) {
      try {
        const sheet = _ss().getSheetByName(SH.T);
        const data = sheet.getDataRange().getValues();
        const headers = data[0].map(h => String(h).trim());
        const ri = data.findIndex((r,i) => i > 0 && String(r[0]) === String(tid));
        if (ri > 0) {
          const estIdx = headers.indexOf('Estado');
          const estActual = estIdx >= 0 ? String(data[ri][estIdx]) : '';
          const cerrados = ['Resuelto','Cancelado','Fusionado','Cerrado'];
          if (!cerrados.includes(estActual) && (estActual === 'Nuevo' || estActual === 'En revision')) {
            updateTicket(tid, {Estado:'En ejecucion', _nota:'Cambio automático al registrar avance'}, usuario || 'sistema');
          }
        }
      } catch(e2) {}
    }

    if (avance.nuevoEstado && avance.nuevoEstado.trim()) {
      updateTicket(tid, {Estado: avance.nuevoEstado, _nota:'Cambio al registrar avance'}, usuario);
    }

    if (avance.releaseTecnico) {
      const tecActual = avance.tecnico || '';
      updateTicket(tid, {Tecnico: ''}, usuario);
      _hist(tid, '[TEC]', '', usuario || 'sistema',
            'Técnico ' + (tecActual||usuario||'') + ' liberó la asignación tras avance ' + avId.substring(0,12),
            avId);
    }

    return {success:true, avanceId:avId};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function editAvanceEntry(tid, fecha, newData) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    const data = sh.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const apIdx = headers.indexOf('Avance_Parent_ID');
    const tz = Session.getScriptTimeZone();
    const _fmt = v => v instanceof Date
      ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss')
      : String(v||'').substring(0,19);
    const tStr = _fmt(String(fecha||'').trim());

    let avRow = -1, avanceId = '';
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (String(data[i][2]) !== '[AVANCE]') continue;
      if (_fmt(data[i][1]) !== tStr) continue;
      avRow = i;
      if (apIdx >= 0) avanceId = String(data[i][apIdx]||'');
      if (!avanceId) {
        try { const m = JSON.parse(String(data[i][5]||'')); avanceId = String(m.avanceId||''); } catch(e) {}
      }
      break;
    }
    if (avRow < 0) return {success:false, error:'Avance no encontrado'};

    const newMeta = JSON.stringify({
      avanceId      : avanceId,
      tecnico       : newData.tecnico       || '',
      ot            : newData.ot            || '',
      fechaAvance   : newData.fechaAvance   || '',
      fechaEstimada : newData.fechaEstimada || ''
    });
    sh.getRange(avRow + 1, 6).setValue(newMeta);

    let comUpdated = false;
    let notaFound = false;
    if (avanceId && apIdx >= 0) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) !== String(tid)) continue;
        if (String(data[i][apIdx]||'') !== avanceId) continue;
        const ea = String(data[i][2]||'');
        if (ea === '[COM]') {
          sh.getRange(i+1, 6).setValue((newData.resumen || '').trim());
          comUpdated = true;
        } else if (ea === '[NOTA]') {
          sh.getRange(i+1, 6).setValue((newData.notas || '').trim());
          notaFound = true;
        }
      }
    }

    if (!comUpdated && newData.resumen && newData.resumen.trim()) {
      _hist(tid, '[COM]', 'admin', 'sistema', newData.resumen.trim(), avanceId);
    }
    if (!notaFound && newData.notas && newData.notas.trim()) {
      _hist(tid, '[NOTA]', 'admin', 'sistema', newData.notas.trim(), avanceId);
    }

    _hist(tid, '[EDIT]', '', 'sistema', 'Avance editado — ' + tStr, avanceId);

    const tUpd = {};
    if (newData.tecnico) tUpd.Tecnico = newData.tecnico;
    if (newData.ot)      tUpd.OT_Numero = newData.ot;
    if (Object.keys(tUpd).length) updateTicket(tid, tUpd, 'sistema');

    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function deleteAvanceGroup(tid, fecha) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    const data = sh.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const apIdx = headers.indexOf('Avance_Parent_ID');
    const tz = Session.getScriptTimeZone();
    const _fmt = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss') : String(v||'').substring(0,19);
    const tStr = _fmt(String(fecha||'').trim());

    let avRow = -1, avParentId = '';
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (String(data[i][2]) !== '[AVANCE]') continue;
      if (_fmt(data[i][1]) !== tStr) continue;
      avRow = i;
      if (apIdx >= 0) avParentId = String(data[i][apIdx]||'');
      if (!avParentId) {
        try { const m = JSON.parse(String(data[i][5]||'')); avParentId = String(m.avanceId||''); } catch(e) {}
      }
      break;
    }
    if (avRow < 0) return {success:false, error:'Avance no encontrado'};

    const toDelete = [];
    if (avParentId && apIdx >= 0) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) !== String(tid)) continue;
        if (String(data[i][apIdx]||'') === avParentId) toDelete.push(i + 1);
      }
    } else {
      toDelete.push(avRow + 1);
    }
    toDelete.sort((a,b) => b - a).forEach(r => sh.deleteRow(r));
    return {success:true, deleted:toDelete.length, parentId:avParentId};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// ────────────────────────────────────────────────────────────────────────────
// ITEMS — sub-tareas dentro de un ticket
// ────────────────────────────────────────────────────────────────────────────
function saveItem(tid, itemData, usuario) {
  try {
    const itemId = 'it_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2,7);
    let itemOrder = 1;
    try {
      const sh = _ss().getSheetByName(SH.H);
      const data = sh.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(tid) && String(data[i][2]) === '[ITEM]') itemOrder++;
      }
    } catch(e) {}
    const meta = JSON.stringify({
      titulo:           itemData.titulo       || 'Sin título',
      descripcion:      itemData.descripcion  || '',
      estado:           itemData.estado       || 'pendiente',
      item_order:       itemData.item_order   || itemOrder,
      source_ticket_id: itemData.source_ticket_id || '',
      source_item_id:   itemData.source_item_id   || '',
      createdBy:        usuario || 'sistema',
      created_at:       itemData.created_at   || _now()
    });
    _hist(tid, '[ITEM]', itemId, usuario || 'sistema', meta, '');
    return {success:true, itemId};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function editItem(tid, itemId, newData, usuario) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (String(data[i][2]) !== '[ITEM]') continue;
      if (String(data[i][3]) !== String(itemId)) continue;
      let meta = {};
      try { meta = JSON.parse(String(data[i][5]||'')); } catch(e) {}
      if (newData.titulo !== undefined)       meta.titulo = newData.titulo;
      if (newData.descripcion !== undefined)  meta.descripcion = newData.descripcion;
      if (newData.estado !== undefined)       meta.estado = newData.estado;
      sh.getRange(i+1, 6).setValue(JSON.stringify(meta));
      return {success:true};
    }
    return {success:false, error:'Ítem no encontrado'};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function updateItemStatus(tid, itemId, newStatus, usuario) {
  const extra = (newStatus === 'resuelto') ? {resolved_at: _now()} : {};
  return editItem(tid, itemId, {estado:newStatus, ...extra}, usuario);
}

function deleteItem(tid, itemId, usuario) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    const data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (String(data[i][2]) !== '[ITEM]') continue;
      if (String(data[i][3]) !== String(itemId)) continue;
      sh.deleteRow(i+1);
      return {success:true};
    }
    return {success:false, error:'Ítem no encontrado'};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// v2.2 F01: Obtener items de un ticket directamente desde historial
function getItems(tid) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    if (!sh || sh.getLastRow() <= 1) return {success:true, items:[]};
    const data    = sh.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const fechaIdx   = headers.indexOf('Fecha');
    const eaIdx      = headers.indexOf('Estado_Anterior');
    const enIdx      = headers.indexOf('Estado_Nuevo');
    const usrIdx     = headers.indexOf('Usuario');
    const notaIdx    = headers.indexOf('Nota');
    const items = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (String(data[i][eaIdx >= 0 ? eaIdx : 2] || '') !== '[ITEM]') continue;
      let meta = {};
      try { meta = JSON.parse(String(data[i][notaIdx >= 0 ? notaIdx : 5]||'{}')); } catch(e2) {}
      items.push({
        id:               String(data[i][enIdx >= 0 ? enIdx : 3] || ''),
        titulo:           meta.titulo           || 'Sin título',
        descripcion:      meta.descripcion      || '',
        estado:           meta.estado           || 'pendiente',
        item_order:       meta.item_order       || items.length + 1,
        source_ticket_id: meta.source_ticket_id || '',
        source_item_id:   meta.source_item_id   || '',
        createdBy:        meta.createdBy        || String(data[i][usrIdx >= 0 ? usrIdx : 4] || ''),
        created_at:       meta.created_at       || (fechaIdx >= 0 ? String(data[i][fechaIdx]) : '')
      });
    }
    return {success:true, items};
  } catch(e) { return {success:false, items:[], error:e.toString()}; }
}

// ────────────────────────────────────────────────────────────────────────────
// TRAZABILIDAD — IDs derivados, fusión, separación
// ────────────────────────────────────────────────────────────────────────────
function buildDerivedTicketId(parentId) {
  try {
    const rootId = String(parentId||'').replace(/\.\d+$/, '');
    const sheet  = _ss().getSheetByName(SH.T);
    const data   = sheet.getDataRange().getValues();
    const headers= data[0].map(h=>String(h).trim());
    const ptIdx  = headers.indexOf('Parent_Ticket_ID');
    const idIdx  = headers.indexOf('Ticket_ID');
    let maxSuffix = 0;
    for (let i = 1; i < data.length; i++) {
      const tid = String(data[i][idIdx]||'');
      const pid = ptIdx >= 0 ? String(data[i][ptIdx]||'') : '';
      const m = tid.match(new RegExp('^' + rootId.replace(/[.+*?[\](){}|\\^$]/g,'\\$&') + '\\.(\\d+)$'));
      if (m) maxSuffix = Math.max(maxSuffix, parseInt(m[1])||0);
      if (pid === rootId || pid === parentId) {
        const m2 = tid.match(new RegExp('^' + rootId.replace(/[.+*?[\](){}|\\^$]/g,'\\$&') + '\\.(\\d+)$'));
        if (m2) maxSuffix = Math.max(maxSuffix, parseInt(m2[1])||0);
      }
    }
    return rootId + '.' + (maxSuffix + 1);
  } catch(e) { return String(parentId) + '.1'; }
}

function mergeTickets(ticketIds, usuario) {
  try {
    if (!ticketIds || ticketIds.length < 2) return {success:false, error:'Se requieren al menos 2 tickets para fusionar'};
    const sheet   = _ss().getSheetByName(SH.T);
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h=>String(h).trim());
    const idIdx   = headers.indexOf('Ticket_ID');
    const sucIdx  = headers.indexOf('Sucursal');
    const urgIdx  = headers.indexOf('Urgencia');
    const estIdx  = headers.indexOf('Estado');
    const tituloIdx = headers.indexOf('Titulo');
    const descIdx   = headers.indexOf('Descripcion');
    const catIdx    = headers.indexOf('Categoria');

    const ticketRows = ticketIds.map(tid => {
      const r = data.find((row,i) => i>0 && String(row[idIdx])===String(tid));
      return r ? {row:r, tid:String(r[idIdx]), suc:String(r[sucIdx]||''), urg:String(r[urgIdx]||''),
                  est:String(r[estIdx]||''), titulo:String(r[tituloIdx]||''), desc:String(r[descIdx]||''), cat:String(r[catIdx]||'')} : null;
    }).filter(Boolean);

    if (ticketRows.length < 2) return {success:false, error:'No se encontraron los tickets indicados'};

    const sucursales = [...new Set(ticketRows.map(r=>r.suc))];
    if (sucursales.length > 1) return {success:false, error:'Solo se pueden fusionar tickets de la misma sucursal. Detectadas: '+sucursales.join(', ')};

    const invalidos = ticketRows.filter(r=>['Fusionado','Cerrado'].includes(r.est));
    if (invalidos.length) return {success:false, error:'No se pueden fusionar tickets ya fusionados o cerrados: '+invalidos.map(r=>r.tid).join(', ')};

    const urgOrd = {Emergencia:4, Urgencia:3, 'No urgente':2, Preventivo:1};
    const urgencia = ticketRows.reduce((max,r) => (urgOrd[r.urg]||0) > (urgOrd[max]||0) ? r.urg : max, 'No urgente');

    const fcIdx = headers.indexOf('Fecha_Creacion');
    const mergedFromMeta = ticketRows.map(tr => {
      const fechaCreacion = fcIdx >= 0 ? tr.row[fcIdx] : '';
      return {
        id: tr.tid,
        fecha: fechaCreacion instanceof Date
          ? Utilities.formatDate(fechaCreacion, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm')
          : String(fechaCreacion||''),
        urgencia: tr.urg,
        titulo: tr.titulo
      };
    });
    const richNote = JSON.stringify({
      type: 'merge',
      merged_from: mergedFromMeta,
      text: 'Ticket generado por fusión de: ' + ticketIds.join(', ')
    });

    const newTicket = createTicket({
      urgencia, sucursal: sucursales[0], categoria: ticketRows[0].cat || '',
      titulo: 'Requerimientos varios',
      descripcion: 'Ticket fusionado · ' + ticketIds.length + ' tickets de origen',
      creado_por: usuario || 'sistema',
      source_type: 'merge',
      source_note: richNote
    });
    if (!newTicket.success) return newTicket;
    const newTid = newTicket.id;
    const newNote = 'Ticket generado por fusión de: ' + ticketIds.join(', ');

    const hSh = _ss().getSheetByName(SH.H);
    const hData = hSh.getDataRange().getValues();

    let itemOrder = 1;
    for (const tr of ticketRows) {
      const srcItems = [];
      for (let i = 1; i < hData.length; i++) {
        if (String(hData[i][0]) !== tr.tid) continue;
        if (String(hData[i][2]) !== '[ITEM]') continue;
        let meta = {};
        try { meta = JSON.parse(String(hData[i][5]||'{}')); } catch(e) {}
        srcItems.push({...meta, source_ticket_id:tr.tid, source_item_id:String(hData[i][3]||'')});
      }
      if (!srcItems.length) {
        saveItem(newTid, {
          titulo: tr.titulo, descripcion: tr.desc,
          item_order: itemOrder++,
          source_ticket_id: tr.tid, source_item_id: ''
        }, usuario);
      } else {
        srcItems.forEach(it => {
          saveItem(newTid, {...it, item_order: itemOrder++}, usuario);
        });
      }
      updateTicket(tr.tid, {Estado:'Fusionado', Merged_Into:newTid, Mostrar:'no'}, usuario);
      _hist(tr.tid, tr.est, 'Fusionado', usuario||'sistema', 'Fusionado en ticket: '+newTid, '');
    }

    _hist(newTid, '[CREADO]', 'Nuevo', usuario||'sistema', newNote, '');
    return {success:true, newTicketId:newTid, merged:ticketIds};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function splitItemsToNewTicket(sourceTid, itemIds, usuario) {
  try {
    if (!itemIds || !itemIds.length) return {success:false, error:'No se seleccionaron ítems'};
    const sheet   = _ss().getSheetByName(SH.T);
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h=>String(h).trim());
    const srcRow  = data.find((r,i) => i>0 && String(r[headers.indexOf('Ticket_ID')])===String(sourceTid));
    if (!srcRow) return {success:false, error:'Ticket origen no encontrado'};

    const suc  = String(srcRow[headers.indexOf('Sucursal')]||'');
    const urg  = String(srcRow[headers.indexOf('Urgencia')]||'');
    const cat  = String(srcRow[headers.indexOf('Categoria')]||'');
    const derivedId = buildDerivedTicketId(sourceTid);
    const srcNote   = 'Ticket generado desde ticket anterior: '+sourceTid;

    const hSh   = _ss().getSheetByName(SH.H);
    const hData = hSh.getDataRange().getValues();

    const itemsToMove = [];
    for (let i = 1; i < hData.length; i++) {
      if (String(hData[i][0]) !== String(sourceTid)) continue;
      if (String(hData[i][2]) !== '[ITEM]') continue;
      const iid = String(hData[i][3]||'');
      if (itemIds.includes(iid)) {
        let meta = {};
        try { meta = JSON.parse(String(hData[i][5]||'{}')); } catch(e) {}
        itemsToMove.push({iid, meta, row:i+1});
      }
    }
    if (!itemsToMove.length) return {success:false, error:'Ítems no encontrados en el ticket'};

    const newTicket = createTicket({
      urgencia: urg, sucursal: suc, categoria: cat,
      titulo: itemsToMove.length === 1 ? (itemsToMove[0].meta.titulo||'Ítem separado') : 'Requerimientos varios',
      descripcion: srcNote,
      creado_por: usuario || 'sistema',
      parent_ticket_id: sourceTid,
      root_ticket_id:   (srcRow[headers.indexOf('Root_Ticket_ID')]||'') || sourceTid,
      source_type:      'split',
      source_note:      srcNote
    });
    if (!newTicket.success) return newTicket;
    const newTid = newTicket.id;

    itemsToMove.forEach((it, idx) => {
      saveItem(newTid, {
        ...it.meta, item_order: idx+1,
        source_ticket_id: sourceTid, source_item_id: it.iid
      }, usuario);
      editItem(sourceTid, it.iid, {estado:'movido', moved_to:newTid}, usuario);
    });

    _hist(sourceTid, '[EDIT]', 'Split', usuario||'sistema', itemIds.length+' ítems separados a ticket: '+newTid, '');
    _hist(newTid, '[CREADO]', 'Nuevo', usuario||'sistema', srcNote, '');
    return {success:true, newTicketId:newTid, derivedId, movedCount:itemsToMove.length};
  } catch(e) { return {success:false, error:e.toString()}; }
}


// v2.2 F08: Gestión de técnicos colaboradores
function addCollaborator(tid, technicianName, usuario) {
  try {
    const sheet   = _ss().getSheetByName(SH.T);
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const ri      = data.findIndex((r,i) => i > 0 && String(r[0]) === String(tid));
    if (ri < 1) return {success:false, error:'Ticket no encontrado'};
    const colIdx  = headers.indexOf('Colaboradores');
    if (colIdx < 0) return {success:false, error:'Columna Colaboradores no existe. Ejecuta addMissingColumns().'};
    const existing = String(data[ri][colIdx]||'').split(',').map(s=>s.trim()).filter(Boolean);
    const normNew  = _norm(technicianName);
    if (existing.map(s=>_norm(s)).includes(normNew)) return {success:true, message:'Ya es colaborador'};
    existing.push(technicianName.trim());
    sheet.getRange(ri+1, colIdx+1).setValue(existing.join(', '));
    _hist(tid, '[COLABORADOR]', technicianName, usuario||'sistema',
          'Técnico colaborador agregado: ' + technicianName, '');
    return {success:true, colaboradores: existing};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function removeCollaborator(tid, technicianName, usuario) {
  try {
    const sheet   = _ss().getSheetByName(SH.T);
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const ri      = data.findIndex((r,i) => i > 0 && String(r[0]) === String(tid));
    if (ri < 1) return {success:false, error:'Ticket no encontrado'};
    const colIdx  = headers.indexOf('Colaboradores');
    if (colIdx < 0) return {success:false, error:'Columna Colaboradores no existe'};
    const normDel  = _norm(technicianName);
    const remaining = String(data[ri][colIdx]||'').split(',')
      .map(s=>s.trim()).filter(s => s && _norm(s) !== normDel);
    sheet.getRange(ri+1, colIdx+1).setValue(remaining.join(', '));
    _hist(tid, '[COLABORADOR]', '', usuario||'sistema',
          'Técnico colaborador removido: ' + technicianName, '');
    return {success:true, colaboradores: remaining};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function getCollaborators(tid) {
  try {
    const sheet   = _ss().getSheetByName(SH.T);
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const ri      = data.findIndex((r,i) => i > 0 && String(r[0]) === String(tid));
    if (ri < 1) return {success:false, error:'Ticket no encontrado'};
    const colIdx  = headers.indexOf('Colaboradores');
    const raw     = colIdx >= 0 ? String(data[ri][colIdx]||'') : '';
    const colaboradores = raw.split(',').map(s=>s.trim()).filter(Boolean);
    return {success:true, colaboradores};
  } catch(e) { return {success:false, colaboradores:[], error:e.toString()}; }
}

function getPendingItems(tid) {
  try {
    const hSh   = _ss().getSheetByName(SH.H);
    const hData = hSh.getDataRange().getValues();
    const pending = [];
    for (let i = 1; i < hData.length; i++) {
      if (String(hData[i][0]) !== String(tid)) continue;
      if (String(hData[i][2]) !== '[ITEM]') continue;
      let meta = {};
      try { meta = JSON.parse(String(hData[i][5]||'{}')); } catch(e) {}
      const est = String(meta.estado||'pendiente');
      if (est === 'pendiente' || est === 'proceso') {
        pending.push({id:String(hData[i][3]||''), titulo:meta.titulo||'Sin título', estado:est});
      }
    }
    return {success:true, pending};
  } catch(e) { return {success:false, error:e.toString(), pending:[]}; }
}

function closeTicketWithPendingItems(tid, pendingItemIds, createNewFromPending, usuario) {
  try {
    let newTicketId = null;
    if (createNewFromPending && pendingItemIds && pendingItemIds.length) {
      const splitResult = splitItemsToNewTicket(tid, pendingItemIds, usuario);
      if (splitResult.success) newTicketId = splitResult.newTicketId;
    }
    updateTicket(tid, {Estado:'Resuelto', _nota: newTicketId
      ? 'Ticket cerrado. Ítems pendientes enviados al ticket: '+newTicketId
      : 'Ticket cerrado con ítems pendientes registrados en historial'
    }, usuario);
    if (!createNewFromPending && pendingItemIds && pendingItemIds.length) {
      _hist(tid, '[EDIT]', 'Cerrado_con_pendientes', usuario||'sistema',
        'Cerrado con '+pendingItemIds.length+' ítem(s) pendiente(s) sin crear nuevo ticket', '');
    }
    return {success:true, newTicketId};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// ────────────────────────────────────────────────────────────────────────────
function addComment(tid, txt, usuario, rol) {
  try {
    const parentId = _getLastAvanceId(tid);
    _hist(tid, '[COM]', rol||'admin', usuario||'sistema', (txt||'').trim(), parentId);
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function addAdminNote(tid, txt, usuario) {
  try {
    const noteId = 'note_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2,6);
    _hist(tid, '[NOTA-ADM]', noteId, usuario||'sistema', (txt||'').trim(), '__admin_note__');
    return {success:true, noteId};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function editAdminNote(tid, noteId, newText) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (String(data[i][2]) !== '[NOTA-ADM]') continue;
      if (String(data[i][3]) !== String(noteId)) continue;
      sh.getRange(i+1, 6).setValue(String(newText||'').trim());
      return {success:true};
    }
    return {success:false, error:'Nota no encontrada'};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function deleteAdminNote(tid, noteId) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    const data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (String(data[i][2]) !== '[NOTA-ADM]') continue;
      if (String(data[i][3]) !== String(noteId)) continue;
      sh.deleteRow(i+1);
      return {success:true};
    }
    return {success:false, error:'Nota no encontrada'};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function editComment(tid, fecha, newText) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    const data = sh.getDataRange().getValues();
    const tz = Session.getScriptTimeZone();
    const _fmt = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss') : String(v||'').substring(0,19);
    const tStr = _fmt(String(fecha||'').trim());
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (String(data[i][2]) !== '[COM]') continue;
      if (_fmt(data[i][1]) !== tStr) continue;
      sh.getRange(i+1, 6).setValue(String(newText||'').trim());
      return {success:true};
    }
    return {success:false, error:'Comentario no encontrado'};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function editHistNota(tid, fecha, nota) { return editComment(tid, fecha, nota); }

function deleteHistorialEntry(tid, fecha) {
  try {
    const sh = _ss().getSheetByName(SH.H);
    const data = sh.getDataRange().getValues();
    const tz = Session.getScriptTimeZone();
    const _fmt = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss') : String(v||'').substring(0,19);
    const tStr = _fmt(String(fecha||'').trim());
    let targetRow = -1, targetEa = '';
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) !== String(tid)) continue;
      if (_fmt(data[i][1]) === tStr) {
        targetRow = i + 1;
        targetEa = String(data[i][2]||'');
        break;
      }
    }
    if (targetRow < 0) return {success:false, error:'Evento no encontrado'};
    const isStateChange = targetEa.length > 0 && !targetEa.startsWith('[');
    if (isStateChange) {
      const stateEvents = data.slice(1)
        .filter(r => String(r[0]) === String(tid) && String(r[2]).length > 0 && !String(r[2]).startsWith('[') && _fmt(r[1]) !== tStr)
        .sort((a,b) => new Date(_fmt(a[1])) - new Date(_fmt(b[1])));
      const prevState = stateEvents.length ? String(stateEvents[stateEvents.length-1][2]) : 'Nuevo';
      const allStateEvents = data.slice(1)
        .filter(r => String(r[0]) === String(tid) && String(r[2]).length > 0 && !String(r[2]).startsWith('['))
        .sort((a,b) => new Date(_fmt(a[1])) - new Date(_fmt(b[1])));
      const lastStateEvent = allStateEvents[allStateEvents.length - 1];
      if (lastStateEvent && _fmt(lastStateEvent[1]) === tStr) {
        updateTicket(tid, { Estado: prevState === targetEa ? 'Nuevo' : (prevState || 'Nuevo') }, 'sistema');
      }
    }
    sh.deleteRow(targetRow);
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// ────────────────────────────────────────────────────────────────────────────
// DRIVE — archivos
// ────────────────────────────────────────────────────────────────────────────
function getFolderFiles(folderUrl) {
  try {
    if (!folderUrl || !folderUrl.trim()) return {success:false, error:'URL vacía'};
    const fm = String(folderUrl).match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const dm = String(folderUrl).match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fid = fm ? fm[1] : dm ? dm[1] : null;
    if (!fid) return {success:false, error:'ID no encontrado'};
    const folder = DriveApp.getFolderById(fid);
    const files = []; const iter = folder.getFiles();
    while (iter.hasNext()) {
      const f = iter.next(), mime = f.getMimeType();
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
      const type = mime.includes('pdf') ? 'pdf' : mime.includes('image') ? 'image'
        : mime.includes('spreadsheet')||mime.includes('excel') ? 'sheet'
        : mime.includes('document')||mime.includes('word') ? 'doc' : 'file';
      files.push({id:f.getId(), name:f.getName(), type, mimeType:mime,
        url:'https://drive.google.com/file/d/'+f.getId()+'/view',
        previewUrl:'https://drive.google.com/file/d/'+f.getId()+'/preview',
        size:f.getSize(), date:Utilities.formatDate(f.getDateCreated(),CONFIG.TIMEZONE,'yyyy-MM-dd')});
    }
    const ord = {pdf:0,doc:1,sheet:2,image:3,file:4};
    files.sort((a,b) => ord[a.type]!==ord[b.type] ? ord[a.type]-ord[b.type] : b.date.localeCompare(a.date));
    return {success:true, files, count:files.length};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function uploadFileToTicket(b64, fileName, mimeType, ticketId, usuario, parentAvanceId, duration_seconds) {
  try {
    const isVideo = CONFIG.VIDEO_TYPES.includes(String(mimeType||'').split(';')[0].trim());
    const decodedSize = Math.round((b64.length * 3) / 4);
    const maxBytes = (isVideo ? CONFIG.MAX_VIDEO_MB : CONFIG.MAX_FILE_MB) * 1024 * 1024;
    if (decodedSize > maxBytes) {
      return {success:false, error:'Archivo supera el límite de '+(isVideo?CONFIG.MAX_VIDEO_MB:CONFIG.MAX_FILE_MB)+' MB'};
    }
    if (isVideo && duration_seconds && Number(duration_seconds) > CONFIG.MAX_VIDEO_SEC) {
      return {success:false, error:'El video supera los '+CONFIG.MAX_VIDEO_SEC+' segundos permitidos (duración: '+Math.round(Number(duration_seconds))+'s)'};
    }

    let folder;
    try {
      const sheet = _ss().getSheetByName(SH.T), data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const row = data.find((r,i) => i>0 && String(r[0])===String(ticketId));
      if (row) {
        const ci = headers.indexOf('Carpeta_Drive');
        const carpetaUrl = ci >= 0 ? String(row[ci]) : '';
        if (carpetaUrl) {
          const fm = carpetaUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
          const dm = carpetaUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          const fid = fm ? fm[1] : (dm ? dm[1] : null);
          if (fid) { try { folder = DriveApp.getFolderById(fid); } catch(e) {} }
        }
      }
    } catch(e) {}
    if (!folder) {
      const root = DriveApp.getFolderById(CONFIG.FOLDER_APP_ID);
      folder = root.createFolder(ticketId);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      try { updateTicket(ticketId, {Carpeta_Drive: folder.getUrl()}, usuario||'sistema'); } catch(e) {}
    }
    const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mimeType, fileName));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const docMeta = JSON.stringify({
      parentId:   parentAvanceId || '',
      isVideo:    isVideo,
      duration_s: isVideo ? (Number(duration_seconds)||0) : null
    });
    try {
      const sh = _ss().getSheetByName(SH.H);
      const now = _now();
      const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(h=>String(h).trim());
      const row = headers.map(h => {
        if (h==='Ticket_ID') return ticketId;
        if (h==='Fecha') return now;
        if (h==='Estado_Anterior') return '[DOC]';
        if (h==='Estado_Nuevo') return fileName;
        if (h==='Usuario') return usuario||'sistema';
        if (h==='Nota') return docMeta;
        if (h==='Avance_Parent_ID') return parentAvanceId||'';
        return '';
      });
      sh.appendRow(row);
    } catch(he) { Logger.log('Historial DOC: '+he); }

    return {success:true,
      url: file.getUrl(), id: file.getId(), name: file.getName(),
      previewUrl: 'https://drive.google.com/file/d/'+file.getId()+'/preview',
      size: file.getSize(),
      mimeType: file.getMimeType(),
      isVideo: isVideo,
      duration_s: isVideo ? (Number(duration_seconds)||0) : null
    };
  } catch(e) { return {success:false, error:e.toString()}; }
}

function renameFile(fileId, newName) {
  try {
    if (!fileId || !newName) return {success:false, error:'Datos faltantes'};
    DriveApp.getFileById(fileId).setName(String(newName).trim());
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function deleteFileFromTicket(fileId, fileName, ticketId, usuario) {
  try {
    if (!fileId) return {success:false, error:'fileId requerido'};
    let trashed = false;
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
      trashed = true;
    } catch(e) {}

    let histDeleted = 0;
    if (ticketId && fileName) {
      const sh = _ss().getSheetByName(SH.H);
      if (sh && sh.getLastRow() > 1) {
        const data = sh.getDataRange().getValues();
        for (let i = data.length-1; i >= 1; i--) {
          if (String(data[i][0]) !== String(ticketId)) continue;
          if (String(data[i][2]) !== '[DOC]') continue;
          if (String(data[i][3]) !== String(fileName)) continue;
          sh.deleteRow(i+1);
          histDeleted++;
          break;
        }
      }
    }

    if (ticketId) {
      try {
        _hist(ticketId, '[EDIT]', '', usuario||'sistema',
              'Archivo eliminado: '+(fileName||fileId), '');
      } catch(e) {}
    }

    return {success:true, trashed, histDeleted};
  } catch(e) { return {success:false, error:e.toString()}; }
}

function downloadFolderZip(folderUrl, ticketId) {
  try {
    if (!folderUrl) return {success:false, error:'Sin carpeta asociada'};
    const fm = String(folderUrl).match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const dm = String(folderUrl).match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fid = fm ? fm[1] : (dm ? dm[1] : null);
    if (!fid) return {success:false, error:'URL inválida'};
    const folder = DriveApp.getFolderById(fid);
    const iter = folder.getFiles();
    const blobs = [];
    let count = 0;
    while (iter.hasNext() && count < 100) {
      const f = iter.next();
      try { blobs.push(f.getBlob()); count++; } catch(e) {}
    }
    if (!blobs.length) return {success:false, error:'No hay archivos en la carpeta'};
    const zipBlob = Utilities.zip(blobs, (ticketId||'documentos') + '.zip');
    return {success: true,
      filename: (ticketId||'documentos') + '.zip',
      data: Utilities.base64Encode(zipBlob.getBytes()),
      count: count};
  } catch(e) { return {success:false, error:e.toString()}; }
}

// ────────────────────────────────────────────────────────────────────────────
// v2.1: REPORTE DE CIERRE — genera data estructurada para el PDF/print del frontend
// ────────────────────────────────────────────────────────────────────────────
function generateWorkReport(ticketId) {
  try {
    const sheet = _ss().getSheetByName(SH.T);
    if (!sheet || sheet.getLastRow() <= 1) return {success:false, error:'Sin datos'};
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const row = data.find((r,i) => i>0 && String(r[headers.indexOf('Ticket_ID')]) === String(ticketId));
    if (!row) return {success:false, error:'Ticket no encontrado'};

    const t = {};
    headers.forEach((h,i) => {
      t[h] = row[i] instanceof Date
        ? Utilities.formatDate(row[i], CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm')
        : String(row[i]||'');
    });

    // Historial completo
    const hSh = _ss().getSheetByName(SH.H);
    const hData = hSh.getDataRange().getValues();
    const hHeaders = hData[0].map(h=>String(h).trim());
    const histRaw = hData.slice(1).filter(r => String(r[0]) === ticketId);

    // Parsear avances con resúmenes
    const avances = [];
    const apIdx = hHeaders.indexOf('Avance_Parent_ID');
    const avMap = new Map();

    histRaw.forEach((r, idx) => {
      if (String(r[2]) === '[AVANCE]') {
        let meta = {};
        try { meta = JSON.parse(String(r[5]||'{}')); } catch(e) {}
        const avId = meta.avanceId || (apIdx>=0 ? String(r[apIdx]||'') : '');
        avMap.set(avId, {
          fecha: r[1] instanceof Date ? Utilities.formatDate(r[1], CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm') : String(r[1]||''),
          tecnico: meta.tecnico || '',
          ot: meta.ot || '',
          resumen: '',
          notas: ''
        });
      }
    });

    histRaw.forEach(r => {
      const ea = String(r[2]||'');
      const pid = apIdx>=0 ? String(r[apIdx]||'') : '';
      if (ea === '[COM]' && avMap.has(pid)) avMap.get(pid).resumen = String(r[5]||'');
      if (ea === '[NOTA]' && avMap.has(pid)) avMap.get(pid).notas = String(r[5]||'');
    });

    avMap.forEach(av => avances.push(av));
    avances.sort((a,b) => a.fecha.localeCompare(b.fecha));

    // Items
    const items = [];
    histRaw.forEach(r => {
      if (String(r[2]) === '[ITEM]') {
        let meta = {};
        try { meta = JSON.parse(String(r[5]||'{}')); } catch(e) {}
        items.push({titulo: meta.titulo||'Sin título', estado: meta.estado||'pendiente'});
      }
    });

    // Archivos en Drive
    let files = [];
    if (t.Carpeta_Drive) {
      try {
        const fm = t.Carpeta_Drive.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (fm) {
          const folder = DriveApp.getFolderById(fm[1]);
          const iter = folder.getFiles();
          while (iter.hasNext()) {
            const f = iter.next();
            files.push({name: f.getName(), size: f.getSize(), url: 'https://drive.google.com/file/d/'+f.getId()+'/view'});
          }
        }
      } catch(e) {}
    }

    // Duración total (horas entre creacion y cierre o ahora)
    let durHoras = '';
    try {
      const fechaCreacion = new Date(t.Fecha_Creacion.replace('/','-').replace(' ','T'));
      const fechaCierre   = t.Fecha_Cierre ? new Date(t.Fecha_Cierre.replace('/','-').replace(' ','T')) : new Date();
      const diff = Math.abs(fechaCierre - fechaCreacion);
      const hh = Math.floor(diff / 3600000);
      const dd = Math.floor(hh / 24);
      durHoras = dd > 0 ? dd+'d '+(hh%24)+'h' : hh+'h';
    } catch(e) {}

    return {
      success: true,
      ticket: t,
      avances,
      items,
      files,
      durHoras,
      generadoEn: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm'),
      empresa: 'Ingegar Chile SpA'
    };
  } catch(e) { return {success:false, error:e.toString()}; }
}

// ────────────────────────────────────────────────────────────────────────────
// CONFIG CRUD
// ────────────────────────────────────────────────────────────────────────────
function addSucursal(n,c) {
  try { _ss().getSheetByName(SH.S).appendRow([n.trim(),(c||'Santiago').trim(),'Sí']); return {success:true}; }
  catch(e) { return {success:false, error:e.toString()}; }
}
function deleteSucursal(n) {
  try {
    const sh=_ss().getSheetByName(SH.S), d=sh.getDataRange().getValues();
    for (let i=d.length-1;i>=1;i--) if(String(d[i][0]).trim()===n.trim()){sh.deleteRow(i+1);return{success:true};}
    return {success:false};
  } catch(e) { return {success:false, error:e.toString()}; }
}
function editSucursal(o,n,c) {
  try {
    const sh=_ss().getSheetByName(SH.S), d=sh.getDataRange().getValues();
    for (let i=1;i<d.length;i++) {
      if(String(d[i][0]).trim()===o.trim()){
        sh.getRange(i+1,1).setValue(n.trim());
        if(c) sh.getRange(i+1,2).setValue(c.trim());
        return{success:true};
      }
    }
    return {success:false};
  } catch(e) { return {success:false, error:e.toString()}; }
}
function addTecnico(n,e) {
  try { _ss().getSheetByName(SH.TEC).appendRow([n.trim(),(e||'Multidisciplinario').trim(),'Sí']); return {success:true}; }
  catch(e2) { return {success:false, error:e2.toString()}; }
}
function deleteTecnico(n) {
  try {
    const sh=_ss().getSheetByName(SH.TEC), d=sh.getDataRange().getValues();
    for (let i=d.length-1;i>=1;i--) if(String(d[i][0]).trim()===n.trim()){sh.deleteRow(i+1);return{success:true};}
    return {success:false};
  } catch(e) { return {success:false, error:e.toString()}; }
}
function addCategoria(n) {
  try {
    const sh=_ss().getSheetByName(SH.CFG), d=sh.getDataRange().getValues();
    const max=d.filter(r=>r[0]==='categoria').reduce((m,r)=>Math.max(m,Number(r[2])||0),0);
    sh.appendRow(['categoria',n.trim(),max+1]);
    return {success:true};
  } catch(e) { return {success:false, error:e.toString()}; }
}
function deleteCategoria(n) {
  try {
    const sh=_ss().getSheetByName(SH.CFG), d=sh.getDataRange().getValues();
    for (let i=d.length-1;i>=1;i--) if(d[i][0]==='categoria'&&String(d[i][1]).trim()===n.trim()){sh.deleteRow(i+1);return{success:true};}
    return {success:false};
  } catch(e) { return {success:false, error:e.toString()}; }
}
function addUrgencia(n) {
  try {
    const sh=_ss().getSheetByName(SH.CFG), d=sh.getDataRange().getValues();
    const max=d.filter(r=>r[0]==='urgencia').reduce((m,r)=>Math.max(m,Number(r[2])||0),0);
    sh.appendRow(['urgencia',n.trim(),max+1]);
    return { success: true };
  } catch(e) { return { success: false, error: e.toString() }; }
}
function deleteUrgencia(n) {
  try {
    const sh=_ss().getSheetByName(SH.CFG), d=sh.getDataRange().getValues();
    const i=d.findIndex(r=>r[0]==='urgencia'&&r[1]===n);
    if(i>0)sh.deleteRow(i+1);
    return { success: true };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// ────────────────────────────────────────────────────────────────────────────
// NOTIFICACIONES
// ────────────────────────────────────────────────────────────────────────────
function _notifyAdmins(id, titulo, sucursal, urgencia, desc, creado_por, carpetaUrl) {
  try {
    const ic = {Emergencia:'🚨',Urgencia:'⚡','No urgente':'📋',Preventivo:'🔧'};
    const icon = ic[urgencia] || '📋';
    MailApp.sendEmail({to:CONFIG.ADMIN_EMAILS,
      subject:icon+' NUEVO ['+id+'] '+urgencia+': '+titulo+' — '+sucursal,
      htmlBody:'<p>'+icon+' <b>'+urgencia+'</b> | '+titulo+'</p>'
        +'<p>📍 '+sucursal+(creado_por?' | Por: '+creado_por:'')+'</p>'
        +(desc?'<p>'+desc.replace(/\n/g,'<br>')+'</p>':'')
        +(carpetaUrl?'<p><a href="'+carpetaUrl+'">📁 Carpeta Drive</a></p>':'')});
  } catch(e) { Logger.log('Email: '+e); }
}
function _notifyCliente(id, titulo, deEst, aEst, nota) {
  try {
    MailApp.sendEmail({to:CONFIG.CLIENT_EMAIL,
      subject:'['+id+'] Estado actualizado: '+aEst,
      htmlBody:'<p><b>['+id+'] '+titulo+'</b></p>'
        +'<p>Estado: '+(deEst||'—')+' → <b>'+aEst+'</b></p>'
        +(nota?'<p>'+nota+'</p>':'')});
  } catch(e) { Logger.log('Email cliente: '+e); }
}
function _notifyTecnico(id, tecnicoNombre, usuario) {
  try {
    const sh = _ss().getSheetByName(SH.U);
    if (!sh) return;
    const data = sh.getDataRange().getValues();
    const tecNorm = _norm(tecnicoNombre);
    let email = '';
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][3]||'').toLowerCase() !== 'tecnico') continue;
      const nm = _norm(String(data[i][4]||''));
      const un = _norm(String(data[i][1]||''));
      if (nm === tecNorm || tecNorm.includes(un) || nm.includes(un) || un.includes(nm.split(' ')[0])) {
        email = String(data[i][5]||'');
        break;
      }
    }
    if (email) {
      MailApp.sendEmail({to:email,
        subject:'🔧 Te asignaron el ticket ['+id+']',
        htmlBody:'<p>Hola '+tecnicoNombre+',</p>'
          +'<p>Se te asignó el ticket <b>'+id+'</b>.</p>'
          +'<p>Ingresa al portal para ver los detalles y registrar avances.</p>'});
    }
  } catch(e) { Logger.log('Email técnico: '+e); }
}

// ────────────────────────────────────────────────────────────────────────────
// TRIGGER — alertas diarias
// ────────────────────────────────────────────────────────────────────────────
function createTimeDrivenTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkUnaddressedTickets') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkUnaddressedTickets').timeBased().everyDays(1).atHour(9)
    .inTimezone(CONFIG.TIMEZONE).create();
  return 'Trigger creado: 9am diario';
}

function checkUnaddressedTickets() {
  try {
    const sheet = _ss().getSheetByName(SH.T);
    if (!sheet || sheet.getLastRow() <= 1) return;
    const data = sheet.getDataRange().getValues(), headers = data[0].map(h => String(h).trim());
    const cutoff = new Date(new Date().getTime() - 24*60*60*1000);
    const lista = data.slice(1).filter(row => {
      const t = {}; headers.forEach((h,i) => t[h] = row[i]);
      if (String(t.Estado) !== 'Nuevo') return false;
      const c = new Date(String(t.Fecha_Creacion).replace(' ','T'));
      return !isNaN(c) && c < cutoff;
    }).map(row => { const t={}; headers.forEach((h,i) => t[h]=String(row[i]||'')); return t; });
    if (!lista.length) return;
    MailApp.sendEmail({to:CONFIG.ADMIN_EMAILS,
      subject:'⏰ '+lista.length+' ticket(s) sin abordar — Just Burger',
      htmlBody:'<p><b>'+lista.length+' ticket(s)</b> sin respuesta +24h:</p><ul>'+
        lista.map(t=>'<li>['+t.Ticket_ID+'] '+t.Urgencia+' — '+t.Titulo+' ('+t.Sucursal+')</li>').join('')+'</ul>'});
  } catch(e) { Logger.log('checkUnaddressedTickets: '+e); }
}

function sendClientReminder(ticketId, titulo, sucursal, clientName) {
  try {
    MailApp.sendEmail({to:CONFIG.ADMIN_EMAILS,
      subject:'🔔 RECORDATORIO — ['+ticketId+'] '+titulo,
      htmlBody:'<p><b>'+(clientName||'El cliente')+'</b> solicita respuesta para:<br><b>['+ticketId+'] '+titulo+'</b><br>📍 '+sucursal+'</p>'});
    return {success:true};
  } catch(e) { return {success:false}; }
}

// ────────────────────────────────────────────────────────────────────────────
// SETUP & MIGRACIONES
// ────────────────────────────────────────────────────────────────────────────
// v2.2: Función principal de setup/migración para producción
function setupProduction() {
  const log = [];
  try {
    log.push('1. Verificando columnas...');
    const colReport = addMissingColumns();
    log.push('   ' + colReport);

    log.push('2. Verificando usuarios...');
    const users = getUsers();
    log.push('   Usuarios: ' + (users.users||[]).length);

    log.push('3. Verificando estructura...');
    verifySetup();

    log.push('4. Setup completo ✓');
    Logger.log(log.join('\n'));
    return {success:true, log: log.join('\n')};
  } catch(e) {
    log.push('ERROR: ' + e.toString());
    Logger.log(log.join('\n'));
    return {success:false, error:e.toString(), log:log.join('\n')};
  }
}

function setupAll() {
  const ss = _ss();
  _mkSheet(ss, SH.T, COLS_T);
  _mkSheet(ss, SH.H, COLS_H);
  _mkSheet(ss, SH.U, COLS_U);
  const sS = _mkSheet(ss, SH.S, COLS_S);
  if (sS.getLastRow() <= 1) [
    ['Tienda Mall Paseo Quilín','Santiago','Sí'],['Tienda Machalí','Rancagua','Sí'],
    ['Tienda Providencia','Santiago','Sí'],['Tienda Rotonda Atenas','Santiago','Sí'],
    ['Tienda Manuel Montt','Santiago','Sí'],['Tienda Toesca','Santiago','Sí'],
    ['Tienda Viña del Mar','Viña del Mar','Sí'],['Tienda Huechuraba','Santiago','Sí'],
    ['Tienda Villa Alemana','Villa Alemana','Sí'],['Tienda La Reina','Santiago','Sí'],
    ['Tienda Isidora','Santiago','Sí'],['Tienda Tranqueras','Santiago','Sí'],
    ['Tienda La Florida','Santiago','Sí']
  ].forEach(r => sS.appendRow(r));
  const tS = _mkSheet(ss, SH.TEC, COLS_TEC);
  if (tS.getLastRow() <= 1) [
    ['Carlos Méndez','Eléctrico','Sí'],['Marco Rojas','HVAC / Climatización','Sí'],
    ['Pedro Álvarez','Sanitario / Gasfitería','Sí'],['Rodrigo Torres','Civil / Obra','Sí'],
    ['Andrés Vega','Multidisciplinario','Sí'],['Jesús Pérez','Multidisciplinario','Sí']
  ].forEach(r => tS.appendRow(r));
  const cS = _mkSheet(ss, SH.CFG, COLS_CFG);
  if (cS.getLastRow() <= 1) [
    ['estado','Nuevo',1],['estado','En revisión',2],['estado','En ejecución',3],
    ['estado','Esperando aprobación',4],['estado','Bloqueado',5],
    ['estado','Resuelto',6],['estado','Cancelado',7],
    ['urgencia','Emergencia',1],['urgencia','Urgencia',2],
    ['urgencia','No urgente',3],['urgencia','Preventivo',4],
    ['categoria','Eléctrico',1],['categoria','HVAC / Climatización',2],
    ['categoria','Sanitario / Gasfitería',3],['categoria','Civil / Obra',4],
    ['categoria','Equipamiento Cocina',5],['categoria','Carpintería',6],
    ['categoria','Seguridad / CCTV',7],['categoria','Limpieza / Pintura',8],
    ['categoria','Otro',9]
  ].forEach(r => cS.appendRow(r));
  Logger.log('setupAll OK');
  return 'setupAll completado';
}

function addMissingColumns() {
  const ss = _ss();
  let report = [];
  // v2.2: incluir todas las hojas y columnas nuevas
  [[SH.T,COLS_T],[SH.H,COLS_H],[SH.U,COLS_U],[SH.S,COLS_S],[SH.TEC,COLS_TEC]].forEach(([name,cols]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = _mkSheet(ss, name, cols);
      report.push(name+': creada');
      return;
    }
    const ex = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(h=>String(h).trim());
    const miss = cols.filter(c => !ex.includes(c));
    if (miss.length) {
      miss.forEach(col => {
        const nc = sh.getLastColumn()+1;
        sh.getRange(1,nc).setValue(col)
          .setFontWeight('bold')
          .setBackground('#E52432')
          .setFontColor('#fff')
          .setFontSize(9);
      });
      report.push(name+': agregadas ['+miss.join(', ')+']');
    } else report.push(name+': OK');
  });
  SpreadsheetApp.flush(); // forzar escritura
  return report.join(' | ');
}

function verifySetup() {
  [[SH.T,COLS_T],[SH.H,COLS_H],[SH.S,COLS_S],[SH.TEC,COLS_TEC],[SH.CFG,COLS_CFG],[SH.U,COLS_U]]
    .forEach(([name, cols]) => {
      const sh = _ss().getSheetByName(name);
      if (!sh) { Logger.log('❌ '+name); return; }
      const ex = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(h=>String(h).trim()).filter(Boolean);
      const miss = cols.filter(c => !ex.includes(c));
      Logger.log((miss.length?'⚠️ ':'✅ ')+name+': '+(sh.getLastRow()-1)+' filas'+(miss.length?' | Faltan: '+miss.join(', '):''));
    });
}

function migrateHistorialColumn() {
  const sh = _ss().getSheetByName(SH.H);
  if (!sh) throw new Error('Hoja Historial no existe');
  if (sh.getLastRow() < 1) return {success:true, updated:0};
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  let parentColPos = headers.indexOf('Avance_Parent_ID') + 1;
  if (!parentColPos) {
    parentColPos = lastCol + 1;
    sh.getRange(1, parentColPos)
      .setValue('Avance_Parent_ID')
      .setFontWeight('bold').setBackground('#E52432').setFontColor('#fff').setFontSize(9);
  }
  const data = sh.getDataRange().getValues();
  const parentIdx = parentColPos - 1;
  const lastAvancePerTicket = {};
  const writes = [];
  const metaUpdates = [];
  for (let i = 1; i < data.length; i++) {
    const tid = String(data[i][0]||'');
    const ea  = String(data[i][2]||'');
    const nota = String(data[i][5]||'');
    const existingParent = String(data[i][parentIdx]||'');
    if (!tid) continue;
    if (existingParent) {
      if (ea === '[AVANCE]') lastAvancePerTicket[tid] = existingParent;
      continue;
    }
    let parentId = '';
    if (ea === '[AVANCE]') {
      let avId = '';
      let meta = null;
      try { meta = JSON.parse(nota); if (meta && meta.avanceId) avId = String(meta.avanceId); } catch(e) { meta = null; }
      if (!avId) {
        const tsRef = data[i][1];
        const tsMs  = tsRef instanceof Date ? tsRef.getTime() : (new Date(String(tsRef).replace(' ','T')).getTime() || Date.now());
        avId = 'av_' + tsMs + '_legacy' + i;
        if (meta) {
          meta.avanceId = avId;
          metaUpdates.push({ row: i+1, value: JSON.stringify(meta) });
        }
      }
      parentId = avId;
      lastAvancePerTicket[tid] = avId;
    } else if (ea.length > 0 && ea !== '[ITEM]') {
      parentId = lastAvancePerTicket[tid] || '';
    }
    if (parentId) writes.push({ row: i+1, value: parentId });
  }
  writes.forEach(w => sh.getRange(w.row, parentColPos).setValue(w.value));
  metaUpdates.forEach(m => sh.getRange(m.row, 6).setValue(m.value));
  return { success: true, updated: writes.length, metaUpdated: metaUpdates.length };
}

// ────────────────────────────────────────────────────────────────────────────
// MANTENIMIENTO DRIVE
// ────────────────────────────────────────────────────────────────────────────
function _extractFolderId(url) {
  if (!url) return '';
  const m = String(url).match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}
function _listAppFolders() {
  const out = [];
  try {
    const root = DriveApp.getFolderById(CONFIG.FOLDER_APP_ID);
    const iter = root.getFolders();
    while (iter.hasNext()) {
      const f = iter.next();
      let fileCount = 0;
      try { const fi = f.getFiles(); while (fi.hasNext()) { fi.next(); fileCount++; if (fileCount > 9999) break; } } catch(e) {}
      out.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), fileCount });
    }
  } catch(e) {}
  return out;
}
function _readTickets() {
  const sheet = _ss().getSheetByName(SH.T);
  if (!sheet || sheet.getLastRow() <= 1) return { headers:[], rows:[] };
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const tidIdx = headers.indexOf('Ticket_ID');
  const carpIdx = headers.indexOf('Carpeta_Drive');
  const rows = data.slice(1).map((r, i) => ({
    rowNum: i + 2,
    Ticket_ID: String(r[tidIdx]||'').trim(),
    Carpeta_Drive: String(r[carpIdx]||'').trim(),
    folderId: _extractFolderId(String(r[carpIdx]||''))
  }));
  return { headers, rows, tidIdx, carpIdx };
}

// ─── DIAGNÓSTICO: ejecutar en GAS console para verificar estructura de Usuarios ───
function auditUsersSheet() {
  const ss = _ss();
  const sh = ss.getSheetByName(SH.U);
  if (!sh) { Logger.log('ERROR: Hoja Usuarios no existe'); return; }
  const data    = sh.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const report  = [];
  report.push('=== AUDITORÍA HOJA USUARIOS ===');
  report.push('Columnas actuales: ' + headers.join(' | '));
  report.push('Columnas esperadas: ' + COLS_U.join(' | '));
  const missing  = COLS_U.filter(c => !headers.includes(c));
  const extra    = headers.filter(c => !COLS_U.includes(c));
  const mismatch = COLS_U.filter((c,i) => headers[i] !== c);
  if (missing.length)  report.push('FALTAN columnas: ' + missing.join(', '));
  if (extra.length)    report.push('COLUMNAS EXTRA: ' + extra.join(', '));
  if (mismatch.length) report.push('ORDEN DISTINTO: esperaba [' + mismatch.map((_,i)=>COLS_U[i]).join(', ') + '] en posiciones [' + mismatch.map((_,i)=>i+1).join(', ') + ']');
  if (!missing.length && !extra.length && !mismatch.length) report.push('✓ Estructura correcta');
  report.push('Total usuarios: ' + (data.length - 1));
  data.slice(1).forEach((r,i) => {
    const usrIdx = headers.indexOf('Username');
    const nomIdx = headers.indexOf('Nombre');
    const rolIdx = headers.indexOf('Role');
    const actIdx = headers.indexOf('Activo');
    report.push('  Usuario '+(i+1)+': '+String(r[usrIdx>=0?usrIdx:1]||'?')+' | Nombre: '+String(r[nomIdx>=0?nomIdx:4]||'?')+' | Rol: '+String(r[rolIdx>=0?rolIdx:3]||'?')+' | Activo: '+String(r[actIdx>=0?actIdx:7]||'?'));
  });
  const result = report.join('\n');
  Logger.log(result);
  return result;
}

// ─── REPARACIÓN: normaliza el orden de columnas del sheet Usuarios ───
function repairUsersSheet() {
  const ss = _ss();
  const sh = ss.getSheetByName(SH.U);
  if (!sh) { Logger.log('ERROR: Hoja Usuarios no existe'); return 'Error'; }
  const data = sh.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  // Verificar si necesita reparación
  const needsRepair = COLS_U.some((c,i) => headers[i] !== c);
  if (!needsRepair) { Logger.log('✓ Sheet ya está en orden correcto'); return 'OK'; }
  // Reordenar columnas: crear nuevo array de datos con COLS_U order
  const newData = data.map((row, ri) => {
    if (ri === 0) return COLS_U; // header row
    return COLS_U.map(col => {
      const idx = headers.indexOf(col);
      return idx >= 0 ? row[idx] : '';
    });
  });
  sh.clearContents();
  if (newData.length > 0) sh.getRange(1, 1, newData.length, newData[0].length).setValues(newData);
  // Re-apply headers formatting
  sh.getRange(1, 1, 1, COLS_U.length).setFontWeight('bold').setBackground('#E52432').setFontColor('#ffffff');
  SpreadsheetApp.flush();
  Logger.log('✓ Sheet reparado. Columnas ahora en orden correcto.');
  return 'Reparado';
}

function auditDriveAndTickets() {
  const { rows } = _readTickets();
  const folders = _listAppFolders();
  const idCounts = {};
  rows.forEach(r => { if (r.Ticket_ID) idCounts[r.Ticket_ID] = (idCounts[r.Ticket_ID]||0) + 1; });
  const duplicateIds = Object.keys(idCounts).filter(id => idCounts[id] > 1);
  const ticketsSinCarpeta = rows.filter(r => r.Ticket_ID && !r.folderId);
  const folderIdSet = new Set(folders.map(f => f.id));
  const ticketsCarpetaRota = rows.filter(r => r.folderId && !folderIdSet.has(r.folderId));
  const referencedFolderIds = new Set(rows.map(r => r.folderId).filter(Boolean));
  const carpetasHuerfanas = folders.filter(f => !referencedFolderIds.has(f.id));
  Logger.log('Tickets: '+rows.length+' | Carpetas: '+folders.length);
  Logger.log('Duplicados: '+duplicateIds.length+' | Sin carpeta: '+ticketsSinCarpeta.length);
  Logger.log('Carpeta rota: '+ticketsCarpetaRota.length+' | Huérfanas: '+carpetasHuerfanas.length);
  return {success:true, totals:{tickets:rows.length, folders:folders.length},
    duplicateIds, ticketsSinCarpeta:ticketsSinCarpeta.length,
    ticketsCarpetaRota:ticketsCarpetaRota.length, carpetasHuerfanas:carpetasHuerfanas.length};
}
