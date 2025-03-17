document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Forgot Password Page Loaded!");

    // ✅ Firebase Configuration (Ensure Firebase is initialized)
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

    // ✅ Reset Password Function
    const resetBtn = document.getElementById("reset-btn");
    
    if (resetBtn) {
        resetBtn.addEventListener("click", function () {
            const email = document.getElementById("reset-email").value.trim();

            if (!email) {
                alert("❌ Please enter your email!");
                return;
            }

            firebase.auth().sendPasswordResetEmail(email)
                .then(() => {
                    alert("✅ Password reset email sent! Check your inbox.");
                    window.location.href = "/user"; // Redirect back to login
                })
                .catch(error => {
                    console.error("❌ Error sending reset email:", error);
                    alert(error.message);
                });
        });
    }
});
