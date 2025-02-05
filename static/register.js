// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDX18_aJbcVXz3xcrQtxAL1WNcm7BO2U1k",
  authDomain: "english-app-2ede3.firebaseapp.com",
  projectId: "english-app-2ede3",
  storageBucket: "english-app-2ede3.firebasestorage.app",
  messagingSenderId: "46267452346",
  appId: "1:46267452346:web:81fb68d5836e0532c4ab83",
  measurementId: "G-Y9KXDJ6NFD",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded");

    // DOM Elements
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const toggleLogin = document.getElementById("toggle-login");
    const toggleRegister = document.getElementById("toggle-register");
    const userInfoSection = document.getElementById("user-info");

    // Toggle Forms
    toggleLogin.addEventListener("click", () => {
        loginForm.style.display = "block";
        registerForm.style.display = "none";
    });

    toggleRegister.addEventListener("click", () => {
        loginForm.style.display = "none";
        registerForm.style.display = "block";
    });

    // Handle Login
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        signInWithEmailAndPassword(auth, email, password)
            .then(() => alert("Login successful!"))
            .catch((error) => alert(error.message));
    });

    // Handle Registration
    registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const school = document.getElementById("school").value;
        const grade = document.getElementById("grade").value;

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;

                // Save additional user info to Firestore
                setDoc(doc(db, "users", user.uid), {
                    name,
                    email,
                    school,
                    grade,
                }).then(() => {
                    alert("Registration successful!");
                    location.reload();
                });
            })
            .catch((error) => alert(error.message));
    });

    // Handle Logout
    const logoutButton = document.getElementById("logout-btn");
    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            signOut(auth).then(() => {
                alert("Logged out successfully!");
                location.reload();
            });
        });
    }
});
