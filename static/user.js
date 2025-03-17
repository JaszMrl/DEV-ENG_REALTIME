document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Document Loaded!");

    // ✅ Ensure Firebase is initialized
    if (!firebase.apps.length) {
        const firebaseConfig = {
            apiKey: "AIzaSyDX18_aJbcVXz3xcrQtxAL1WNcm7BO2U1k",
            authDomain: "english-app-2ede3.firebaseapp.com",
            projectId: "english-app-2ede3",
            storageBucket: "english-app-2ede3.appspot.com",
            messagingSenderId: "46267452346",
            appId: "1:46267452346:web:81fb68d5836e0532c4ab83",
            measurementId: "G-Y9KXDJ6NFD"
        };
        firebase.initializeApp(firebaseConfig);
        console.log("✅ Firebase initialized.");
    } else {
        console.log("⚠️ Firebase already initialized.");
    }

    // ✅ Initialize Firebase Services
    const auth = firebase.auth();
    const db = firebase.firestore();

    console.log("✅ Firebase Services Loaded:", { auth, db });

    // ✅ Get Elements
    const loginBtn = document.getElementById("login-btn");
    const signupBtn = document.getElementById("signup-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const showSignupBtn = document.getElementById("show-signup");
    const showLoginBtn = document.getElementById("show-login");
    const updateInfoBtn = document.getElementById("update-info-btn");

    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const userProfile = document.getElementById("user-profile");

    // ✅ Toggle Between Login & Signup Forms
    if (showSignupBtn) {
        showSignupBtn.addEventListener("click", function () {
            console.log("🔄 Switching to Signup Form");
            loginForm.style.display = "none";
            signupForm.style.display = "block";
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener("click", function () {
            console.log("🔄 Switching to Login Form");
            loginForm.style.display = "block";
            signupForm.style.display = "none";
        });
    }

    // ✅ Handle Sign Up
    if (signupBtn) {
        signupBtn.addEventListener("click", function () {
            console.log("🚀 Sign-Up Button Clicked!");

            const name = document.getElementById("signup-name").value.trim();
            const email = document.getElementById("signup-email").value.trim();
            const password = document.getElementById("signup-password").value.trim();

            if (!name || !email || !password) {
                alert("❌ Please fill all fields!");
                return;
            }

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    console.log("✅ User Created:", user);

                    // ✅ Store User in Firestore
                    return db.collection("users").doc(user.uid).set({
                        fullName: name,
                        email: email,
                        isAdmin: false,
                        gender: "",
                        age: "",
                        nationality: "",
                        overallAccuracy: "0.00",
                        streak: 0
                    }).then(() => {
                        console.log("✅ User Data Saved to Firestore");

                        // ✅ Update Firebase Auth Profile
                        return user.updateProfile({ displayName: name });
                    }).then(() => {
                        alert("🎉 Account Created Successfully! Please log in.");
                        window.location.reload();
                    });
                })
                .catch(error => {
                    console.error("❌ Sign-Up Error:", error);
                    alert(error.message);
                });
        });
    }

    // ✅ Handle Login
    if (loginBtn) {
        loginBtn.addEventListener("click", function () {
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;

            if (!email || !password) {
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

    // ✅ Handle Logout
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            auth.signOut()
                .then(() => {
                    console.log("✅ User Logged Out");
                    alert("✅ Logged Out Successfully!");
                    window.location.href = "/"; // Redirect to login page
                })
                .catch(error => {
                    console.error("❌ Logout Error:", error);
                    alert(error.message);
                });
        });
    }

    // ✅ Load User Data After Login
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("✅ User Logged In:", user);

            loginForm.style.display = "none";
            signupForm.style.display = "none";
            userProfile.style.display = "block";

            document.getElementById("user-name").textContent = user.displayName || "User";
            document.getElementById("user-email").textContent = user.email || "-";

            loadUserData(user.uid);
        } else {
            console.log("⚠️ No user is logged in.");

            loginForm.style.display = "block";
            signupForm.style.display = "none";
            userProfile.style.display = "none";
        }
    });

    // ✅ Handle Toggle for Update Profile Form
    const toggleUpdateFormBtn = document.getElementById("toggle-update-form");
    const updateInfoContainer = document.getElementById("update-info-container");

    if (toggleUpdateFormBtn) {
        toggleUpdateFormBtn.addEventListener("click", function () {
            if (updateInfoContainer.style.display === "none" || updateInfoContainer.style.display === "") {
                updateInfoContainer.style.display = "block"; // Show form
                toggleUpdateFormBtn.textContent = "🔽 Hide Form"; // Change button text
            } else {
                updateInfoContainer.style.display = "none"; // Hide form
                toggleUpdateFormBtn.textContent = "✏️ Edit Profile"; // Reset button text
            }
        });
    }


    // ✅ Handle Profile Update
    if (updateInfoBtn) {
        updateInfoBtn.addEventListener("click", function () {
            const user = auth.currentUser;

            if (!user) {
                alert("❌ No user logged in.");
                return;
            }

            const fullName = document.getElementById("update-fullname").value.trim();
            const gender = document.getElementById("update-gender").value;
            const age = parseInt(document.getElementById("update-age").value, 10);
            const nationality = document.getElementById("update-nationality").value.trim();

            if (!fullName || !gender || isNaN(age) || !nationality) {
                alert("❌ Please fill in all fields correctly.");
                return;
            }

            db.collection("users").doc(user.uid).set({
                fullName: fullName,
                gender: gender,
                age: age,
                nationality: nationality
            }, { merge: true })
            .then(() => {
                alert("✅ Information updated successfully!");
                loadUserData(user.uid);
            })
            .catch(error => {
                console.error("❌ Error updating user info:", error);
            });
        });
    }

    // ✅ Load User Data from Firestore
    function loadUserData(userId) {
        db.collection("users").doc(userId).get().then((doc) => {
            if (doc.exists) {
                let data = doc.data();

                document.getElementById("user-fullname").textContent = data.fullName || "-";
                document.getElementById("user-gender").textContent = data.gender || "-";
                document.getElementById("user-age").textContent = data.age || "-";
                document.getElementById("user-nationality").textContent = data.nationality || "-";

                console.log("✅ User Data Loaded:", data);
            } else {
                console.log("❌ No user data found.");
            }
        }).catch(error => console.error("❌ Error fetching user data:", error));
    }
});
