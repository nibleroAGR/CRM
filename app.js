// CRM Comercial - Lógica Principal
console.log("Cargando CRM App...");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAZ0BULc3KDh71l1_neyQiW54sTo_muQVg",
    authDomain: "html-127c3.firebaseapp.com",
    projectId: "html-127c3",
    storageBucket: "html-127c3.firebasestorage.app",
    messagingSenderId: "873979319873",
    appId: "1:873979319873:web:de658124ac684835a418c0",
    measurementId: "G-K1M4NFGGKN"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- SELECTORES DOM ---
const modal = document.getElementById('modal-container');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const loginBtn = document.getElementById('login-trigger');
const settingsBtn = document.getElementById('settings-btn');
const mainView = document.getElementById('main-view');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');

// --- SISTEMA DE NOTIFICACIONES ---
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
    toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- LÓGICA DE NAVEGACIÓN ---
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        if (item.id === 'settings-btn') return;
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        const view = item.querySelector('.nav-label').innerText;
        pageTitle.innerText = view;
        renderView(view);
    });
});

function renderView(viewName) {
    mainView.style.alignItems = 'flex-start';
    mainView.style.justifyContent = 'flex-start';
    
    switch(viewName) {
        case 'Panel':
            mainView.innerHTML = `<div class="dashboard-content"><h2>Panel Principal</h2><p>Bienvenido al sistema de gestión.</p></div>`;
            break;
        case 'Clientes':
            mainView.innerHTML = `
                <div class="view-header">
                    <h2>Clientes</h2>
                    <div class="header-actions">
                        <button id="btn-export" class="btn btn-outline btn-sm">
                            <i data-lucide="download"></i>
                            <span>Exportar a Excel</span>
                        </button>
                    </div>
                </div>
                <div id="clients-list" class="clients-table-container">Cargando lista...</div>`;
            document.getElementById('btn-export').onclick = exportClientsToExcel;
            loadClientsList();
            break;
        case 'Landing':
            mainView.style.alignItems = 'center';
            mainView.style.justifyContent = 'center';
            mainView.innerHTML = `<div class="empty-state"><i data-lucide="shield-check"></i><h2>Bienvenido</h2><p>Inicia sesión como empresa.</p></div>`;
            break;
        default:
            mainView.innerHTML = `<h2>${viewName}</h2>`;
    }
    if (window.lucide) lucide.createIcons();
}

// --- GESTIÓN DE MODALES ---
function openModal(title, contentHTML) {
    modalTitle.innerText = title;
    modalContent.innerHTML = contentHTML;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function closeModal() {
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

document.querySelector('.close-modal').addEventListener('click', closeModal);
window.onclick = (e) => { if (e.target == modal) closeModal(); };

// --- AUTENTICACIÓN ---
function renderAuthForm(mode = 'login') {
    let title = 'Acceso Empresa';
    let authHTML = `
        <form id="auth-form">
            <div class="form-group"><label class="form-label">Email</label><input type="email" id="email" class="form-control" required></div>
            ${mode === 'recover' ? '' : '<div class="form-group"><label class="form-label">Contraseña</label><input type="password" id="password" class="form-control" required></div>'}
            <button type="submit" class="btn btn-primary" style="width:100%">${mode==='login'?'Entrar':mode==='signup'?'Registrar':'Recuperar'}</button>
            <div style="text-align:center; margin-top:15px; font-size:13px;">
                ${mode==='login'?'<a href="#" id="go-recover">¿Has olvidado tu clave?</a><br><br>¿Nuevo? <a href="#" id="go-signup">Crea cuenta</a>' : '<a href="#" id="go-login">Volver al login</a>'}
            </div>
        </form>`;
    
    openModal(title, authHTML);
    document.getElementById('go-signup')?.addEventListener('click', () => renderAuthForm('signup'));
    document.getElementById('go-login')?.addEventListener('click', () => renderAuthForm('login'));
    document.getElementById('go-recover')?.addEventListener('click', () => renderAuthForm('recover'));

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password')?.value;
        try {
            if (mode==='login') await signInWithEmailAndPassword(auth, email, pass);
            else if (mode==='signup') await createUserWithEmailAndPassword(auth, email, pass);
            else { await sendPasswordResetEmail(auth, email); alert("Email enviado"); }
            closeModal();
        } catch (err) { alert("Error: " + err.message); }
    });
}

loginBtn.addEventListener('click', () => {
    if (auth.currentUser) { if (confirm("¿Cerrar sesión?")) signOut(auth).then(() => location.reload()); }
    else renderAuthForm('login');
});

// --- CONFIGURACIÓN MODULAR ---
settingsBtn.addEventListener('click', () => {
    if (!auth.currentUser) return renderAuthForm('login');
    renderSettings('Equipo');
});

function renderSettings(activeTab) {
    openModal('Configuración', `
        <div class="settings-container">
            <nav class="settings-nav">
                <div class="settings-tab ${activeTab==='Equipo'?'active':''}" data-tab="Equipo">Equipo</div>
                <div class="settings-tab ${activeTab==='Clientes'?'active':''}" data-tab="Clientes">Clientes</div>
            </nav>
            <div class="tab-content" id="settings-tab-content"></div>
        </div>`);
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => renderSettings(tab.dataset.tab));
    });
    renderSettingsTab(activeTab);
}

function renderSettingsTab(tab) {
    const container = document.getElementById('settings-tab-content');
    if (tab === 'Equipo') {
        container.innerHTML = `
            <h4>Gestión de Equipo</h4>
            <form id="comm-form" style="margin-top:10px">
                <input type="text" id="comm-name" class="form-control" placeholder="Nombre" required style="margin-bottom:10px">
                <div style="display:grid; grid-template-columns: 1fr 100px; gap:10px; margin-bottom:10px">
                    <input type="email" id="comm-email" class="form-control" placeholder="Email" required>
                    <input type="text" id="comm-code" class="form-control" placeholder="CÓDIGO" required>
                </div>
                <button type="submit" class="btn btn-primary btn-sm">Dar de Alta</button>
            </form>
            <div id="team-list" style="margin-top:20px">Cargando...</div>`;
        loadCommercials();
        document.getElementById('comm-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalHtml = btn.innerHTML;
            
            try {
                btn.disabled = true;
                btn.innerHTML = `<div class="spinner"></div><span>Guardando...</span>`;
                
                await addDoc(collection(db, "commercials"), {
                    companyId: auth.currentUser.uid,
                    name: document.getElementById('comm-name').value,
                    email: document.getElementById('comm-email').value,
                    code: document.getElementById('comm-code').value.toUpperCase(),
                    createdAt: new Date().toISOString()
                });
                
                showToast("Comercial creado con éxito", "success");
                e.target.reset();
                loadCommercials();
            } catch (err) {
                showToast("Error al crear comercial: " + err.message, "error");
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        });
    } else if (tab === 'Clientes') {
        container.innerHTML = `
            <h4>Importar Clientes</h4>
            <input type="file" id="file-in" accept=".csv,.xlsx" style="margin-top:10px">
            <div id="mapping-area" style="display:none; margin-top:20px">
                <h5>Mapeo de Columnas</h5>
                <table class="mapping-table"><thead><tr><th>Original</th><th>App</th><th>Visible</th></tr></thead><tbody id="map-body"></tbody></table>
                <button id="save-map" class="btn btn-primary btn-sm" style="margin-top:10px">Guardar y Subir</button>
            </div>`;
        document.getElementById('file-in').addEventListener('change', handleFile);
    }
}

async function loadCommercials() {
    const list = document.getElementById('team-list');
    const q = query(collection(db, "commercials"), where("companyId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    list.innerHTML = snap.empty ? 'No hay comerciales.' : '';
    snap.forEach(doc => {
        const d = doc.data();
        list.innerHTML += `<div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between">
            <span>${d.name} (${d.email})</span>
            <span class="badge" style="color:var(--accent); font-weight:700">${d.code}</span>
        </div>`;
    });
}

let tempFileData = [];
function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target.result;
        let data = [];
        if (file.name.endsWith('.csv')) {
            Papa.parse(bstr, { header: true, complete: (res) => { data = res.data; showMapping(res.meta.fields, data); }});
        } else {
            const wb = XLSX.read(bstr, {type:'binary'});
            data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            showMapping(Object.keys(data[0]), data);
        }
    };
    reader.readAsBinaryString(file);
}

function showMapping(headers, data) {
    tempFileData = data;
    document.getElementById('mapping-area').style.display='block';
    const body = document.getElementById('map-body');
    body.innerHTML = '';
    headers.forEach(h => {
        body.innerHTML += `<tr>
            <td>${h}</td>
            <td><input type="text" class="form-control map-custom" value="${h}" data-orig="${h}"></td>
            <td><input type="checkbox" class="map-vis" checked></td>
        </tr>`;
    });
    document.getElementById('save-map').onclick = () => uploadData();
}

async function uploadData() {
    const mapping = {};
    document.querySelectorAll('.map-custom').forEach((el, i) => {
        const vis = document.querySelectorAll('.map-vis')[i].checked;
        mapping[el.dataset.orig] = { name: el.value, vis };
    });

    const btn = document.getElementById('save-map');
    const originalHtml = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = `<div class="spinner"></div><span>Subiendo...</span>`;
        
        let count = 0;
        for (const row of tempFileData) {
            const final = { companyId: auth.currentUser.uid };
            let hasData = false;
            Object.keys(row).forEach(k => {
                if (mapping[k] && mapping[k].vis) {
                    final[mapping[k].name] = row[k];
                    hasData = true;
                }
            });
            if (hasData) {
                await addDoc(collection(db, "clients"), final);
                count++;
            }
        }
        showToast(`Se han subido ${count} clientes correctamente`, "success");
        closeModal();
        if (pageTitle.innerText === 'Clientes') loadClientsList();
    } catch (err) {
        showToast("Error al subir datos: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// --- CLIENTS LIST ---
async function loadClientsList() {
    const list = document.getElementById('clients-list');
    const q = query(collection(db, "clients"), where("companyId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    if (snap.empty) { list.innerHTML = 'No hay datos.'; return; }
    let html = '<table class="mapping-table"><thead><tr>';
    const firstDoc = snap.docs[0].data();
    Object.keys(firstDoc).forEach(k => { if(k!=='companyId') html += `<th>${k}</th>`; });
    html += '</tr></thead><tbody>';
    snap.forEach(doc => {
        const d = doc.data();
        html += '<tr>';
        Object.keys(firstDoc).forEach(k => { if(k!=='companyId') html += `<td>${d[k] || ''}</td>`; });
        html += '</tr>';
    });
    list.innerHTML = html + '</tbody></table>';
}

// --- EXPORTAR A EXCEL ---
async function exportClientsToExcel() {
    const btn = document.getElementById('btn-export');
    const originalHtml = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = `<div class="spinner"></div><span>Exportando...</span>`;
        
        const q = query(collection(db, "clients"), where("companyId", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            showToast("No hay clientes para exportar", "info");
            return;
        }
        
        const data = [];
        snap.forEach(doc => {
            const d = doc.data();
            delete d.companyId; // No exportar el ID de empresa
            data.push(d);
        });
        
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
        
        // Generar nombre de archivo con fecha
        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Clientes_CRM_${date}.xlsx`);
        
        showToast("Archivo Excel generado con éxito", "success");
    } catch (err) {
        showToast("Error al exportar: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.querySelector('.user-name').innerText = user.email.split('@')[0];
        renderView('Panel');
    } else {
        document.querySelector('.user-name').innerText = "Iniciar Sesión";
        renderView('Landing');
    }
});
