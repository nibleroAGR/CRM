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

// Inicializar
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variables globales
let currentUser = null;
let unsubscribes = [];
let tareaActiva = null;

// ==========================
// AUTENTICACIÓN
// ==========================
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('user-name').textContent = user.displayName || user.email.split('@')[0];
        verVista('vista-tareas'); // Vista por defecto
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
    auth.signInWithEmailAndPassword(email, pass).catch(err => {
        document.getElementById('auth-error').textContent = "Credenciales inválidas.";
    });
});

document.getElementById('btn-google-login').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => console.error(err));
});

document.getElementById('btn-logout').addEventListener('click', () => {
    auth.signOut();
});

// ==========================
// NAVEGACIÓN
// ==========================
function verVista(idVista, urlIframe = null) {
    // Ocultar todas las vistas
    document.querySelectorAll('.vista-modulo').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.side-nav li').forEach(li => li.classList.remove('active'));
    
    // Mostrar objetivo
    const vista = document.getElementById(idVista);
    if(vista) vista.classList.remove('hidden');
    
    // Marcar menú activo (esto es un poco manual por la estructura onClick en HTML)
    const itemsMenu = document.querySelectorAll('.side-nav li');
    itemsMenu.forEach(li => {
        if(li.getAttribute('onclick') && li.getAttribute('onclick').includes(idVista)) {
            li.classList.add('active');
        }
    });

    if (idVista === 'vista-iframe' && urlIframe) {
        document.getElementById('iframe-app').src = urlIframe;
    } else {
        document.getElementById('iframe-app').src = "";
    }
}

window.verVista = verVista; // Hacerlo global para los onclick de HTML

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

    // 1. Módulos Personalizados
    unsubscribes.push(userRef.collection('modules').onSnapshot(snap => {
        const modulos = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarModulos(modulos);
    }));

    // 2. Enlaces
    unsubscribes.push(userRef.collection('links').onSnapshot(snap => {
        const enlaces = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarEnlaces(enlaces);
    }));

    // 3. Tareas Diarias
    unsubscribes.push(userRef.collection('tasks').onSnapshot(snap => {
        datosTareas = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarTareasCentral();
        actualizarAgenda();
    }));

    // 4. Programadas
    unsubscribes.push(userRef.collection('scheduled').onSnapshot(snap => {
        datosProgramadas = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarProgramadasCentral();
        actualizarAgenda();
    }));

    // 5. Historial
    unsubscribes.push(userRef.collection('history').orderBy('fecha', 'desc').onSnapshot(snap => {
        const hist = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderizarHistorial(hist);
    }));
}

// ==========================
// FUNCIONES CRUD Y RENDER
// ==========================

// --- MÓDULOS ---
document.getElementById('form-modulo').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!currentUser) return;
    const data = {
        icon: document.getElementById('modulo-icono').value,
        name: document.getElementById('modulo-nombre').value,
        url: document.getElementById('modulo-url').value,
        activo: true
    };
    db.collection('users').doc(currentUser.uid).collection('modules').add(data);
    e.target.reset();
});

function renderizarModulos(modulos) {
    const listaNav = document.getElementById('lista-modulos-dinamicos');
    const gridAjustes = document.getElementById('contenedor-modulos');
    listaNav.innerHTML = '';
    gridAjustes.innerHTML = '';

    modulos.forEach(mod => {
        // En el menú izquierdo
        if(mod.activo) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#"><i class="${mod.icon}"></i> ${mod.name}</a>`;
            li.onclick = () => verVista('vista-iframe', mod.url);
            listaNav.appendChild(li);
        }

        // En la vista de ajustes
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-modulo';
        tarjeta.innerHTML = `
            <i class="${mod.icon}"></i>
            <h4 class="mb-10">${mod.name}</h4>
            <div style="display:flex; justify-content:space-between; align-items:center;">
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
window.borrarModulo = (id) => { if(confirm('¿Borrar módulo?')) db.collection('users').doc(currentUser.uid).collection('modules').doc(id).delete(); };

// --- ENLACES ---
document.getElementById('form-enlace').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('enlace-nombre').value,
        url: document.getElementById('enlace-url').value
    };
    db.collection('users').doc(currentUser.uid).collection('links').add(data);
    e.target.reset();
});

function renderizarEnlaces(enlaces) {
    const listaIzquierda = document.getElementById('lista-enlaces-dinamicos');
    const contenedorCentro = document.getElementById('contenedor-enlaces');
    listaIzquierda.innerHTML = '';
    contenedorCentro.innerHTML = '';

    enlaces.forEach(link => {
        listaIzquierda.innerHTML += `<a href="${link.url}" target="_blank"><i class="fa-solid fa-globe"></i> ${link.name}</a>`;
        
        contenedorCentro.innerHTML += `
            <div class="fila-item">
                <div>
                    <h4>${link.name}</h4>
                    <a href="${link.url}" target="_blank" class="text-sm">${link.url}</a>
                </div>
                <button class="btn btn-danger btn-sm" onclick="borrarEnlace('${link.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
}
window.borrarEnlace = (id) => { if(confirm('¿Borrar enlace?')) db.collection('users').doc(currentUser.uid).collection('links').doc(id).delete(); };

// --- TAREAS DIARIAS ---
document.getElementById('form-tarea').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('tarea-nombre').value,
        time: document.getElementById('tarea-hora').value,
        lastCompleted: null,
        observaciones: [],
        tipo: 'diaria'
    };
    db.collection('users').doc(currentUser.uid).collection('tasks').add(data);
    e.target.reset();
});

function renderizarTareasCentral() {
    const cont = document.getElementById('contenedor-tareas');
    cont.innerHTML = '';
    datosTareas.forEach(t => {
        cont.innerHTML += `
            <div class="fila-item">
                <div><h4>${t.name}</h4><p class="text-sm text-muted"><i class="fa-regular fa-clock"></i> ${t.time}</p></div>
                <button class="btn btn-danger btn-sm" onclick="borrarTarea('${t.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
}
window.borrarTarea = (id) => { if(confirm('¿Borrar tarea diaria permanentemente?')) db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).delete(); };

// --- PROGRAMADAS ---
document.getElementById('form-programada').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('prog-nombre').value,
        date: document.getElementById('prog-fecha').value,
        time: document.getElementById('prog-hora').value,
        observaciones: [],
        tipo: 'programada'
    };
    db.collection('users').doc(currentUser.uid).collection('scheduled').add(data);
    e.target.reset();
});

function renderizarProgramadasCentral() {
    const cont = document.getElementById('contenedor-programadas');
    cont.innerHTML = '';
    datosProgramadas.forEach(p => {
        cont.innerHTML += `
            <div class="fila-item">
                <div><h4>${p.name}</h4><p class="text-sm text-muted"><i class="fa-regular fa-calendar"></i> ${p.date} - ${p.time}</p></div>
                <button class="btn btn-danger btn-sm" onclick="borrarProg('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
}
window.borrarProg = (id) => { if(confirm('¿Borrar programada?')) db.collection('users').doc(currentUser.uid).collection('scheduled').doc(id).delete(); };

// --- HISTORIAL ---
function renderizarHistorial(hist) {
    const cont = document.getElementById('contenedor-historial');
    cont.innerHTML = '';
    hist.forEach(h => {
        const fechaFormat = h.fecha ? new Date(h.fecha.toMillis()).toLocaleString() : '';
        const badge = h.tipo === 'diaria' ? 'Diaria' : 'Prog.';
        let obsHtml = '';
        if(h.observaciones && h.observaciones.length > 0) {
            obsHtml = '<div style="margin-top:10px; font-size:0.85rem; color:#94a3b8;"><strong>Obs:</strong><ul>';
            h.observaciones.forEach(o => obsHtml += `<li>[${o.fecha}] ${o.texto}</li>`);
            obsHtml += '</ul></div>';
        }
        cont.innerHTML += `
            <div class="fila-item" style="flex-direction:column; align-items:flex-start;">
                <div class="w-100 flex-row" style="justify-content:space-between">
                    <h4>${h.name} <span style="font-size:0.7rem; background:var(--accent-primary); padding:2px 6px; border-radius:4px;">${badge}</span></h4>
                    <span class="text-sm text-success"><i class="fa-solid fa-check"></i> ${fechaFormat}</span>
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
    cont.innerHTML = '';
    
    // Obtener "Hoy" (YYYY-MM-DD local)
    const hoyStr = new Date().toLocaleDateString('en-CA'); // Usa YYYY-MM-DD según local

    let itemsAgenda = [];

    datosTareas.forEach(t => {
        if(t.lastCompleted !== hoyStr) {
            itemsAgenda.push({ ...t, fOrden: hoyStr, esDiaria: true }); // Siempre aparecen "Hoy"
        }
    });

    datosProgramadas.forEach(p => {
        itemsAgenda.push({ ...p, fOrden: p.date, esDiaria: false });
    });

    // Ordenar por Fecha y Hora
    itemsAgenda.sort((a, b) => {
        if(a.fOrden === b.fOrden) return a.time.localeCompare(b.time);
        return a.fOrden.localeCompare(b.fOrden);
    });

    // Agrupar
    const grupos = {};
    itemsAgenda.forEach(item => {
        if(!grupos[item.fOrden]) grupos[item.fOrden] = [];
        grupos[item.fOrden].push(item);
    });

    // Renderizar
    for(const [fecha, items] of Object.entries(grupos)) {
        let etiquetaFecha = fecha === hoyStr ? "Hoy" : fecha;
        const divGrupo = document.createElement('div');
        divGrupo.className = 'agenda-dia';
        divGrupo.innerHTML = `<h4>${etiquetaFecha}</h4>`;

        items.forEach(item => {
            const clase = item.esDiaria ? 'diaria' : 'prog';
            const card = document.createElement('div');
            card.className = `tarea-tarjeta ${clase}`;
            card.innerHTML = `<strong>${item.name}</strong> <span>${item.time}</span>`;
            
            // Usamos un closure para pasar el item correcto al onclick
            card.onclick = function() { abrirModal(item); };
            
            divGrupo.appendChild(card);
        });
        cont.appendChild(divGrupo);
    }

    if(itemsAgenda.length === 0) {
        cont.innerHTML = '<p class="text-muted text-sm text-center">No hay tareas pendientes.</p>';
    }
}

// --- LOGICA MODAL ---
function abrirModal(tarea) {
    tareaActiva = tarea;
    document.getElementById('modal-titulo').textContent = tarea.name;
    document.getElementById('modal-observacion').value = '';
    document.getElementById('zona-reprogramar').classList.add('hidden');
    
    // Render observaciones previas
    const contObs = document.getElementById('modal-historial-obs');
    contObs.innerHTML = '';
    if(tarea.observaciones && tarea.observaciones.length > 0) {
        tarea.observaciones.forEach(o => {
            contObs.innerHTML += `<div class="obs-linea"><span class="text-muted text-sm">${o.fecha}</span><br>${o.texto}</div>`;
        });
    }

    // Preparar inputs de reprogramar
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

window.guardarReprogramacion = () => {
    if(!tareaActiva) return;
    const nf = document.getElementById('repro-fecha').value;
    const nh = document.getElementById('repro-hora').value;
    const obsVal = document.getElementById('modal-observacion').value.trim();

    let arrObs = tareaActiva.observaciones || [];
    let textoAgregado = `Reprogramado a ${nf} ${nh}`;
    if(obsVal) textoAgregado += `: ${obsVal}`;
    
    arrObs.push({ fecha: new Date().toLocaleString(), texto: textoAgregado });

    const docRef = db.collection('users').doc(currentUser.uid).collection(tareaActiva.esDiaria ? 'tasks' : 'scheduled').doc(tareaActiva.id);
    
    if(tareaActiva.esDiaria) {
        docRef.update({ time: nh, observaciones: arrObs });
    } else {
        docRef.update({ date: nf, time: nh, observaciones: arrObs });
    }

    cerrarModal();
};

window.concluirTarea = () => {
    if(!tareaActiva) return;
    const hoyStr = new Date().toLocaleDateString('en-CA');
    const obsVal = document.getElementById('modal-observacion').value.trim();
    
    let arrObs = tareaActiva.observaciones || [];
    if(obsVal) arrObs.push({ fecha: new Date().toLocaleString(), texto: obsVal });

    // Enviar a historial
    db.collection('users').doc(currentUser.uid).collection('history').add({
        name: tareaActiva.name,
        tipo: tareaActiva.tipo,
        observaciones: arrObs,
        fecha: firebase.firestore.FieldValue.serverTimestamp()
    });

    const docRef = db.collection('users').doc(currentUser.uid).collection(tareaActiva.esDiaria ? 'tasks' : 'scheduled').doc(tareaActiva.id);

    if(tareaActiva.esDiaria) {
        // Limpiar para mañana y setear completado
        docRef.update({ lastCompleted: hoyStr, observaciones: [] });
    } else {
        // Eliminar programada
        docRef.delete();
    }

    cerrarModal();
};
