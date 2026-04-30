// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Your web app's Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Global State
let currentUser = null;
let unsubscribes = [];
let currentActiveTask = null; // Para el modal

// UI Elements - Auth
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const btnGoogleLogin = document.getElementById('btn-google-login');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');
const userNameDisplay = document.getElementById('user-name');

// UI Elements - Navigation & Views
const navItems = document.querySelectorAll('.side-nav li[data-target]');
const moduleViews = document.querySelectorAll('.module-view');
const dynamicModulesList = document.getElementById('dynamic-modules-list');
const customLinksContainer = document.getElementById('custom-links-container');
const iframeView = document.getElementById('view-iframe');
const moduloIframe = document.getElementById('modulo-iframe');

// UI Elements - Modals
const modalTarea = document.getElementById('modal-tarea');
const modalTareaClose = document.getElementById('modal-tarea-close');
const modalObservacion = document.getElementById('modal-observacion');
const modalHistorialObs = document.getElementById('modal-historial-observaciones');
const btnConcluir = document.getElementById('btn-concluir');
const btnReprogramar = document.getElementById('btn-reprogramar');
const reprogramarZona = document.getElementById('reprogramar-zona');
const btnConfirmReprogramar = document.getElementById('btn-confirm-reprogramar');

// ==========================================
// AUTHENTICATION
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        showDashboard(user);
        initDataListeners(user.uid);
    } else {
        currentUser = null;
        showLogin();
        clearListeners();
    }
});

function showDashboard(user) {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    userNameDisplay.textContent = user.displayName || user.email.split('@')[0];
    // Default view
    switchView('view-tareas');
}

function showLogin() {
    dashboardSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    authError.textContent = '';
    if(loginForm) loginForm.reset();
}

// Google Login
if(btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(err => console.error(err));
    });
}
if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

// ==========================================
// NAVIGATION LOGIC
// ==========================================
function switchView(targetId, iframeUrl = null) {
    // Hide all
    moduleViews.forEach(view => view.classList.add('hidden'));
    document.querySelectorAll('.side-nav li').forEach(li => li.classList.remove('active'));
    
    // Show target
    const targetView = document.getElementById(targetId);
    if(targetView) targetView.classList.remove('hidden');
    
    // Activate nav item
    const navItem = document.querySelector(`.side-nav li[data-target="${targetId}"]`);
    if(navItem) navItem.classList.add('active');

    // Handle Iframe special case
    if(targetId === 'view-iframe' && iframeUrl) {
        moduloIframe.src = iframeUrl;
    } else {
        moduloIframe.src = "";
    }
}

// Fixed Nav listeners
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(item.getAttribute('data-target'));
    });
});

// ==========================================
// DATA LISTENING (Firestore)
// ==========================================
function clearListeners() {
    unsubscribes.forEach(unsub => unsub());
    unsubscribes = [];
}

function initDataListeners(uid) {
    clearListeners();
    const userRef = doc(db, 'users', uid);
    
    // 1. Modulos
    const qModules = query(collection(userRef, 'modules'));
    unsubscribes.push(onSnapshot(qModules, snapshot => {
        renderModulos(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
    }));

    // 2. Enlaces
    const qLinks = query(collection(userRef, 'links'));
    unsubscribes.push(onSnapshot(qLinks, snapshot => {
        renderEnlaces(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
    }));

    // 3. Tareas Diarias
    const qTareas = query(collection(userRef, 'tasks'));
    unsubscribes.push(onSnapshot(qTareas, snapshot => {
        renderTareas(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
        updateAgenda(); // Agenda uses multiple collections
    }));

    // 4. Programadas
    const qProg = query(collection(userRef, 'scheduledTasks'));
    unsubscribes.push(onSnapshot(qProg, snapshot => {
        renderProgramadas(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
        updateAgenda();
    }));

    // 5. Historial
    const qHist = query(collection(userRef, 'history'), orderBy('completedAt', 'desc'));
    unsubscribes.push(onSnapshot(qHist, snapshot => {
        renderHistorial(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
    }));
}

// ==========================================
// RENDER FUNCTIONS & CRUD LOGIC
// ==========================================

// --- MÓDULOS ---
document.getElementById('form-modulo').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return;
    const data = {
        icon: document.getElementById('modulo-icon').value,
        name: document.getElementById('modulo-name').value,
        url: document.getElementById('modulo-url').value,
        isActive: true
    };
    await addDoc(collection(db, 'users', currentUser.uid, 'modules'), data);
    e.target.reset();
});

function renderModulos(modules) {
    const grid = document.getElementById('modulos-grid');
    dynamicModulesList.innerHTML = '';
    grid.innerHTML = '';

    modules.forEach(mod => {
        // Nav Item (if active)
        if(mod.isActive) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#"><i class="${mod.icon}"></i> ${mod.name}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                // Find all li and remove active
                document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
                li.classList.add('active');
                switchView('view-iframe', mod.url);
            });
            dynamicModulesList.appendChild(li);
        }

        // Grid Card
        const card = document.createElement('div');
        card.className = 'module-card glass-panel';
        card.innerHTML = `
            <div class="module-icon"><i class="${mod.icon}"></i></div>
            <div class="module-info">
                <h3>${mod.name}</h3>
                <p><a href="${mod.url}" target="_blank" class="text-muted"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ver enlace</a></p>
                <div class="module-controls">
                    <label class="switch">
                        <input type="checkbox" ${mod.isActive ? 'checked' : ''} onchange="toggleModule('${mod.id}', this.checked)">
                        <span class="slider"></span>
                    </label>
                    <button class="btn-icon" onclick="deleteModule('${mod.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}
window.toggleModule = (id, isActive) => updateDoc(doc(db, 'users', currentUser.uid, 'modules', id), {isActive});
window.deleteModule = (id) => { if(confirm('¿Eliminar módulo?')) deleteDoc(doc(db, 'users', currentUser.uid, 'modules', id)); };

// --- ENLACES ---
document.getElementById('form-enlace').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return;
    const data = {
        name: document.getElementById('enlace-name').value,
        url: document.getElementById('enlace-url').value
    };
    await addDoc(collection(db, 'users', currentUser.uid, 'links'), data);
    e.target.reset();
});

function renderEnlaces(links) {
    const listCenter = document.getElementById('enlaces-list-center');
    listCenter.innerHTML = '';
    customLinksContainer.innerHTML = '';

    links.forEach(link => {
        // Nav Button
        const btn = document.createElement('a');
        btn.href = link.url;
        btn.target = "_blank";
        btn.className = "link-btn";
        btn.innerHTML = `<i class="fa-solid fa-globe"></i> ${link.name}`;
        customLinksContainer.appendChild(btn);

        // Center List
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-info">
                <h4>${link.name}</h4>
                <p><a href="${link.url}" target="_blank">${link.url}</a></p>
            </div>
            <div class="item-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteLink('${link.id}')"><i class="fa-solid fa-trash"></i> Eliminar</button>
            </div>
        `;
        listCenter.appendChild(item);
    });
}
window.deleteLink = (id) => { if(confirm('¿Eliminar enlace?')) deleteDoc(doc(db, 'users', currentUser.uid, 'links', id)); };

// --- TAREAS DIARIAS ---
document.getElementById('form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return;
    const data = {
        name: document.getElementById('tarea-name').value,
        time: document.getElementById('tarea-time').value,
        observations: [],
        lastCompletedDate: null,
        type: 'daily'
    };
    await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), data);
    e.target.reset();
});

function renderTareas(tareas) {
    const listCenter = document.getElementById('tareas-list-center');
    listCenter.innerHTML = '';
    tareas.forEach(tarea => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-info">
                <h4>${tarea.name}</h4>
                <p><i class="fa-regular fa-clock"></i> ${tarea.time} - Recurrente diaria</p>
            </div>
            <div class="item-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteTask('${tarea.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        listCenter.appendChild(item);
    });
}
window.deleteTask = (id) => { if(confirm('¿Eliminar tarea diaria permanentemente?')) deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', id)); };

// --- PROGRAMADAS ---
document.getElementById('form-programada').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!currentUser) return;
    const data = {
        name: document.getElementById('prog-name').value,
        date: document.getElementById('prog-date').value,
        time: document.getElementById('prog-time').value,
        observations: [],
        type: 'prog'
    };
    await addDoc(collection(db, 'users', currentUser.uid, 'scheduledTasks'), data);
    e.target.reset();
});

function renderProgramadas(prog) {
    const listCenter = document.getElementById('programadas-list-center');
    listCenter.innerHTML = '';
    prog.forEach(p => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-info">
                <h4>${p.name}</h4>
                <p><i class="fa-regular fa-calendar"></i> ${p.date} a las ${p.time}</p>
            </div>
            <div class="item-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteProg('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        listCenter.appendChild(item);
    });
}
window.deleteProg = (id) => { if(confirm('¿Eliminar evento programado?')) deleteDoc(doc(db, 'users', currentUser.uid, 'scheduledTasks', id)); };

// --- HISTORIAL ---
function renderHistorial(hist) {
    const listCenter = document.getElementById('historial-list');
    listCenter.innerHTML = '';
    hist.forEach(h => {
        const date = h.completedAt ? new Date(h.completedAt.toMillis()).toLocaleString() : 'Desconocida';
        const typeBadge = h.type === 'daily' ? 'Diaria' : 'Programada';
        
        // Format observations
        let obsHtml = '';
        if(h.observations && h.observations.length > 0) {
            obsHtml = '<div class="mt-15" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;"><strong>Observaciones:</strong><ul style="margin-left:20px; font-size:0.85rem;">';
            h.observations.forEach(o => obsHtml += `<li><span class="text-muted">[${o.date}]</span> ${o.text}</li>`);
            obsHtml += '</ul></div>';
        }

        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'flex-start';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%;">
                <div class="item-info">
                    <h4>${h.name} <span style="font-size:0.7rem; background:var(--accent-primary); padding:2px 6px; border-radius:4px;">${typeBadge}</span></h4>
                    <p><i class="fa-solid fa-check text-success"></i> Concluida el: ${date}</p>
                </div>
            </div>
            ${obsHtml}
        `;
        listCenter.appendChild(item);
    });
}

// ==========================================
// AGENDA (RIGHT COLUMN) & MODALS
// ==========================================
// Keep global arrays for agenda to mix them
let currentTasks = [];
let currentProg = [];

// Hook into onSnapshot data
const userRefTasks = currentUser ? collection(db, 'users', currentUser.uid, 'tasks') : null;
if(userRefTasks) {
    // Actually we hooked earlier, so we will just fetch them inside updateAgenda from Firestore directly or store them in variables.
    // Let's store them in global vars during render functions.
}
// We will modify renderTareas and renderProgramadas to also store data
const originalRenderTareas = renderTareas;
renderTareas = (tareas) => { currentTasks = tareas; originalRenderTareas(tareas); };
const originalRenderProg = renderProgramadas;
renderProgramadas = (prog) => { currentProg = prog; originalRenderProg(prog); };

function updateAgenda() {
    const container = document.getElementById('agenda-container');
    container.innerHTML = '';
    
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    let agendaItems = [];

    // Add daily tasks (only if not completed today)
    currentTasks.forEach(t => {
        if(t.lastCompletedDate !== todayStr) {
            agendaItems.push({
                ...t,
                sortDate: todayStr, // Always appears today
                isDaily: true
            });
        }
    });

    // Add programmed tasks
    currentProg.forEach(p => {
        agendaItems.push({
            ...p,
            sortDate: p.date,
            isDaily: false
        });
    });

    // Sort by Date then Time
    agendaItems.sort((a, b) => {
        if(a.sortDate === b.sortDate) {
            return a.time.localeCompare(b.time);
        }
        return a.sortDate.localeCompare(b.sortDate);
    });

    // Group by Date
    const grouped = {};
    agendaItems.forEach(item => {
        if(!grouped[item.sortDate]) grouped[item.sortDate] = [];
        grouped[item.sortDate].push(item);
    });

    // Render
    for(const [dateStr, items] of Object.entries(grouped)) {
        // Header
        let displayDate = dateStr === todayStr ? "Hoy" : dateStr;
        const groupDiv = document.createElement('div');
        groupDiv.className = 'agenda-day';
        groupDiv.innerHTML = `<h4>${displayDate}</h4>`;

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = `task-card ${item.isDaily ? 'daily' : 'prog'}`;
            card.innerHTML = `
                <div class="task-header">
                    <strong>${item.name}</strong>
                    <span class="task-time">${item.time}</span>
                </div>
            `;
            card.addEventListener('click', () => openModal(item));
            groupDiv.appendChild(card);
        });
        
        container.appendChild(groupDiv);
    }

    if(agendaItems.length === 0) {
        container.innerHTML = '<p class="text-sm text-muted">No hay tareas pendientes.</p>';
    }
}

// --- MODAL LOGIC ---
function openModal(task) {
    currentActiveTask = task;
    document.getElementById('modal-tarea-title').textContent = task.name;
    modalObservacion.value = '';
    reprogramarZona.classList.add('hidden');
    
    // Render History of observations
    modalHistorialObs.innerHTML = '';
    if(task.observations && task.observations.length > 0) {
        task.observations.forEach(obs => {
            modalHistorialObs.innerHTML += `
                <div class="obs-item">
                    <span class="obs-date">${obs.date}</span>
                    ${obs.text}
                </div>
            `;
        });
    }

    // Set reprogramar inputs to current task values
    document.getElementById('reprogramar-date').value = task.sortDate;
    document.getElementById('reprogramar-time').value = task.time;

    modalTarea.classList.remove('hidden');
}

modalTareaClose.addEventListener('click', () => modalTarea.classList.add('hidden'));

btnReprogramar.addEventListener('click', () => {
    reprogramarZona.classList.toggle('hidden');
});

btnConfirmReprogramar.addEventListener('click', async () => {
    if(!currentActiveTask) return;
    const newDate = document.getElementById('reprogramar-date').value;
    const newTime = document.getElementById('reprogramar-time').value;
    const obsText = modalObservacion.value.trim();

    let newObsArray = currentActiveTask.observations || [];
    if(obsText) {
        newObsArray.push({
            date: new Date().toLocaleString(),
            text: `Reprogramado a ${newDate} ${newTime}: ${obsText}`
        });
    } else {
        newObsArray.push({
            date: new Date().toLocaleString(),
            text: `Reprogramado a ${newDate} ${newTime}`
        });
    }

    const docRef = doc(db, 'users', currentUser.uid, currentActiveTask.isDaily ? 'tasks' : 'scheduledTasks', currentActiveTask.id);
    
    if(currentActiveTask.isDaily) {
        // For daily tasks, Reprogramming just changes the default time. Date doesn't make sense since it's daily.
        await updateDoc(docRef, { time: newTime, observations: newObsArray });
    } else {
        await updateDoc(docRef, { date: newDate, time: newTime, observations: newObsArray });
    }

    modalTarea.classList.add('hidden');
});

btnConcluir.addEventListener('click', async () => {
    if(!currentActiveTask) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const obsText = modalObservacion.value.trim();
    
    let newObsArray = currentActiveTask.observations || [];
    if(obsText) {
        newObsArray.push({
            date: new Date().toLocaleString(),
            text: obsText
        });
    }

    // 1. Send to History
    await addDoc(collection(db, 'users', currentUser.uid, 'history'), {
        name: currentActiveTask.name,
        type: currentActiveTask.type,
        observations: newObsArray,
        completedAt: serverTimestamp()
    });

    const docRef = doc(db, 'users', currentUser.uid, currentActiveTask.isDaily ? 'tasks' : 'scheduledTasks', currentActiveTask.id);

    // 2. Action based on type
    if(currentActiveTask.isDaily) {
        // Daily: Mark as completed today, clear observations for next time
        await updateDoc(docRef, { 
            lastCompletedDate: todayStr,
            observations: [] // Cleared for the next day as requested
        });
    } else {
        // Scheduled: Delete forever
        await deleteDoc(docRef);
    }

    modalTarea.classList.add('hidden');
});
