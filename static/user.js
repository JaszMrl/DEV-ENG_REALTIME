// ✅ Ensure the DOM is fully loaded before running scripts
document.addEventListener("DOMContentLoaded", function () {

    // ✅ Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyDX18_aJbcVXz3xcrQtxAL1WNcm7BO2U1k",
        authDomain: "english-app-2ede3.firebaseapp.com",
        projectId: "english-app-2ede3",
        storageBucket: "english-app-2ede3.firebasestorage.app",
        messagingSenderId: "46267452346",
        appId: "1:46267452346:web:81fb68d5836e0532c4ab83",
        measurementId: "G-Y9KXDJ6NFD"
    };

    // ✅ Ensure Firebase is available before using it
    if (typeof firebase === "undefined") {
        console.error("❌ Firebase is not defined. Check if Firebase is properly included in your HTML.");
        return;
    }

    // ✅ Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();

    // ✅ Get all elements safely
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const userProfile = document.getElementById("user-profile");
    const loginBtn = document.getElementById("login-btn");
    const signupBtn = document.getElementById("signup-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const showSignup = document.getElementById("show-signup");
    const showLogin = document.getElementById("show-login");

    // ✅ Check if elements exist before adding event listeners
    if (showSignup) {
        showSignup.addEventListener("click", function (event) {
            event.preventDefault();
            console.log("Switching to sign-up form");
            loginForm.style.display = "none";
            signupForm.style.display = "block";
        });
    }

    if (showLogin) {
        showLogin.addEventListener("click", function (event) {
            event.preventDefault();
            console.log("Switching to login form");
            signupForm.style.display = "none";
            loginForm.style.display = "block";
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener("click", function () {
            const name = document.getElementById("signup-name").value;
            const email = document.getElementById("signup-email").value;
            const password = document.getElementById("signup-password").value;

            if (name === "" || email === "" || password === "") {
                alert("❌ Please fill all fields!");
                return;
            }

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    let user = userCredential.user;
                    console.log("✅ User Created:", user);

                    return user.updateProfile({
                        displayName: name
                    }).then(() => {
                        alert("🎉 Account Created Successfully!");
                        window.location.reload();
                    });
                })
                .catch(error => {
                    console.error("❌ Sign-Up Error:", error);
                    alert(error.message);
                });
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener("click", function () {
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;

            if (email === "" || password === "") {
                alert("❌ Please enter both email and password!");
                return;
            }

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    console.log("✅ User Logged In!");
                    window.location.reload();
                })
                .catch(error => {
                    console.error("❌ Login Error:", error);
                    alert(error.message);
                });
        });
    }

    // ✅ Check if user is logged in
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("✅ User is logged in:", user);
            if (loginForm) loginForm.style.display = "none";
            if (signupForm) signupForm.style.display = "none";
            if (userProfile) userProfile.style.display = "block";

            document.getElementById("user-name").textContent = user.displayName || "User";
            document.getElementById("user-email").textContent = user.email;
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            auth.signOut().then(() => {
                console.log("✅ User Logged Out");
                alert("✅ Logged Out Successfully!");
                window.location.reload();
            }).catch(error => {
                console.error("❌ Logout Error:", error);
                alert(error.message);
            });
        });
    }

});
