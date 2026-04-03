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

// Inicializar Firebase con Manejo de Errores
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase inicializado correctamente.");
} catch (error) {
    console.error("Fallo al inicializar Firebase:", error);
}

// --- SELECTORES DOM ---
const modal = document.getElementById('modal-container');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const loginBtn = document.getElementById('login-trigger');
const settingsBtn = document.getElementById('settings-btn');
const mainView = document.getElementById('main-view');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');

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
    console.log("Renderizando vista:", viewName);
    switch(viewName) {
        case 'Panel':
            mainView.innerHTML = `
                <div class="dashboard-content">
                    <h2>Resumen de Actividad</h2>
                    <p>Cargando datos del equipo...</p>
                </div>`;
            break;
        case 'Clientes':
            mainView.innerHTML = `<h2>Base de Datos</h2><p>Leads y oportunidades comerciales.</p>`;
            break;
        case 'Landing':
            mainView.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="shield-check"></i>
                    <h2>Bienvenido</h2>
                    <p>Inicia sesión para gestionar el equipo.</p>
                </div>`;
            break;
        default:
            mainView.innerHTML = `<h2>Vista ${viewName}</h2>`;
    }
    if (window.lucide) window.lucide.createIcons();
}

// --- GESTIÓN DE MODALES ---
function openModal(title, contentHTML) {
    console.log("Abriendo modal:", title);
    modalTitle.innerText = title;
    modalContent.innerHTML = contentHTML;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
}

function closeModal() {
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

document.querySelector('.close-modal').addEventListener('click', closeModal);

// Cerrar modal al hacer clic fuera (Overlay)
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}

// --- AUTENTICACIÓN ---
function renderAuthForm(mode = 'login') {
    let authHTML = '';
    let title = 'Acceso';

    if (mode === 'login') {
        title = 'Iniciar Sesión';
        authHTML = `
            <form id="auth-form">
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" id="email" class="form-control" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Contraseña</label>
                    <input type="password" id="password" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%">Ingresar</button>
                <div style="text-align:center; margin-top:15px; font-size:13px;">
                    <a href="#" id="go-recover">¿Has olvidado tu contraseña?</a><br><br>
                    ¿Eres nuevo? <a href="#" id="go-signup">Crea una cuenta</a>
                </div>
            </form>
        `;
    } else if (mode === 'signup') {
        title = 'Nueva Cuenta';
        authHTML = `
            <form id="auth-form">
                <div class="form-group">
                    <label class="form-label">Email Empresa</label>
                    <input type="email" id="email" class="form-control" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Contraseña</label>
                    <input type="password" id="password" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%">Registrarse</button>
                <p style="text-align:center; margin-top:15px; font-size:13px;">
                    <a href="#" id="go-login">Volver al login</a>
                </p>
            </form>
        `;
    } else if (mode === 'recover') {
        title = 'Recuperar Cuenta';
        authHTML = `
            <form id="auth-form">
                <p style="font-size:13px; margin-bottom:15px;">Te enviaremos un email para restablecer tu clave.</p>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" id="email" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%">Enviar Email</button>
                <p style="text-align:center; margin-top:15px; font-size:13px;">
                    <a href="#" id="go-login">Volver al login</a>
                </p>
            </form>
        `;
    }

    openModal(title, authHTML);

    // Eventos del formulario
    document.getElementById('go-signup')?.addEventListener('click', (e) => { e.preventDefault(); renderAuthForm('signup'); });
    document.getElementById('go-login')?.addEventListener('click', (e) => { e.preventDefault(); renderAuthForm('login'); });
    document.getElementById('go-recover')?.addEventListener('click', (e) => { e.preventDefault(); renderAuthForm('recover'); });

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password')?.value;

        try {
            if (mode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else if (mode === 'signup') {
                await createUserWithEmailAndPassword(auth, email, password);
            } else if (mode === 'recover') {
                await sendPasswordResetEmail(auth, email);
                alert("Email enviado.");
            }
            closeModal();
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}

// Trigger de login
loginBtn.addEventListener('click', () => {
    console.log("Login Btn Clicked. User:", auth.currentUser);
    if (auth.currentUser) {
        if (confirm("Cerrar sesión de " + auth.currentUser.email + "?")) {
            signOut(auth);
        }
    } else {
        renderAuthForm('login');
    }
});

// Configuración
settingsBtn.addEventListener('click', () => {
    if (!auth.currentUser) {
        alert("Inicia sesión primero.");
        return;
    }
    openModal('Equipo', `<div>Panel de configuración de comerciales.</div>`);
});

// Listener Auth
onAuthStateChanged(auth, (user) => {
    console.log("Estado de Auth cambiado:", user ? user.email : "Desconectado");
    if (user) {
        document.querySelector('.user-name').innerText = user.email.split('@')[0];
        document.querySelector('.user-role').innerText = "Empresa";
        renderView('Panel');
    } else {
        document.querySelector('.user-name').innerText = "Iniciar Sesión";
        document.querySelector('.user-role').innerText = "Empresa";
        renderView('Landing');
    }
});
