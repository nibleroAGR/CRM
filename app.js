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
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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
const db = getFirestore(app); // Initialized Firestore as requested "para guardar datos"

// UI Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnGoogleLogin = document.getElementById('btn-google-login');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');
const userNameDisplay = document.getElementById('user-name');

// Authentication State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        showDashboard(user);
    } else {
        // User is signed out
        showLogin();
    }
});

// Helper functions for UI
function showDashboard(user) {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    userNameDisplay.textContent = user.displayName || user.email.split('@')[0];
}

function showLogin() {
    dashboardSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    authError.textContent = '';
    loginForm.reset();
}

function showError(message) {
    authError.textContent = message;
    // Shake effect could be added here
}

// Email/Password Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    if(!email || !password) {
        showError("Por favor, completa todos los campos.");
        return;
    }

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Signed in, observer will handle UI
            console.log("Logged in successfully", userCredential.user);
        })
        .catch((error) => {
            console.error("Login error:", error.code, error.message);
            showError("Credenciales incorrectas o error de conexión.");
        });
});

// Google Login
btnGoogleLogin.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            // Signed in with Google, observer will handle UI
            console.log("Logged in with Google successfully", result.user);
        })
        .catch((error) => {
            console.error("Google login error:", error.code, error.message);
            showError("Error al iniciar sesión con Google.");
        });
});

// Logout
btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        // Sign-out successful, observer will handle UI
        console.log("Logged out successfully");
    }).catch((error) => {
        console.error("Logout error:", error);
    });
});

// Placeholder Registration link (for future)
document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    alert("La función de registro estará disponible próximamente. Puedes usar el acceso con Google.");
});
