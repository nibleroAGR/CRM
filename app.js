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

    unsubscribes.push(userRef.collection('modules').onSnapshot(snap => {
        renderizarModulos(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }, err => showToast('Error cargando módulos', 'error')));

    unsubscribes.push(userRef.collection('links').onSnapshot(snap => {
        renderizarEnlaces(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }));

    unsubscribes.push(userRef.collection('tasks').onSnapshot(snap => {
        datosTareas = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarTareasCentral();
        actualizarAgenda();
    }));

    unsubscribes.push(userRef.collection('scheduled').onSnapshot(snap => {
        datosProgramadas = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarProgramadasCentral();
        actualizarAgenda();
    }));

    unsubscribes.push(userRef.collection('history').orderBy('fecha', 'desc').onSnapshot(snap => {
        renderizarHistorial(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }));
}

// ==========================
// FUNCIONES CRUD Y RENDER
// ==========================

// --- MÓDULOS ---
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
    } catch (error) {
        showToast('Error al crear módulo', 'error');
    }
});

function renderizarModulos(modulos) {
    const listaNav = document.getElementById('lista-modulos-dinamicos');
    const gridAjustes = document.getElementById('contenedor-modulos');
    if(!listaNav || !gridAjustes) return;
    
    listaNav.innerHTML = '';
    gridAjustes.innerHTML = '';

    modulos.forEach(mod => {
        if(mod.activo) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#"><i class="${mod.icon}"></i> ${mod.name}</a>`;
            li.onclick = () => verVista('vista-iframe', mod.url);
            listaNav.appendChild(li);
        }

        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-modulo';
        tarjeta.innerHTML = `
            <i class="${mod.icon}"></i>
            <h4 class="mb-10">${mod.name}</h4>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px;">
                <label class="switch">
                    <input type="checkbox" ${mod.activo ? 'checked' : ''} onchange="toggleModulo('${mod.id}', this.checked)">
                    <span class="slider"></span>
                </label>
                <button class="btn-icon" onclick="borrarModulo('${mod.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        gridAjustes.appendChild(tarjeta);
    });
}
window.toggleModulo = (id, activo) => db.collection('users').doc(currentUser.uid).collection('modules').doc(id).update({activo});
window.borrarModulo = (id) => { 
    if(confirm('¿Seguro que deseas borrar este módulo de forma permanente?')) {
        db.collection('users').doc(currentUser.uid).collection('modules').doc(id).delete()
            .then(() => showToast('Módulo eliminado', 'info'))
            .catch(() => showToast('Error al eliminar', 'error'));
    }
};

// --- ENLACES ---
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

function renderizarEnlaces(enlaces) {
    const listaIzq = document.getElementById('lista-enlaces-dinamicos');
    const contCentro = document.getElementById('contenedor-enlaces');
    if(!listaIzq || !contCentro) return;

    listaIzq.innerHTML = '';
    contCentro.innerHTML = '';

    enlaces.forEach(link => {
        listaIzq.innerHTML += `<a href="${link.url}" target="_blank"><i class="fa-solid fa-link"></i> ${link.name}</a>`;
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
}
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
