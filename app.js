// Usando Firebase v8 / Compat (cargado via CDN en index.html)
const firebaseConfig = {
    apiKey: "AIzaSyCqTyb7FvBVRZKAnB_7g8VMvONfI7QKWjE",
    authDomain: "crmv1-21322.firebaseapp.com",
    databaseURL: "https://crmv1-21322-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "crmv1-21322",
    storageBucket: "crmv1-21322.firebasestorage.app",
    messagingSenderId: "892438558015",
    appId: "1:892438558015:web:fccee492b12470628f8f8a",
    measurementId: "G-7BYG21GK2T"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variables globales
let currentUser = null;
let unsubscribes = [];
let tareaActiva = null;

// ==========================
// UTILIDADES (TOASTS Y FECHAS)
// ==========================

// Fecha en formato local YYYY-MM-DD sin problemas de zonas horarias
function getTodayString() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

// Sistema de Notificaciones Profesional
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if(type === 'success') icon = 'fa-check-circle';
    if(type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================
// AUTENTICACIÓN
// ==========================
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        
        const nameEl = document.getElementById('user-name');
        if(nameEl) nameEl.textContent = user.displayName || user.email.split('@')[0];
        
        showToast('Sesión iniciada correctamente', 'success');
        verVista('vista-tareas');
        iniciarListeners(user.uid);
    } else {
        currentUser = null;
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
        limpiarListeners();
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    
    auth.signInWithEmailAndPassword(email, pass).catch(err => {
        errorEl.textContent = "Credenciales inválidas o error de conexión.";
        showToast('Error de autenticación', 'error');
    });
});

document.getElementById('btn-google-login').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
        console.error(err);
        showToast('El inicio con Google requiere un servidor HTTP', 'error');
    });
});

document.getElementById('btn-logout').addEventListener('click', () => {
    auth.signOut().then(() => showToast('Sesión cerrada', 'info'));
});

// ==========================
// NAVEGACIÓN
// ==========================
function verVista(idVista, urlIframe = null) {
    document.querySelectorAll('.vista-modulo').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.side-nav li').forEach(li => li.classList.remove('active'));
    
    const vista = document.getElementById(idVista);
    if(vista) vista.classList.remove('hidden');
    
    const itemsMenu = document.querySelectorAll('.side-nav li');
    itemsMenu.forEach(li => {
        if(li.getAttribute('onclick') && li.getAttribute('onclick').includes(idVista)) {
            li.classList.add('active');
        }
    });

    const iframeApp = document.getElementById('iframe-app');
    if(iframeApp) {
        iframeApp.src = (idVista === 'vista-iframe' && urlIframe) ? urlIframe : "";
    }
}
window.verVista = verVista;

// ==========================
// LISTENERS (Tiempo Real)
// ==========================
function limpiarListeners() {
    unsubscribes.forEach(u => u());
    unsubscribes = [];
}

let datosTareas = [];
let datosProgramadas = [];

function iniciarListeners(uid) {
    limpiarListeners();
    const userRef = db.collection('users').doc(uid);

    // 1. Cargar preferencias (orden y fijos ocultos)
    unsubscribes.push(userRef.collection('settings').doc('prefs').onSnapshot(snap => {
        if(snap.exists) {
            userSettings = snap.data();
            if(!userSettings.moduleOrder) userSettings.moduleOrder = [];
            if(!userSettings.linkOrder) userSettings.linkOrder = [];
            if(!userSettings.hiddenFixed) userSettings.hiddenFixed = [];
        } else {
            userSettings = { moduleOrder: [], linkOrder: [], hiddenFixed: [] };
        }
        renderizarModulosCombinados();
        renderizarEnlacesCombinados();
    }));

    // 2. Módulos personalizados
    unsubscribes.push(userRef.collection('modules').onSnapshot(snap => {
        datosModulosPersonales = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarModulosCombinados();
    }, err => showToast('Error cargando módulos', 'error')));

    // 3. Enlaces
    unsubscribes.push(userRef.collection('links').onSnapshot(snap => {
        datosEnlaces = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarEnlacesCombinados();
    }));

    // 4. Tareas Diarias
    unsubscribes.push(userRef.collection('tasks').onSnapshot(snap => {
        datosTareas = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarTareasCentral();
        actualizarAgenda();
    }));

    // 5. Tareas Programadas
    unsubscribes.push(userRef.collection('scheduled').onSnapshot(snap => {
        datosProgramadas = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarProgramadasCentral();
        actualizarAgenda();
    }));

    // 6. Historial
    unsubscribes.push(userRef.collection('history').orderBy('fecha', 'desc').onSnapshot(snap => {
        renderizarHistorial(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }));

    // 7. Perfil de usuario (doc principal)
    unsubscribes.push(userRef.onSnapshot(snap => {
        if(snap.exists) {
            actualizarUIPerfil(snap.data(), auth.currentUser);
        } else {
            actualizarUIPerfil({}, auth.currentUser);
        }
    }));
}

// ==========================
// PERFIL DE USUARIO
// ==========================
let currentAvatarBase64 = null;

function actualizarUIPerfil(data, user) {
    if(!user) return;
    const nameEl = document.getElementById('user-name');
    const avatarTopbar = document.getElementById('topbar-avatar');
    
    let nombre = user.displayName || data.nombre || user.email.split('@')[0];
    if(nameEl) nameEl.textContent = nombre;
    
    let fotoUrl = data.fotoBase64 || user.photoURL || null;
    const previewPerfil = document.getElementById('perfil-avatar-preview');
    
    if(fotoUrl) {
        if(avatarTopbar) avatarTopbar.innerHTML = `<img src="${fotoUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        if(previewPerfil) previewPerfil.innerHTML = `<img src="${fotoUrl}">`;
        currentAvatarBase64 = data.fotoBase64 || null; 
    } else {
        if(avatarTopbar) avatarTopbar.innerHTML = `<i class="fa-solid fa-user"></i>`;
        if(previewPerfil) previewPerfil.innerHTML = `<i class="fa-solid fa-user"></i>`;
        currentAvatarBase64 = null;
    }

    const inputNombre = document.getElementById('perfil-nombre');
    if(inputNombre && inputNombre.value === '') inputNombre.value = nombre;
    
    const inputTel = document.getElementById('perfil-telefono');
    if(inputTel && inputTel.value === '') inputTel.value = data.telefono || '';
    
    const inputExt = document.getElementById('perfil-ext');
    if(inputExt && inputExt.value === '') inputExt.value = data.ext || '';
    
    const inputPres = document.getElementById('perfil-presentacion');
    if(inputPres && inputPres.value === '') inputPres.value = data.presentacion || '';
}

const formPerfil = document.getElementById('form-perfil');
if(formPerfil) {
    formPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentUser) return;
        
        const nuevoNombre = document.getElementById('perfil-nombre').value.trim();
        const tel = document.getElementById('perfil-telefono').value.trim();
        const ext = document.getElementById('perfil-ext').value.trim();
        const pres = document.getElementById('perfil-presentacion').value.trim();
        
        try {
            await currentUser.updateProfile({ displayName: nuevoNombre });
            
            await db.collection('users').doc(currentUser.uid).set({
                nombre: nuevoNombre,
                telefono: tel,
                ext: ext,
                presentacion: pres,
                fotoBase64: currentAvatarBase64
            }, { merge: true });
            
            showToast('Perfil actualizado correctamente', 'success');
        } catch(err) {
            console.error(err);
            showToast('Error al actualizar el perfil', 'error');
        }
    });
}

const fileInput = document.getElementById('perfil-foto-input');
if(fileInput) {
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const maxSize = 200;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                currentAvatarBase64 = dataUrl;
                document.getElementById('perfil-avatar-preview').innerHTML = `<img src="${dataUrl}">`;
            }
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

window.eliminarFotoPerfil = () => {
    currentAvatarBase64 = null;
    document.getElementById('perfil-avatar-preview').innerHTML = `<i class="fa-solid fa-user"></i>`;
    const fileInput = document.getElementById('perfil-foto-input');
    if(fileInput) fileInput.value = "";
    
    if(currentUser) {
        db.collection('users').doc(currentUser.uid).set({ fotoBase64: null }, { merge: true });
        showToast('Foto eliminada. Guarda el perfil para confirmar.', 'info');
    }
};

const formPassword = document.getElementById('form-password');
if(formPassword) {
    formPassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentUser) return;
        
        const p1 = document.getElementById('perfil-pass-new').value;
        const p2 = document.getElementById('perfil-pass-confirm').value;
        
        if(p1 !== p2) {
            return showToast('Las contraseñas no coinciden', 'warning');
        }
        
        try {
            await currentUser.updatePassword(p1);
            showToast('Contraseña actualizada con éxito', 'success');
            e.target.reset();
        } catch(err) {
            if(err.code === 'auth/requires-recent-login') {
                showToast('Por seguridad, cierra sesión y vuelve a entrar antes de cambiar tu contraseña', 'error');
            } else {
                console.error(err);
                showToast('Error: ' + err.message, 'error');
            }
        }
    });
}

// ==========================
// FUNCIONES CRUD Y RENDER
// ==========================

// ==========================
// BUSCADOR DE ICONOS
// ==========================
const iconosDisponibles = [
    // Oficina / Trabajo
    { class: "fa-solid fa-briefcase", tags: ["oficina", "trabajo", "maletin", "maletín", "negocios"] },
    { class: "fa-solid fa-file-invoice", tags: ["factura", "documento", "archivo", "papel"] },
    { class: "fa-solid fa-folder", tags: ["carpeta", "directorio", "archivos"] },
    { class: "fa-solid fa-folder-open", tags: ["carpeta", "abierta", "directorio"] },
    { class: "fa-solid fa-paperclip", tags: ["clip", "adjunto", "archivo"] },
    { class: "fa-solid fa-pen", tags: ["lapiz", "lápiz", "boligrafo", "escribir", "editar"] },
    { class: "fa-solid fa-print", tags: ["impresora", "imprimir", "papel"] },
    { class: "fa-solid fa-calculator", tags: ["calculadora", "cuentas", "matematicas", "numeros"] },
    { class: "fa-solid fa-calendar", tags: ["calendario", "fecha", "dia", "evento"] },
    { class: "fa-solid fa-clipboard", tags: ["portapapeles", "notas", "copiar"] },
    { class: "fa-solid fa-clipboard-list", tags: ["tareas", "lista", "check"] },
    { class: "fa-solid fa-book", tags: ["libro", "leer", "manual", "documentacion"] },
    { class: "fa-solid fa-building", tags: ["edificio", "empresa", "construccion"] },
    { class: "fa-solid fa-city", tags: ["ciudad", "urbano", "edificios"] },
    { class: "fa-solid fa-industry", tags: ["industria", "fabrica", "produccion"] },
    
    // Usuarios / Clientes
    { class: "fa-solid fa-user", tags: ["usuario", "persona", "perfil", "cliente"] },
    { class: "fa-solid fa-users", tags: ["usuarios", "personas", "equipo", "clientes", "grupo"] },
    { class: "fa-solid fa-user-tie", tags: ["jefe", "gerente", "profesional", "ejecutivo"] },
    { class: "fa-solid fa-address-book", tags: ["contactos", "agenda", "directorio"] },
    { class: "fa-solid fa-address-card", tags: ["tarjeta", "identificacion", "dni"] },
    { class: "fa-solid fa-handshake", tags: ["acuerdo", "trato", "apreton", "manos", "socios"] },

    // Comunicaciones / Internet
    { class: "fa-solid fa-envelope", tags: ["correo", "email", "mensaje", "carta"] },
    { class: "fa-solid fa-phone", tags: ["telefono", "llamar", "contacto"] },
    { class: "fa-solid fa-mobile-screen", tags: ["movil", "celular", "smartphone"] },
    { class: "fa-solid fa-laptop", tags: ["portatil", "ordenador", "computadora"] },
    { class: "fa-solid fa-desktop", tags: ["pantalla", "pc", "ordenador", "monitor"] },
    { class: "fa-solid fa-globe", tags: ["internet", "web", "mundo", "global"] },
    { class: "fa-solid fa-wifi", tags: ["wifi", "conexion", "internet", "red"] },
    { class: "fa-solid fa-cloud", tags: ["nube", "almacenamiento", "online"] },
    { class: "fa-solid fa-server", tags: ["servidor", "hosting", "datos"] },

    // Herramientas / Ajustes
    { class: "fa-solid fa-gear", tags: ["ajustes", "configuracion", "engranaje", "opciones"] },
    { class: "fa-solid fa-screwdriver-wrench", tags: ["herramientas", "llave", "mantenimiento", "reparacion"] },
    { class: "fa-solid fa-hammer", tags: ["martillo", "construccion", "golpe"] },
    { class: "fa-solid fa-key", tags: ["llave", "acceso", "seguridad"] },
    { class: "fa-solid fa-lock", tags: ["candado", "bloqueo", "seguridad", "privado"] },
    { class: "fa-solid fa-shield-halved", tags: ["escudo", "proteccion", "antivirus"] },

    // Finanzas
    { class: "fa-solid fa-money-bill", tags: ["dinero", "billete", "pago", "efectivo"] },
    { class: "fa-solid fa-coins", tags: ["monedas", "suelto", "dinero", "ahorro"] },
    { class: "fa-solid fa-credit-card", tags: ["tarjeta", "credito", "pago", "banco"] },
    { class: "fa-solid fa-wallet", tags: ["cartera", "billetera", "dinero"] },
    { class: "fa-solid fa-chart-line", tags: ["grafica", "crecimiento", "estadisticas", "ventas"] },
    { class: "fa-solid fa-chart-pie", tags: ["grafica", "pastel", "porcentaje", "estadisticas"] },
    { class: "fa-solid fa-percent", tags: ["porcentaje", "descuento", "oferta", "impuesto"] },
    { class: "fa-solid fa-piggy-bank", tags: ["hucha", "ahorro", "cerdito", "banco"] },

    // Transportes
    { class: "fa-solid fa-car", tags: ["coche", "auto", "vehiculo", "transporte"] },
    { class: "fa-solid fa-truck", tags: ["camion", "furgoneta", "reparto", "transporte", "logistica"] },
    { class: "fa-solid fa-plane", tags: ["avion", "vuelo", "viaje", "aeropuerto"] },
    { class: "fa-solid fa-ship", tags: ["barco", "buque", "mar", "envio"] },
    { class: "fa-solid fa-motorcycle", tags: ["moto", "motocicleta", "reparto"] },

    // Varios / Interfaz
    { class: "fa-solid fa-bell", tags: ["campana", "notificacion", "aviso", "alerta"] },
    { class: "fa-solid fa-bookmark", tags: ["marcador", "guardado", "favorito"] },
    { class: "fa-solid fa-star", tags: ["estrella", "favorito", "destacado", "puntuacion"] },
    { class: "fa-solid fa-heart", tags: ["corazon", "me gusta", "favorito", "amor"] },
    { class: "fa-solid fa-thumbs-up", tags: ["pulgar", "ok", "bien", "aprobado"] },
    { class: "fa-solid fa-circle-check", tags: ["check", "correcto", "completado", "hecho"] },
    { class: "fa-solid fa-magnifying-glass", tags: ["lupa", "buscar", "busqueda"] },
    { class: "fa-solid fa-location-dot", tags: ["ubicacion", "mapa", "pin", "lugar"] },
    { class: "fa-solid fa-map", tags: ["mapa", "plano", "ruta", "geografia"] }
];

function renderizarBuscadorIconos() {
    const grid = document.getElementById('icon-grid');
    const searchInput = document.getElementById('search-icon');
    const dropdown = document.getElementById('icon-dropdown');
    const btnToggle = document.getElementById('btn-icon-picker');
    
    if(!grid || !searchInput || !dropdown || !btnToggle) return;

    function renderGrid(filtro = '') {
        grid.innerHTML = '';
        const lowerFilter = filtro.toLowerCase();
        iconosDisponibles.forEach(iconoObj => {
            const iconoClase = iconoObj.class;
            // Busca si alguna etiqueta o el nombre de la clase incluye el filtro
            const coincide = iconoObj.tags.some(tag => tag.includes(lowerFilter)) || iconoClase.toLowerCase().includes(lowerFilter);
            
            if(coincide) {
                const iconDiv = document.createElement('div');
                iconDiv.className = 'icon-picker-item';
                iconDiv.innerHTML = `<i class="${iconoClase}" title="${iconoObj.tags.join(', ')}"></i>`;
                iconDiv.onclick = () => {
                    document.getElementById('selected-icon-preview').className = iconoClase;
                    document.getElementById('selected-icon-text').textContent = iconoObj.tags[0].charAt(0).toUpperCase() + iconoObj.tags[0].slice(1);
                    document.getElementById('modulo-icono').value = iconoClase;
                    dropdown.classList.add('hidden');
                };
                grid.appendChild(iconDiv);
            }
        });
    }

    btnToggle.onclick = () => {
        dropdown.classList.toggle('hidden');
        if(!dropdown.classList.contains('hidden')) {
            renderGrid();
            searchInput.focus();
        }
    };

    searchInput.addEventListener('input', (e) => {
        renderGrid(e.target.value);
    });

    // Cerrar si se hace clic fuera
    document.addEventListener('click', (e) => {
        if(!e.target.closest('.icon-picker-container')) {
            dropdown.classList.add('hidden');
        }
    });
}
// Inicializar buscador una vez al cargar
document.addEventListener('DOMContentLoaded', renderizarBuscadorIconos);


// ==========================
// CONFIGURACIÓN Y MÓDULOS UNIFICADOS
// ==========================
const modulosFijos = [
    { id: 'fijo_tareas', name: 'Tareas', icon: 'fa-solid fa-list-check', vista: 'vista-tareas', isFixed: true },
    { id: 'fijo_programadas', name: 'Programadas', icon: 'fa-regular fa-calendar-days', vista: 'vista-programadas', isFixed: true },
    { id: 'fijo_historial', name: 'Historial', icon: 'fa-solid fa-clock-rotate-left', vista: 'vista-historial', isFixed: true },
    { id: 'fijo_enlaces', name: 'Enlaces', icon: 'fa-solid fa-link', vista: 'vista-enlaces', isFixed: true }
];

let userSettings = { moduleOrder: [], linkOrder: [], hiddenFixed: [] };
let datosModulosPersonales = [];
let datosEnlaces = [];
let sortableModules = null;
let sortableLinks = null;

function guardarSettings() {
    if(currentUser) db.collection('users').doc(currentUser.uid).collection('settings').doc('prefs').set(userSettings);
}

// Inicializar Drag & Drop
function inicializarSortable() {
    const listaModulos = document.getElementById('lista-modulos-dinamicos');
    const listaEnlaces = document.getElementById('lista-enlaces-dinamicos');

    if(listaModulos && !sortableModules) {
        sortableModules = new Sortable(listaModulos, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: () => {
                const newOrder = Array.from(listaModulos.children).map(li => li.dataset.id);
                userSettings.moduleOrder = newOrder;
                guardarSettings();
            }
        });
    }

    if(listaEnlaces && !sortableLinks) {
        sortableLinks = new Sortable(listaEnlaces, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: () => {
                const newOrder = Array.from(listaEnlaces.children).map(el => el.dataset.id);
                userSettings.linkOrder = newOrder;
                guardarSettings();
            }
        });
    }
}

// Unificar y renderizar módulos en el sidebar y en ajustes
function renderizarModulosCombinados() {
    const listaNav = document.getElementById('lista-modulos-dinamicos');
    const gridAjustes = document.getElementById('contenedor-modulos');
    if(!listaNav || !gridAjustes) return;
    
    listaNav.innerHTML = '';
    gridAjustes.innerHTML = '';

    // Combinar fijos y personales
    let combinados = [...modulosFijos, ...datosModulosPersonales];

    // Ordenar según moduleOrder
    if(userSettings.moduleOrder && userSettings.moduleOrder.length > 0) {
        combinados.sort((a, b) => {
            let indexA = userSettings.moduleOrder.indexOf(a.id);
            let indexB = userSettings.moduleOrder.indexOf(b.id);
            if(indexA === -1) indexA = 999;
            if(indexB === -1) indexB = 999;
            return indexA - indexB;
        });
    }

    combinados.forEach(mod => {
        // Determinar si está activo (Fijos usan hiddenFixed, Personales usan mod.activo)
        let isActivo = mod.isFixed ? !userSettings.hiddenFixed.includes(mod.id) : mod.activo;

        // Renderizar en el sidebar si está activo
        if(isActivo) {
            // Lógica especial para 'fijo_enlaces': si se desactiva, se oculta del sidebar pero los enlaces persisten.
            const li = document.createElement('li');
            li.dataset.id = mod.id;
            li.innerHTML = `<a href="#"><i class="${mod.icon}"></i> ${mod.name}</a>`;
            li.onclick = () => {
                if(mod.isFixed) verVista(mod.vista);
                else verVista('vista-iframe', mod.url);
            };
            listaNav.appendChild(li);
        }

        // Lógica de Enlaces ocultos controlada desde otro lado si es necesario

        // Renderizar en Ajustes
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-modulo';
        let botonBasura = mod.isFixed ? '' : `<button class="btn-icon" onclick="borrarModulo('${mod.id}')"><i class="fa-solid fa-trash"></i></button>`;
        tarjeta.innerHTML = `
            <div class="tarjeta-modulo-info">
                <i class="${mod.icon}"></i>
                <h4>${mod.name}</h4>
            </div>
            <div class="tarjeta-modulo-acciones">
                ${botonBasura}
                <label class="switch">
                    <input type="checkbox" ${isActivo ? 'checked' : ''} onchange="toggleModuloGral('${mod.id}', this.checked, ${mod.isFixed})">
                    <span class="slider"></span>
                </label>
            </div>
        `;
        gridAjustes.appendChild(tarjeta);
    });

    inicializarSortable();
}

window.toggleModuloGral = (id, activo, isFixed) => {
    if(isFixed) {
        if(activo) {
            userSettings.hiddenFixed = userSettings.hiddenFixed.filter(fid => fid !== id);
        } else {
            if(!userSettings.hiddenFixed.includes(id)) userSettings.hiddenFixed.push(id);
        }
        guardarSettings();
        renderizarModulosCombinados(); // Actualización optimista
    } else {
        db.collection('users').doc(currentUser.uid).collection('modules').doc(id).update({activo});
    }
};

window.borrarModulo = (id) => { 
    if(confirm('¿Seguro que deseas borrar este módulo de forma permanente?')) {
        db.collection('users').doc(currentUser.uid).collection('modules').doc(id).delete()
            .then(() => showToast('Módulo eliminado', 'info'))
            .catch(() => showToast('Error al eliminar', 'error'));
    }
};

document.getElementById('form-modulo').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return;
    try {
        const data = {
            icon: document.getElementById('modulo-icono').value,
            name: document.getElementById('modulo-nombre').value.trim(),
            url: document.getElementById('modulo-url').value.trim(),
            activo: true
        };
        if(!data.name || !data.url) return showToast('Completa todos los campos', 'warning');
        
        await db.collection('users').doc(currentUser.uid).collection('modules').add(data);
        showToast('Módulo creado', 'success');
        e.target.reset();
        document.getElementById('selected-icon-preview').className = 'fa-solid fa-icons';
        document.getElementById('selected-icon-text').textContent = 'Icono...';
    } catch (error) {
        showToast('Error al crear módulo', 'error');
    }
});

// --- ENLACES ---
function renderizarEnlacesCombinados() {
    const listaIzq = document.getElementById('lista-enlaces-dinamicos');
    const contCentro = document.getElementById('contenedor-enlaces');
    if(!listaIzq || !contCentro) return;

    listaIzq.innerHTML = '';
    contCentro.innerHTML = '';

    let ordenados = [...datosEnlaces];
    if(userSettings.linkOrder && userSettings.linkOrder.length > 0) {
        ordenados.sort((a, b) => {
            let indexA = userSettings.linkOrder.indexOf(a.id);
            let indexB = userSettings.linkOrder.indexOf(b.id);
            if(indexA === -1) indexA = 999;
            if(indexB === -1) indexB = 999;
            return indexA - indexB;
        });
    }

    ordenados.forEach(link => {
        // Para sidebar
        const aSidebar = document.createElement('a');
        aSidebar.href = link.url;
        aSidebar.target = "_blank";
        aSidebar.dataset.id = link.id;
        aSidebar.innerHTML = `<i class="fa-solid fa-link"></i> ${link.name}`;
        listaIzq.appendChild(aSidebar);

        // Para vista central
        contCentro.innerHTML += `
            <div class="fila-item">
                <div>
                    <h4>${link.name}</h4>
                    <a href="${link.url}" target="_blank" class="text-sm text-info" style="text-decoration:none;">${link.url}</a>
                </div>
                <button class="btn btn-danger btn-sm" onclick="borrarEnlace('${link.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
    inicializarSortable();
}

document.getElementById('form-enlace').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const data = {
            name: document.getElementById('enlace-nombre').value.trim(),
            url: document.getElementById('enlace-url').value.trim()
        };
        await db.collection('users').doc(currentUser.uid).collection('links').add(data);
        showToast('Enlace guardado', 'success');
        e.target.reset();
    } catch(err) { showToast('Error guardando enlace', 'error'); }
});

window.borrarEnlace = (id) => { 
    if(confirm('¿Borrar enlace?')) db.collection('users').doc(currentUser.uid).collection('links').doc(id).delete(); 
};


// --- TAREAS DIARIAS ---
document.getElementById('form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return showToast('Error: Usuario no autenticado', 'error');
    
    try {
        const data = {
            name: document.getElementById('tarea-nombre').value.trim(),
            time: document.getElementById('tarea-hora').value || '00:00',
            lastCompleted: null,
            observaciones: [],
            tipo: 'diaria'
        };
        await db.collection('users').doc(currentUser.uid).collection('tasks').add(data);
        showToast('Tarea diaria añadida', 'success');
        e.target.reset();
    } catch (err) {
        console.error("Error añadiendo tarea:", err);
        showToast('Error: ' + err.message, 'error');
    }
});

function renderizarTareasCentral() {
    const cont = document.getElementById('contenedor-tareas');
    if(!cont) return;
    cont.innerHTML = '';
    datosTareas.forEach(t => {
        cont.innerHTML += `
            <div class="fila-item">
                <div>
                    <h4>${t.name}</h4>
                    <p class="text-sm text-muted"><i class="fa-regular fa-clock"></i> ${t.time}</p>
                </div>
                <button class="btn btn-danger btn-sm" onclick="borrarTarea('${t.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
}
window.borrarTarea = (id) => { 
    if(confirm('¿Borrar tarea diaria permanentemente?')) db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).delete(); 
};

// --- PROGRAMADAS ---
document.getElementById('form-programada').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return showToast('Error: Usuario no autenticado', 'error');

    try {
        const data = {
            name: document.getElementById('prog-nombre').value.trim(),
            date: document.getElementById('prog-fecha').value,
            time: document.getElementById('prog-hora').value || '00:00',
            observaciones: [],
            tipo: 'programada'
        };
        await db.collection('users').doc(currentUser.uid).collection('scheduled').add(data);
        showToast('Tarea programada añadida', 'success');
        e.target.reset();
    } catch (err) {
        console.error("Error añadiendo programada:", err);
        showToast('Error: ' + err.message, 'error');
    }
});

function renderizarProgramadasCentral() {
    const cont = document.getElementById('contenedor-programadas');
    if(!cont) return;
    cont.innerHTML = '';
    datosProgramadas.forEach(p => {
        cont.innerHTML += `
            <div class="fila-item">
                <div>
                    <h4>${p.name}</h4>
                    <p class="text-sm text-muted"><i class="fa-regular fa-calendar"></i> ${p.date} &nbsp; <i class="fa-regular fa-clock"></i> ${p.time}</p>
                </div>
                <button class="btn btn-danger btn-sm" onclick="borrarProg('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
}
window.borrarProg = (id) => { 
    if(confirm('¿Borrar programada?')) db.collection('users').doc(currentUser.uid).collection('scheduled').doc(id).delete(); 
};

// --- HISTORIAL ---
function renderizarHistorial(hist) {
    const cont = document.getElementById('contenedor-historial');
    if(!cont) return;
    cont.innerHTML = '';
    hist.forEach(h => {
        const fechaFormat = h.fecha ? new Date(h.fecha.toMillis()).toLocaleString() : '';
        const badge = h.tipo === 'diaria' ? 'Diaria' : 'Prog.';
        let obsHtml = '';
        if(h.observaciones && h.observaciones.length > 0) {
            obsHtml = '<div style="margin-top:12px; font-size:0.85rem; color:var(--text-secondary); background: rgba(0,0,0,0.2); padding:10px; border-radius:6px; border-left:2px solid var(--accent-primary);"><strong>Seguimiento:</strong><ul style="padding-left:20px; margin-top:5px;">';
            h.observaciones.forEach(o => obsHtml += `<li style="margin-bottom:4px;">[${o.fecha}] ${o.texto}</li>`);
            obsHtml += '</ul></div>';
        }
        cont.innerHTML += `
            <div class="fila-item" style="flex-direction:column; align-items:flex-start;">
                <div class="w-100 flex-row" style="justify-content:space-between">
                    <h4>${h.name} <span style="font-size:0.75rem; font-weight:700; background:var(--accent-gradient); color:white; padding:3px 8px; border-radius:12px; margin-left:8px;">${badge}</span></h4>
                    <span class="text-sm text-success" style="font-weight:600;"><i class="fa-solid fa-check-double"></i> ${fechaFormat}</span>
                </div>
                ${obsHtml}
            </div>
        `;
    });
}

// ==========================
// AGENDA (DERECHA) Y MODAL
// ==========================
function actualizarAgenda() {
    const cont = document.getElementById('agenda-contenedor');
    if(!cont) return;
    cont.innerHTML = '';
    
    const hoyStr = getTodayString();
    let itemsAgenda = [];

    datosTareas.forEach(t => {
        if(t.lastCompleted !== hoyStr) {
            itemsAgenda.push({ ...t, fOrden: hoyStr, esDiaria: true });
        }
    });

    datosProgramadas.forEach(p => {
        itemsAgenda.push({ ...p, fOrden: p.date, esDiaria: false });
    });

    // Ordenar cronológicamente de forma segura
    itemsAgenda.sort((a, b) => {
        const fA = a.fOrden || '';
        const fB = b.fOrden || '';
        if(fA === fB) {
            const tA = a.time || '';
            const tB = b.time || '';
            return tA.localeCompare(tB);
        }
        return fA.localeCompare(fB);
    });

    // Agrupar por día
    const grupos = {};
    itemsAgenda.forEach(item => {
        if(!grupos[item.fOrden]) grupos[item.fOrden] = [];
        grupos[item.fOrden].push(item);
    });

    // Renderizar grupos
    for(const [fecha, items] of Object.entries(grupos)) {
        let etiquetaFecha = fecha === hoyStr ? "Hoy" : fecha;
        const divGrupo = document.createElement('div');
        divGrupo.className = 'agenda-dia';
        divGrupo.innerHTML = `<h4><i class="fa-regular fa-calendar-days"></i> ${etiquetaFecha}</h4>`;

        items.forEach(item => {
            const clase = item.esDiaria ? 'diaria' : 'prog';
            const card = document.createElement('div');
            card.className = `tarea-tarjeta ${clase}`;
            card.innerHTML = `<strong>${item.name}</strong> <span>${item.time}</span>`;
            
            card.onclick = function() { abrirModal(item); };
            divGrupo.appendChild(card);
        });
        cont.appendChild(divGrupo);
    }

    if(itemsAgenda.length === 0) {
        cont.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; opacity: 0.5;">
                <i class="fa-solid fa-check-circle" style="font-size:3rem; color:var(--success); margin-bottom:15px;"></i>
                <p>No hay tareas pendientes.</p>
                <p class="text-sm">¡Buen trabajo!</p>
            </div>
        `;
    }
}

// --- LÓGICA MODAL ---
function abrirModal(tarea) {
    tareaActiva = tarea;
    document.getElementById('modal-titulo').textContent = tarea.name;
    document.getElementById('modal-observacion').value = '';
    document.getElementById('zona-reprogramar').classList.add('hidden');
    
    const contObs = document.getElementById('modal-historial-obs');
    contObs.innerHTML = '';
    if(tarea.observaciones && tarea.observaciones.length > 0) {
        tarea.observaciones.forEach(o => {
            contObs.innerHTML += `<div class="obs-linea"><span class="text-muted text-sm" style="font-weight:600;"><i class="fa-regular fa-clock"></i> ${o.fecha}</span><br>${o.texto}</div>`;
        });
    }

    document.getElementById('repro-fecha').value = tarea.fOrden;
    document.getElementById('repro-hora').value = tarea.time;

    document.getElementById('modal-tarea').classList.remove('hidden');
}

window.cerrarModal = () => {
    document.getElementById('modal-tarea').classList.add('hidden');
    tareaActiva = null;
};

window.mostrarReprogramar = () => {
    document.getElementById('zona-reprogramar').classList.toggle('hidden');
};

window.guardarReprogramacion = async () => {
    if(!tareaActiva) return;
    const nf = document.getElementById('repro-fecha').value;
    const nh = document.getElementById('repro-hora').value;
    const obsVal = document.getElementById('modal-observacion').value.trim();

    let arrObs = tareaActiva.observaciones || [];
    let textoAgregado = `Reprogramado a ${nf} ${nh}`;
    if(obsVal) textoAgregado += `: ${obsVal}`;
    
    arrObs.push({ fecha: new Date().toLocaleString(), texto: textoAgregado });

    const docRef = db.collection('users').doc(currentUser.uid).collection(tareaActiva.esDiaria ? 'tasks' : 'scheduled').doc(tareaActiva.id);
    
    try {
        if(tareaActiva.esDiaria) {
            await docRef.update({ time: nh, observaciones: arrObs });
        } else {
            await docRef.update({ date: nf, time: nh, observaciones: arrObs });
        }
        showToast('Tarea reprogramada con éxito', 'info');
    } catch(e) {
        showToast('Error al reprogramar', 'error');
    }

    cerrarModal();
};

window.concluirTarea = async () => {
    if(!tareaActiva) return;
    const hoyStr = getTodayString();
    const obsVal = document.getElementById('modal-observacion').value.trim();
    
    let arrObs = tareaActiva.observaciones || [];
    if(obsVal) arrObs.push({ fecha: new Date().toLocaleString(), texto: obsVal });

    try {
        // Enviar a historial
        await db.collection('users').doc(currentUser.uid).collection('history').add({
            name: tareaActiva.name,
            tipo: tareaActiva.tipo,
            observaciones: arrObs,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });

        const docRef = db.collection('users').doc(currentUser.uid).collection(tareaActiva.esDiaria ? 'tasks' : 'scheduled').doc(tareaActiva.id);

        if(tareaActiva.esDiaria) {
            await docRef.update({ lastCompleted: hoyStr, observaciones: [] });
        } else {
            await docRef.delete();
        }
        
        showToast('¡Tarea concluida y enviada al historial!', 'success');
    } catch(e) {
        showToast('Error al concluir tarea', 'error');
    }

    cerrarModal();
};
