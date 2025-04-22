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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let sentences = { basic: [], intermediateLow: [], intermediateHigh: [], advanced: [], native: [] };
let levels = ["Basic/Beginner", "Intermediate Low", "Intermediate High", "Advanced", "Native/Fluent"];
let currentLevelIndex = 0;
let testCount = 0;
let totalScore = 0;
let points = 0;
let recognition = null;
let usedSentences = {};
let levelCorrectCount = 0;
let levelSentenceCount = 0;
let levelScoreHistory = [];

async function loadSentences() {
    try {
        const snapshot = await db.collection("sentences").get();

        snapshot.forEach(doc => {
            const level = doc.id;  
            const data = doc.data();

            if (Array.isArray(data.list)) {
                sentences[level] = data.list;
            } else {
                console.warn(`⚠️ No sentence list found for level: ${level}`);
            }
        });

        console.log("✅ Loaded sentences from Firebase:", sentences);
    } catch (error) {
        console.error("❌ Error loading sentences from Firebase:", error);
        document.getElementById("test-sentence").textContent = "Error loading sentences.";
    }
}

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

    document.getElementById("start-speech-btn").disabled = false;
}

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

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
            recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";

            recognition.onstart = function () {
                document.getElementById("test-result").textContent = "Listening...";
                document.getElementById("stop-speech-btn").disabled = false;
            };

            recognition.onspeechend = function () {
                recognition.stop();
            };

            recognition.onresult = function (event) {
                let userSpeech = event.results[0][0].transcript;
                let targetSentence = document.getElementById("test-sentence").textContent;
                analyzeSpeech(targetSentence, userSpeech);
            };

            recognition.onerror = function (event) {
                alert(`Error with speech recognition: ${event.error}`);
            };

            recognition.start();
        })
        .catch(error => {
            alert("❌ Microphone access is blocked.");
        });
}

function stopSpeechRecognition() {
    if (recognition) recognition.stop();
    document.getElementById("test-result").textContent = "Speech recognition stopped.";
    document.getElementById("stop-speech-btn").disabled = true;
}

function analyzeSpeech(targetSentence, userSpeech) {
    const user = auth.currentUser;
    if (!user || !targetSentence || !userSpeech) return;

    const userId = user.uid;

    fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            target_sentence: targetSentence.trim(),
            user_speech: userSpeech.trim(),
            strictness: ["medium", "high", "very_high"][currentLevelIndex],
            language: "en-US"
        })
    })
    .then(res => res.json())
    .then(result => {
        let accuracy = result.accuracy || 0;
        let level = levels[currentLevelIndex];

        if (accuracy >= 85) levelCorrectCount++;
        levelSentenceCount++;
        // ✅ Update score live after each sentence
        let liveScore = (levelCorrectCount / levelSentenceCount) * 5;
        document.getElementById('normalized-score').textContent = liveScore.toFixed(2);
        document.getElementById('raw-score-detail').textContent = `(Correct: ${levelCorrectCount} / ${levelSentenceCount})`;        

        let progressBar = document.getElementById('level-progress');
        if (progressBar && levelSentenceCount > 0) {
            let levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];
            let total = sentences[levelKey]?.length || 1;
            progressBar.max = total;
            progressBar.value = levelSentenceCount;
        }

        document.getElementById("test-result").innerHTML = `
            <p><strong>Target Sentence:</strong> "${targetSentence}"</p>
            <p><strong>Your Speech:</strong> "${userSpeech}"</p>
            <p><strong>Pronunciation Accuracy:</strong> ${accuracy.toFixed(2)}%</p>
        `;

        // ✅ Trigger score check when level is complete
        let levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];

        setTimeout(() => {
            if (usedSentences[levelKey] && usedSentences[levelKey].length === 0) {
                evaluateLevelProgress(userId);
            }
        }, 100);  // small delay ensures counting is done before checking

    })
    .catch(error => {
        console.error("❌ Error analyzing speech:", error);
    });

    document.getElementById('normalized-score').textContent = levelScore.toFixed(2);
    document.getElementById('raw-score-detail').textContent = `(Correct: ${levelCorrectCount} / ${levelSentenceCount})`;

}

function evaluateLevelProgress(userId) {
    let levelScore = (levelCorrectCount / levelSentenceCount) * 5;
    levelScore = parseFloat(levelScore.toFixed(2));

    console.log("Updating score UI...");
    document.getElementById('normalized-score').textContent = levelScore.toFixed(2);
    document.getElementById('raw-score-detail').textContent = `(Correct: ${levelCorrectCount} / ${levelSentenceCount})`;

    const userRef = db.collection("users").doc(userId);
    const levelName = levels[currentLevelIndex];

    userRef.set({
        [`levelScores.${levelName}`]: levelScore
    }, { merge: true }).then(() => {
        console.log(`✅ Saved ${levelName} score: ${levelScore}`);
    }).catch((error) => {
        console.error("❌ Error saving level score:", error);
    });

    if (levelScore > 3.5) {
        levelScoreHistory.push(levelScore);
    
        const levelName = levels[currentLevelIndex];
        alert(`🎉 You passed ${levelName} with a score of ${levelScore}/5!`);
    
        if (levelScoreHistory.length >= 5) {
            const total = levelScoreHistory.reduce((a, b) => a + b, 0);
            alert(`🏆 All levels complete! Final Score: ${total.toFixed(2)} / 25`);
        }
    
        if (currentLevelIndex < levels.length - 1) {
            currentLevelIndex++;
            document.getElementById("current-level").textContent = levels[currentLevelIndex];
            generateSentence();  // load next level's sentence
        }
    }
    else {
        alert(`❌ You scored ${levelScore}/5. Please try again.`);
    }

    // Reset state
    levelCorrectCount = 0;
    levelSentenceCount = 0;
    points = 0;
    testCount = 0;
    usedSentences = {};
    document.getElementById('points').textContent = points;

    // ✅ Reset score display to default
    document.getElementById('normalized-score').textContent = '0.00';
    document.getElementById('raw-score-detail').textContent = '(Correct: 0 / 0)';
}


function playNativeCustom() {
    const sentence = document.getElementById("test-sentence").textContent;
    if (!sentence || sentence.includes("Generate")) {
        alert("❌ Please generate a sentence first.");
        return;
    }

    fetch('/get_native_audio?text=' + encodeURIComponent(sentence))
        .then(res => res.blob())
        .then(blob => {
            const audio = document.getElementById("nativeAudio");
            const url = URL.createObjectURL(blob);
            audio.src = url;
            audio.oncanplaythrough = () => audio.play().catch(() => {
                alert("❌ Audio cannot be played.");
            });
        });
}

document.addEventListener("DOMContentLoaded", function () {
    initializeSpeechRecognition();
    loadSentences();

    auth.onAuthStateChanged(user => {
        if (user) {
            document.getElementById("generate-btn")?.addEventListener("click", generateSentence);
            document.getElementById("start-speech-btn")?.addEventListener("click", () => startSpeechRecognition(user.uid));
        }
    });
});
