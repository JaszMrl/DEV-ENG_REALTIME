// ✅ Firebase Initialization
const firebaseConfig = {
    apiKey: "AIzaSyDX18_aJbcVXz3xcrQtxAL1WNcm7BO2U1k",
    authDomain: "english-app-2ede3.firebaseapp.com",
    projectId: "english-app-2ede3",
    storageBucket: "english-app-2ede3.firebasestorage.app",
    messagingSenderId: "46267452346",
    appId: "1:46267452346:web:81fb68d5836e0532c4ab83",
    measurementId: "G-Y9KXDJ6NFD"
};

// ✅ Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();  // ✅ Add this line


// ✅ Initialize Variables
let sentences = { basic: [], intermediateLow: [], intermediateHigh: [], advanced: [], native: [] };
let levels = ["Basic/Beginner", "Intermediate Low", "Intermediate High", "Advanced", "Native/Fluent"];
let currentLevelIndex = 0;
let testCount = 0;
const totalTests = 6;
let totalScore = 0;
let points = 0;
let recognition = null;
let usedSentences = {};

// ✅ Load Sentences
async function loadSentences() {
    try {
        const response = await fetch('/get-test-sentences');
        if (!response.ok) throw new Error(`Failed to fetch sentences: ${response.status}`);
        sentences = await response.json();
        console.log("✅ Sentences Loaded:", sentences);
    } catch (error) {
        console.error("❌ Error loading sentences:", error);
        document.getElementById("test-sentence").textContent = "Error loading sentences.";
    }
}

// ✅ Generate a New Sentence
async function generateSentence() {
    if (!sentences || Object.keys(sentences).length === 0) {
        console.log("⚠️ Sentences not loaded yet. Fetching...");
        await loadSentences();
    }

    let levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];
    let levelSentences = sentences[levelKey];

    if (!levelSentences || levelSentences.length === 0) {
        document.getElementById("test-sentence").textContent = "No sentences available.";
        return;
    }

    if (!usedSentences[levelKey]) {
        usedSentences[levelKey] = [...levelSentences].sort(() => Math.random() - 0.5);
    }

    let testSentence = usedSentences[levelKey].shift();
    document.getElementById("test-sentence").textContent = testSentence;

    // ✅ Enable "Speak" button
    document.getElementById("start-speech-btn").disabled = false;
}

// ✅ Initialize Speech Recognition
function initializeSpeechRecognition() {
    if (!recognition) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = function () {
            console.log("🎙️ Speech Recognition Started");
            document.getElementById("test-result").textContent = "Listening...";
            document.getElementById("stop-speech-btn").disabled = false;
        };

        recognition.onspeechend = function () {
            console.log("🛑 Speech ended, stopping recognition...");
            recognition.stop();
        };

        recognition.onresult = function (event) {
            let userSpeech = event.results[0][0].transcript;
            let targetSentence = document.getElementById("test-sentence").textContent;
            analyzeSpeech(targetSentence, userSpeech);
        };

        recognition.onerror = function (event) {
            console.error(`❌ Speech recognition error: ${event.error}`);
            alert(`Error with speech recognition: ${event.error}`);
        };
    }
}

function startSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("❌ Speech Recognition is not supported in this browser.");
        return;
    }

    if (recognition && recognition.running) {
        console.warn("⚠️ Speech recognition already running.");
        return;
    }

    // Ensure microphone permissions
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
            console.log("✅ Microphone access granted.");
            
            recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";

            recognition.onstart = function () {
                console.log("🎙️ Speech Recognition Started");
                document.getElementById("test-result").textContent = "Listening...";
                document.getElementById("stop-speech-btn").disabled = false;
            };

            recognition.onspeechend = function () {
                console.log("🛑 Speech ended, stopping recognition...");
                recognition.stop();
            };

            recognition.onresult = function (event) {
                let userSpeech = event.results[0][0].transcript;
                let targetSentence = document.getElementById("test-sentence").textContent;
                analyzeSpeech(targetSentence, userSpeech);
            };

            recognition.onerror = function (event) {
                console.error(`❌ Speech recognition error: ${event.error}`);
                alert(`Error with speech recognition: ${event.error}`);
            };

            recognition.start();
        })
        .catch(error => {
            console.error("❌ Microphone access blocked:", error);
            alert("❌ Microphone access is blocked. Enable it in your browser settings.");
        });
}

        // ✅ Stop Speech Recognition
        function stopSpeechRecognition() {
            if (recognition) {
                recognition.stop();
                console.log("🛑 Speech recognition stopped.");
            }
            document.getElementById("test-result").textContent = "Speech recognition stopped.";
            document.getElementById("stop-speech-btn").disabled = true;
}

// ✅ Function to Save Test Score in Firestore
function saveTestScore(userId, score, level, accuracy) {
    if (!userId) {
        console.error("❌ Error: User ID is undefined.");
        return;
    }

    const userRef = db.collection("users").doc(userId);

    userRef.get().then((doc) => {
        let userData = doc.exists ? doc.data() : {};

        // ✅ Ensure all values are numbers before using them
        let totalAccuracy = userData.totalAccuracy || 0;
        let totalTests = userData.totalTests || 0;
        let totalScore = userData.score || 0;

        // ✅ Prevent division by zero
        if (isNaN(totalAccuracy) || isNaN(totalTests) || isNaN(totalScore)) {
            totalAccuracy = 0;
            totalTests = 0;
            totalScore = 0;
        }

        totalAccuracy += accuracy;
        totalTests += 1;
        totalScore += score;

        let overallAccuracy = totalTests > 0 ? (totalAccuracy / totalTests).toFixed(2) : "0.00";
        let normalizedScore = totalTests > 0 ? (totalScore / totalTests).toFixed(2) : "0.00";

        userRef.set({
            score: normalizedScore,
            level: level,
            totalAccuracy: totalAccuracy,
            totalTests: totalTests,
            overallAccuracy: overallAccuracy
        }, { merge: true })
        .then(() => console.log(`✅ Accuracy and score updated for ${userId}`))
        .catch(error => console.error("❌ Error saving accuracy:", error));
    });
}

// ✅ Function to Get User Score from Firestore
function getTestScore(userId) {
    if (!userId) {
        console.error("❌ Error: User ID is undefined.");
        return;
    }

    const userRef = db.collection("users").doc(userId);
    userRef.get()
        .then((doc) => {
            if (doc.exists) {
                let data = doc.data();
                console.log(`✅ User Data:`, data);

                let scoreElement = document.getElementById("user-score");
                let levelElement = document.getElementById("user-level");
                let accuracyElement = document.getElementById("user-accuracy");

                if (scoreElement) scoreElement.textContent = data.score || "0.00";
                else console.warn("⚠️ Warning: #user-score element not found.");

                if (levelElement) levelElement.textContent = data.level || "Unknown";
                else console.warn("⚠️ Warning: #user-level element not found.");

                if (accuracyElement) accuracyElement.textContent = data.overallAccuracy ? `${data.overallAccuracy}%` : "0.00%";
                else console.warn("⚠️ Warning: #user-accuracy element not found.");
            } else {
                console.log("❌ No test score found.");
            }
        })
        .catch(error => console.error("❌ Error fetching score:", error));
}


// ✅ Analyze Speech and Update Firestore
async function analyzeSpeech(targetSentence, userSpeech) {
    const user = auth.currentUser;
    if (!user) {
        console.error("❌ No authenticated user. Cannot save score.");
        return;
    }

    const userId = user.uid;

    try {
        let strictnessLevels = ["medium", "high", "very_high"];
        let currentStrictness = strictnessLevels[currentLevelIndex] || "medium";

        const response = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_sentence: targetSentence, user_speech: userSpeech, strictness: currentStrictness })
        });

        if (!response.ok) throw new Error("Failed to analyze pronunciation.");
        const result = await response.json();
        let accuracy = result.accuracy || 0;
        let level = levels[currentLevelIndex]; // ✅ Get current level

        totalScore += accuracy;
        testCount++;

        if (accuracy >= 80) points++;

        console.log(`✅ Accuracy: ${accuracy} | Points: ${points} | Test Count: ${testCount}`);
        document.getElementById('points').textContent = points;

        document.getElementById('test-result').innerHTML = `
            <p><strong>Target Sentence:</strong> "${targetSentence}"</p>
            <p><strong>Your Speech:</strong> "${userSpeech}"</p>
            <p><strong>Pronunciation Accuracy:</strong> ${accuracy.toFixed(2)}%</p>
        `;

        // ✅ Save overall accuracy
        saveTestScore(userId, totalScore, level, accuracy);

        if (testCount >= totalTests) {
            adjustLevel(userId);
        }
    } catch (error) {
        console.error("❌ Error analyzing speech:", error);
        document.getElementById('test-result').textContent = "Error analyzing speech.";
    }
}


// ✅ Adjust User Level
function adjustLevel(userId) {
    console.log(`🔥 Checking Level-Up: Points: ${points}, Level: ${levels[currentLevelIndex]}`);

    if (points >= 3 && currentLevelIndex < levels.length - 1) {
        currentLevelIndex++;
        let newLevel = levels[currentLevelIndex];

        document.getElementById("current-level").textContent = newLevel;
        alert(`🎉 You have leveled up to ${newLevel}!`);

        saveTestScore(userId, totalScore / totalTests, newLevel);
        points = 0;
        testCount = 0;
        totalScore = 0;
        usedSentences = {};
        document.getElementById('points').textContent = points;
    } else if (currentLevelIndex >= levels.length - 1) {
        alert("🏆 You have reached the highest level! Keep practicing!");
    }
}

// ✅ Load User Data on Dashboard
function loadUserStats(userId) {
    if (!userId) {
        console.error("❌ Error: User ID is undefined.");
        return;
    }
    getTestScore(userId);
}

document.addEventListener("DOMContentLoaded", function () { 
    initializeSpeechRecognition();
    loadSentences();

    auth.onAuthStateChanged(user => {
        if (user) {
            const userId = user.uid;
            console.log("✅ Logged-in User ID:", userId);

            // ✅ Load user stats only if score elements exist
            if (document.getElementById("user-score") && document.getElementById("user-level")) {
                getTestScore(userId);
            } else {
                console.warn("⚠️ Score elements not found. Skipping score update.");
            }

            document.getElementById("generate-btn")?.addEventListener("click", generateSentence);
            document.getElementById("start-speech-btn")?.addEventListener("click", () => startSpeechRecognition(userId));
        } else {
            console.error("❌ No user logged in.");
            alert("You must be logged in to save scores.");
        }
    });
});

