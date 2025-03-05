// ✅ Ensure Firebase is initialized only ONCE
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Document is ready.");

    // ✅ Check if Firebase has already been initialized
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
    const storage = firebase.storage();

    console.log("✅ Firebase Services Initialized:", {
        authLoaded: auth ? "✅ Yes" : "❌ No",
        dbLoaded: db ? "✅ Yes" : "❌ No",
        storageLoaded: storage ? "✅ Yes" : "❌ No"
    });

    // ✅ Ensure elements exist before adding event listeners
    const loginBtn = document.getElementById("login-btn");
    const signupBtn = document.getElementById("signup-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const toggleUpdateFormBtn = document.getElementById("toggle-update-form");
    const updateInfoBtn = document.getElementById("update-info-btn");

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

    // ✅ Handle Signup
    if (signupBtn) {
        signupBtn.addEventListener("click", function () {
            const name = document.getElementById("signup-name").value;
            const email = document.getElementById("signup-email").value;
            const password = document.getElementById("signup-password").value;

            if (!name || !email || !password) {
                alert("❌ Please fill all fields!");
                return;
            }

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    let user = userCredential.user;
                    console.log("✅ User Created:", user);

                    return user.updateProfile({
                        displayName: name  // ✅ Set the name in Firebase Auth
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

    // ✅ Listen for Authentication Changes
    auth.onAuthStateChanged(user => {
        const loginForm = document.getElementById("login-form");
        const userProfile = document.getElementById("user-profile");
        const userName = document.getElementById("user-name");
        const userEmail = document.getElementById("user-email");

        if (user) {
            console.log("✅ User is logged in:", user);

            // Hide login form and show user profile
            if (loginForm) loginForm.style.display = "none";
            if (userProfile) userProfile.style.display = "block";

            // Show user data
            if (userName) userName.textContent = user.displayName || "User";
            if (userEmail) userEmail.textContent = user.email || "-";

            // Load user data from Firestore
            loadUserData(user.uid);

            // Ensure logout button is visible
            if (logoutBtn) logoutBtn.style.display = "block";
        } else {
            console.log("⚠️ No user is logged in.");

            // Show login form and hide user profile
            if (loginForm) loginForm.style.display = "block";
            if (userProfile) userProfile.style.display = "none";

            // Hide logout button
            if (logoutBtn) logoutBtn.style.display = "none";
        }
    });

    // ✅ Toggle Update Form Visibility
    if (toggleUpdateFormBtn) {
        toggleUpdateFormBtn.addEventListener("click", function () {
            const updateForm = document.getElementById("update-info-container");
            if (updateForm.style.display === "none" || updateForm.style.display === "") {
                updateForm.style.display = "block";
                toggleUpdateFormBtn.textContent = "🔽 Hide Form";
            } else {
                updateForm.style.display = "none";
                toggleUpdateFormBtn.textContent = "✏️ Edit Profile";
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
});

// ✅ Load User Data from Firestore
function loadUserData(userId) {
    const userRef = firebase.firestore().collection("users").doc(userId);

    userRef.get().then((doc) => {
        if (doc.exists) {
            let data = doc.data();

            document.getElementById("user-fullname").textContent = data.fullName || "-";
            document.getElementById("user-gender").textContent = data.gender || "-";
            document.getElementById("user-age").textContent = data.age || "-";
            document.getElementById("user-nationality").textContent = data.nationality || "-";

            if (data.profilePic) {
                document.getElementById("user-photo").src = data.profilePic; // ✅ Show Profile Picture
            }
        } else {
            console.log("❌ No user data found.");
        }
    }).catch(error => console.error("❌ Error fetching user data:", error));
}

// ✅ Debugging logs
console.log("✅ Firebase App:", firebase.apps);
console.log("✅ Firestore Instance:", firebase.firestore ? "Available" : "❌ Firestore NOT Available!");
console.log("✅ Auth Instance:", firebase.auth ? "Available" : "❌ Auth NOT Available!");
