/**
 * auth.js — Firebase Authentication (Google + Email/Password)
 */

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDQ_EfOL_VR8mSVtd21DB0WK7-2RBnyJS8",
    authDomain: "smartcart-6de46.firebaseapp.com",
    projectId: "smartcart-6de46",
    storageBucket: "smartcart-6de46.firebasestorage.app",
    messagingSenderId: "1044530004262",
    appId: "1:1044530004262:web:c7fa206ccf0b6f083841e7",
    measurementId: "G-FQPT6P0FQ4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

let currentTab = "login";

// ========================
// UI HELPERS
// ========================

/* showToast is provided globally by toast.js which loads before auth.js */

function showError(msg) {
    const el = document.getElementById("auth-error");
    el.textContent = msg;
    el.classList.remove("hidden");
}

function hideError() {
    document.getElementById("auth-error").classList.add("hidden");
}

function setLoading(loading) {
    const btn = document.getElementById("btn-auth-submit");
    const google = document.getElementById("btn-google");
    if (loading) {
        btn.disabled = true;
        google.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Please wait...</span>';
    } else {
        btn.disabled = false;
        google.disabled = false;
        const text = currentTab === "login" ? "Login" : "Create Account";
        btn.innerHTML = `<i class="fas fa-arrow-right-to-bracket"></i> <span id="btn-auth-text">${text}</span>`;
    }
}

function switchTab(tab) {
    currentTab = tab;
    hideError();

    document.getElementById("tab-login").classList.toggle("active", tab === "login");
    document.getElementById("tab-signup").classList.toggle("active", tab === "signup");
    document.getElementById("name-field").classList.toggle("hidden", tab === "login");

    const btnText = document.getElementById("btn-auth-text");
    if (btnText) btnText.textContent = tab === "login" ? "Login" : "Create Account";
}

function togglePassword() {
    const input = document.getElementById("auth-password");
    const icon = document.getElementById("eye-icon");
    if (input.type === "password") {
        input.type = "text";
        icon.className = "fas fa-eye-slash text-sm";
    } else {
        input.type = "password";
        icon.className = "fas fa-eye text-sm";
    }
}

// ========================
// SEND TOKEN TO BACKEND
// ========================

async function verifyWithBackend(user) {
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: idToken })
    });
    const data = await res.json();
    if (data.success) {
        // Redirect based on role
        if (data.user && data.user.role === "admin") {
            window.location.href = "/admin/dashboard";
        } else {
            window.location.href = "/";
        }
    } else {
        showError(data.error || "Authentication failed");
    }
}

// ========================
// EMAIL/PASSWORD AUTH
// ========================

async function handleEmailAuth() {
    hideError();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const name = document.getElementById("auth-name").value.trim();

    if (!email || !password) {
        showError("Please fill in all fields");
        return;
    }

    if (currentTab === "signup" && !name) {
        showError("Please enter your name");
        return;
    }

    if (password.length < 6) {
        showError("Password must be at least 6 characters");
        return;
    }

    setLoading(true);
    try {
        let userCredential;
        if (currentTab === "signup") {
            userCredential = await auth.createUserWithEmailAndPassword(email, password);
            // Set display name
            await userCredential.user.updateProfile({ displayName: name });
        } else {
            userCredential = await auth.signInWithEmailAndPassword(email, password);
        }
        await verifyWithBackend(userCredential.user);
    } catch (err) {
        let msg = "Authentication failed";
        switch (err.code) {
            case "auth/user-not-found": msg = "No account found with this email"; break;
            case "auth/wrong-password": msg = "Incorrect password"; break;
            case "auth/email-already-in-use": msg = "Email already registered. Try logging in."; break;
            case "auth/invalid-email": msg = "Invalid email address"; break;
            case "auth/weak-password": msg = "Password is too weak"; break;
            case "auth/too-many-requests": msg = "Too many attempts. Try again later."; break;
            case "auth/invalid-credential": msg = "Invalid email or password"; break;
            default: msg = err.message;
        }
        showError(msg);
        setLoading(false);
    }
}

// ========================
// GOOGLE AUTH
// ========================

async function handleGoogleLogin() {
    hideError();
    setLoading(true);
    try {
        const result = await auth.signInWithPopup(googleProvider);
        await verifyWithBackend(result.user);
    } catch (err) {
        if (err.code !== "auth/popup-closed-by-user") {
            showError(err.message || "Google login failed");
        }
        setLoading(false);
    }
}

// ========================
// KEYBOARD SUBMIT
// ========================

document.getElementById("auth-form").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        handleEmailAuth();
    }
});
