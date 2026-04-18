import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAZ0BULc3KDh71l1_neyQiW54sTo_muQVg",
    authDomain: "html-127c3.firebaseapp.com",
    projectId: "html-127c3",
    storageBucket: "html-127c3.firebasestorage.app",
    messagingSenderId: "873979319873",
    appId: "1:873979319873:web:de658124ac684835a418c0",
    measurementId: "G-K1M4NFGGKN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- ESTADO GLOBAL ---
let currentModule = 'dashboard';
let authMode = 'login'; // 'login', 'register', 'forgot'
let modulesVisibility = {
    'tareas-fijas': true,
    'tareas-programadas': true,
    'historico': true
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    initAuthListener();
    setupEventListeners();
    setupAuthUI();
});

function initAuthListener() {
    onAuthStateChanged(auth, (user) => {
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app-container');
        
        if (user) {
            authScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            document.querySelector('.user-name').innerText = user.email.split('@')[0];
            initApp();
        } else {
            authScreen.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    });
}

async function initApp() {
    loadModulesConfig();
    renderSidebar();
    loadDailyTasks(); // Carga la columna derecha
    loadModule('dashboard'); 
}

// --- GESTIÓN DE MÓDULOS (SIDEBAR) ---
function renderSidebar() {
    const navList = document.getElementById('nav-list');
    navList.innerHTML = `
        <li class="nav-item ${currentModule === 'dashboard' ? 'active' : ''}" id="btn-dashboard">
            <i class="fas fa-th-large"></i> <span>Dashboard</span>
        </li>
    `;

    if (modulesVisibility['tareas-fijas']) {
        navList.innerHTML += `
            <li class="nav-item ${currentModule === 'tareas-fijas' ? 'active' : ''}" id="btn-tareas-fijas">
                <i class="fas fa-thumbtack"></i> <span>Tareas Fijas</span>
            </li>
        `;
    }

    if (modulesVisibility['tareas-programadas']) {
        navList.innerHTML += `
            <li class="nav-item ${currentModule === 'tareas-programadas' ? 'active' : ''}" id="btn-tareas-programadas">
                <i class="fas fa-calendar-alt"></i> <span>Programadas</span>
            </li>
        `;
    }

    if (modulesVisibility['historico']) {
        navList.innerHTML += `
            <li class="nav-item ${currentModule === 'historico' ? 'active' : ''}" id="btn-historico">
                <i class="fas fa-history"></i> <span>Histórico</span>
            </li>
        `;
    }

    navList.innerHTML += `
        <li class="nav-item ${currentModule === 'modulos-config' ? 'active' : ''}" id="btn-modulos-config">
            <i class="fas fa-puzzle-piece"></i> <span>Módulos</span>
        </li>
    `;

    // Re-vincular eventos
    navList.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.id.replace('btn-', '');
            loadModule(id);
        });
    });
}

// --- CARGADOR DE VISTAS (CENTRO) ---
function loadModule(moduleId) {
    currentModule = moduleId;
    const viewport = document.getElementById('module-viewport');
    renderSidebar();

    switch(moduleId) {
        case 'dashboard':
            renderDashboard(viewport);
            break;
        case 'tareas-fijas':
            renderTareasFijas(viewport);
            break;
        case 'tareas-programadas':
            renderTareasProgramadas(viewport);
            break;
        case 'historico':
            renderHistorico(viewport);
            break;
        case 'modulos-config':
            renderModulosConfig(viewport);
            break;
    }
}

// --- MÓDULO: TAREAS FIJAS ---
function renderTareasFijas(container) {
    container.innerHTML = `
        <div class="module-view">
            <h2><i class="fas fa-thumbtack"></i> Configurar Tareas Fijas</h2>
            <p class="muted">Estas tareas aparecerán todos los días en tu panel.</p>
            
            <form id="form-fixed-task" class="mt-1">
                <div class="input-group">
                    <input type="text" id="fixed-task-name" placeholder="Nombre de la tarea fija..." required>
                    <button type="submit" class="btn-primary">Añadir Tarea</button>
                </div>
            </form>

            <div class="list-container mt-2">
                <h3>Tareas Actuales (Ordenables)</h3>
                <div id="fixed-tasks-list" class="dynamic-list"></div>
            </div>
        </div>
    `;

    const form = document.getElementById('form-fixed-task');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('fixed-task-name').value;
        await addDoc(collection(db, "tareas_fijas"), {
            name: name,
            order: Date.now(),
            createdAt: serverTimestamp()
        });
        form.reset();
    };

    // Escuchar cambios en tiempo real
    onSnapshot(query(collection(db, "tareas_fijas"), orderBy("order", "asc")), (snap) => {
        const list = document.getElementById('fixed-tasks-list');
        if (!list) return;
        list.innerHTML = '';
        snap.forEach(docSnap => {
            const task = docSnap.data();
            list.innerHTML += `
                <div class="list-item">
                    <span>${task.name}</span>
                    <button onclick="deleteFixedTask('${docSnap.id}')" class="btn-delete"><i class="fas fa-trash"></i></button>
                </div>
            `;
        });
    });
}

window.deleteFixedTask = async (id) => {
    if(confirm("¿Eliminar esta tarea fija? Dejará de aparecer a diario.")) {
        await deleteDoc(doc(db, "tareas_fijas", id));
    }
};

// --- MÓDULO: TAREAS PROGRAMADAS ---
function renderTareasProgramadas(container) {
    container.innerHTML = `
        <div class="module-view">
            <h2><i class="fas fa-calendar-alt"></i> Programar Nuevas Tareas</h2>
            
            <form id="form-scheduled-task" class="mt-1 grid-form">
                <input type="text" id="sch-name" placeholder="¿Qué hay que hacer?" required>
                <div class="flex-row">
                    <input type="date" id="sch-date" required>
                    <input type="time" id="sch-time" required>
                </div>
                <button type="submit" class="btn-primary">Programar Tarea</button>
            </form>

            <div class="list-container mt-2">
                <h3>Próximas Tareas Programadas</h3>
                <div id="scheduled-tasks-list" class="dynamic-list"></div>
            </div>
        </div>
    `;

    const form = document.getElementById('form-scheduled-task');
    form.onsubmit = async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "tareas_programadas"), {
            name: document.getElementById('sch-name').value,
            date: document.getElementById('sch-date').value,
            time: document.getElementById('sch-time').value,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        form.reset();
    };

    onSnapshot(query(collection(db, "tareas_programadas"), where("status", "==", "pending"), orderBy("date", "asc")), (snap) => {
        const list = document.getElementById('scheduled-tasks-list');
        if (!list) return;
        list.innerHTML = '';
        snap.forEach(docSnap => {
            const t = docSnap.data();
            list.innerHTML += `
                <div class="list-item">
                    <div>
                        <strong>${t.name}</strong><br>
                        <small>${t.date} a las ${t.time}</small>
                    </div>
                </div>
            `;
        });
    });
}

// --- COLUMNA DERECHA (LÓGICA COMBINADA) ---
function loadDailyTasks() {
    const taskContainer = document.getElementById('task-list-container');
    const today = new Date().toISOString().split('T')[0];

    // Escuchar tareas fijas
    onSnapshot(query(collection(db, "tareas_fijas"), orderBy("order", "asc")), (snapFijas) => {
        // Escuchar tareas programadas de hoy
        onSnapshot(query(collection(db, "tareas_programadas"), where("status", "==", "pending")), (snapProg) => {
            taskContainer.innerHTML = '';
            
            // Sección Tareas Fijas
            const fixedSection = document.createElement('div');
            fixedSection.innerHTML = `<div class="date-divider">TAREAS DIARIAS (FIJAS)</div>`;
            snapFijas.forEach(docSnap => {
                const t = docSnap.data();
                const el = createInteractiveTask(t.name, 'fixed', docSnap.id);
                fixedSection.appendChild(el);
            });
            taskContainer.appendChild(fixedSection);

            // Sección Programadas (incluyendo vencidas)
            const progSection = document.createElement('div');
            progSection.innerHTML = `<div class="date-divider">PROGRAMADAS PARA HOY / PENDIENTES</div>`;
            
            snapProg.forEach(docSnap => {
                const t = docSnap.data();
                const isOverdue = new Date(`${t.date} ${t.time}`) < new Date();
                const el = createInteractiveTask(t.name, 'scheduled', docSnap.id, t.date, t.time, isOverdue);
                progSection.appendChild(el);
            });
            taskContainer.appendChild(progSection);
        });
    });
}

function createInteractiveTask(name, type, id, date = '', time = '', isOverdue = false) {
    const div = document.createElement('div');
    div.className = `task-item ${isOverdue ? 'high' : 'medium'}`;
    div.style.cursor = 'pointer';
    div.innerHTML = `
        <div class="task-time">${time || 'Diaria'}</div>
        <div class="task-info">
            <h4>${name}</h4>
            <p>${date || 'Cada día'}</p>
        </div>
    `;

    div.onclick = () => handleTaskClick(name, type, id);
    return div;
}

async function handleTaskClick(name, type, id) {
    const choice = confirm(`¿Has concluido "${name}"?\n(Aceptar: Concluir | Cancelar: Programar/Cerrar)`);
    
    if (choice) {
        const obs = prompt("Anotaciones / Observaciones:");
        await addDoc(collection(db, "historico"), {
            name: name,
            type: type,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString(),
            observations: obs || "",
            timestamp: serverTimestamp()
        });

        if (type === 'scheduled') {
            await updateDoc(doc(db, "tareas_programadas", id), { status: 'completed' });
        }
        alert("Tarea registrada en histórico.");
    } else {
        const reschedule = confirm("¿Quieres programarla para otro día/hora?");
        if (reschedule && type === 'fixed') {
             // Si es fija, creamos una programada puntual para el futuro
             const newDate = prompt("Fecha (AAAA-MM-DD):", new Date().toISOString().split('T')[0]);
             const newTime = prompt("Hora (HH:MM):", "09:00");
             if (newDate && newTime) {
                 await addDoc(collection(db, "tareas_programadas"), {
                     name: `${name} (Rescheduling)`,
                     date: newDate,
                     time: newTime,
                     status: 'pending',
                     createdAt: serverTimestamp()
                 });
             }
        }
    }
}

// --- MÓDULO: HISTÓRICO ---
function renderHistorico(container) {
    container.innerHTML = `
        <div class="module-view">
            <h2><i class="fas fa-history"></i> Historial de Tareas Concluidas</h2>
            <div id="history-list" class="dynamic-list mt-2"></div>
        </div>
    `;

    onSnapshot(query(collection(db, "historico"), orderBy("timestamp", "desc")), (snap) => {
        const list = document.getElementById('history-list');
        if (!list) return;
        list.innerHTML = '';
        snap.forEach(docSnap => {
            const h = docSnap.data();
            list.innerHTML += `
                <div class="list-item history-item">
                    <div style="flex-grow: 1;">
                        <strong>${h.name}</strong> - <small>${h.date} ${h.time}</small>
                        <p class="muted">${h.observations || 'Sin anotaciones'}</p>
                    </div>
                </div>
            `;
        });
    });
}

// --- MÓDULO: CONFIGURACIÓN DE MÓDULOS ---
function renderModulosConfig(container) {
    container.innerHTML = `
        <div class="module-view">
            <h2><i class="fas fa-puzzle-piece"></i> Configurar Panel de Control</h2>
            <p>Selecciona qué botones quieres ver en el menú lateral.</p>
            <div class="config-grid mt-2">
                <label class="config-item">
                    <input type="checkbox" ${modulesVisibility['tareas-fijas'] ? 'checked' : ''} onchange="toggleModule('tareas-fijas')">
                    Tareas Fijas
                </label>
                <label class="config-item">
                    <input type="checkbox" ${modulesVisibility['tareas-programadas'] ? 'checked' : ''} onchange="toggleModule('tareas-programadas')">
                    Tareas Programadas
                </label>
                <label class="config-item">
                    <input type="checkbox" ${modulesVisibility['historico'] ? 'checked' : ''} onchange="toggleModule('historico')">
                    Histórico
                </label>
            </div>
        </div>
    `;
}

window.toggleModule = async (moduleId) => {
    modulesVisibility[moduleId] = !modulesVisibility[moduleId];
    // Guardar en Firebase para persistencia
    await updateDoc(doc(db, "config", "sidebar"), modulesVisibility).catch(async () => {
        // Si no existe el doc, lo creamos (esto es simplificado)
        console.log("Config doc init needed");
    });
    renderSidebar();
};

async function loadModulesConfig() {
    // Aquí cargaríamos de Firebase. Por ahora usamos el estado local inicial.
}

// --- LÓGICA DE AUTENTICACIÓN ---
function setupAuthUI() {
    const form = document.getElementById('auth-form');
    const btnSwitchRegister = document.getElementById('btn-switch-register');
    const btnSwitchForgot = document.getElementById('btn-switch-forgot');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const passGroup = document.getElementById('pass-group');
    const btnSubmit = document.getElementById('btn-auth-submit');

    btnSwitchRegister.onclick = () => {
        if (authMode !== 'register') {
            authMode = 'register';
            authTitle.innerText = 'Crea tu Cuenta';
            authSubtitle.innerText = 'Únete a CRM PRO hoy mismo';
            btnSubmit.innerText = 'Registrarse';
            btnSwitchRegister.innerText = '¿Ya tienes cuenta? Inicia sesión';
            passGroup.classList.remove('hidden');
        } else {
            setLoginMode();
        }
    };

    btnSwitchForgot.onclick = () => {
        authMode = 'forgot';
        authTitle.innerText = 'Recuperar Contraseña';
        authSubtitle.innerText = 'Te enviaremos un correo para restablecerla';
        btnSubmit.innerText = 'Enviar Correo';
        passGroup.classList.add('hidden');
        btnSwitchRegister.innerText = 'Volver al Login';
    };

    function setLoginMode() {
        authMode = 'login';
        authTitle.innerText = 'Bienvenido a CRM PRO';
        authSubtitle.innerText = 'Ingresa tus credenciales para continuar';
        btnSubmit.innerText = 'Iniciar Sesión';
        btnSwitchRegister.innerText = '¿No tienes cuenta? Regístrate';
        passGroup.classList.remove('hidden');
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        try {
            if (authMode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else if (authMode === 'register') {
                await createUserWithEmailAndPassword(auth, email, password);
            } else if (authMode === 'forgot') {
                await sendPasswordResetEmail(auth, email);
                alert("Correo de recuperación enviado.");
                setLoginMode();
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    };
}

// Botón de Cerrar Sesión (opcional pero recomendado)
document.getElementById('user-profile').onclick = () => {
    if(confirm("¿Cerrar sesión?")) {
        signOut(auth);
    }
};

function setupEventListeners() {
    // Configuración adicional si fuera necesaria
}

function renderDashboard(container) {
    container.innerHTML = `
        <div class="view-placeholder">
            <h2>Panel de Resumen</h2>
            <p>Bienvenido a tu CRM. Usa el menú lateral para gestionar tus tareas.</p>
        </div>
    `;
}
