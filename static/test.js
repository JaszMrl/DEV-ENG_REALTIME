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
const MAX_QUESTIONS_PER_LEVEL = 10;

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
    // 🧽 Hide the score summary box if visible
    const resultBox = document.getElementById("test-result-summary");
    if (resultBox) resultBox.style.display = "none";

    const user = auth.currentUser;
    const levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];

    // If all done, don't allow more
    if (usedSentences[levelKey] && usedSentences[levelKey].length === 0) {
        document.getElementById("test-sentence").textContent = "✅ You've completed all 10 questions!";
        document.getElementById("start-speech-btn").disabled = true;
        return;
    }

    // Fetch or reuse
    if (!usedSentences[levelKey]) {
        const fullSet = sentences[levelKey];
        if (!fullSet || fullSet.length < 10) {
            document.getElementById("test-sentence").textContent = "❌ Not enough sentences for this level.";
            return;
        }

        const selected = [...fullSet].sort(() => Math.random() - 0.5).slice(0, 10);
        usedSentences[levelKey] = [...selected];

        if (user) {
            const userRef = db.collection("users").doc(user.uid);
            await userRef.set({
                [`levelQuestions.${levelKey.replaceAll('.', '_')}`]: selected
            }, { merge: true });
        }
    }

    const remaining = usedSentences[levelKey];
    if (!remaining || remaining.length === 0) {
        document.getElementById("test-sentence").textContent = "✅ You've completed all 10 questions!";
        document.getElementById("start-speech-btn").disabled = true;
        return;
    }

    // Show the next sentence
    document.getElementById("test-sentence").textContent = remaining[0];
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

            let silenceTimer;
            recognition.onstart = function () {
                document.getElementById("test-result").textContent = "Listening...";
                document.getElementById("stop-speech-btn").disabled = false;

                // Start fallback timeout
                silenceTimer = setTimeout(() => recognition.stop(), 5000);
            };

            recognition.onspeechend = function () {
                if (silenceTimer) clearTimeout(silenceTimer);
                silenceTimer = setTimeout(() => recognition.stop(), 2500);
            };

            recognition.onend = function () {
                clearTimeout(silenceTimer);
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
    const userId = user?.uid || null;
    const levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];

    if (!targetSentence || !userSpeech) return;

    // 🛑 Stop if already done all 10
    if (levelSentenceCount >= 10 || !usedSentences[levelKey] || usedSentences[levelKey].length === 0) {
        alert("✅ You’ve already completed all 10 questions!");
        return;
    }

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
        const accuracy = result.accuracy || 0;
        const totalSentences = 10;

        usedSentences[levelKey].shift();

        if (accuracy >= 85) levelCorrectCount++;
        levelSentenceCount++;

        document.getElementById("test-result").innerHTML = `
            <p><strong>Target Sentence:</strong> "${targetSentence}"</p>
            <p><strong>Your Speech:</strong> "${userSpeech}"</p>
            <p><strong>Pronunciation Accuracy:</strong> ${accuracy.toFixed(2)}%</p>
        `;

        document.getElementById("raw-score-detail").textContent = `(Correct: ${levelCorrectCount} / ${totalSentences})`;
        document.getElementById("normalized-score").textContent = ((levelCorrectCount / totalSentences) * 5).toFixed(2);

        const progressBar = document.getElementById('level-progress');
        if (progressBar) {
            progressBar.max = totalSentences;
            progressBar.value = levelSentenceCount;
        }

        // ✅ Only logged-in users get progress saved
        if (levelSentenceCount >= 5 && (levelCorrectCount / totalSentences) * 5 >= 3.5) {
            evaluateLevelProgress(userId);
        } else if (levelSentenceCount === totalSentences) {
            evaluateLevelProgress(userId);
        }
    })
    .catch(error => {
        console.error("❌ Error analyzing speech:", error);
    });
}

function evaluateLevelProgress(userId) {
    let minRequired = 5;
    let totalSentences = 10;
    let levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];

    if (levelSentenceCount < minRequired) {
        alert(`⚠️ You must answer at least ${minRequired} sentences to complete this level.`);
        return;
    }

    let levelScore = (levelCorrectCount / totalSentences) * 5;
    levelScore = parseFloat(levelScore.toFixed(2));

    const scoreDisplay = document.getElementById('normalized-score');
    const detailDisplay = document.getElementById('raw-score-detail');

    if (scoreDisplay) scoreDisplay.textContent = levelScore.toFixed(2);
    if (detailDisplay) detailDisplay.textContent = `(Correct: ${levelCorrectCount} / ${totalSentences})`;

    const userRef = db.collection("users").doc(userId);
    const levelName = levels[currentLevelIndex];

    // ✅ Store score in Firestore
    userRef.set({
        [`levelScores.${levelName}`]: levelScore
    }, { merge: true });

    showLevelSummary(levelScore); // ✅ show summary

    // ✅ No auto-hide. No auto-next. Let user click button to continue.

    if (levelScore >= 3.5) {
        levelScoreHistory.push(levelScore);

        if (levelScoreHistory.length >= 5) {
            const total = levelScoreHistory.reduce((a, b) => a + b, 0);
            const finalScore = parseFloat(total.toFixed(2));
            showFinalScore(finalScore);
            userRef.set({ score: finalScore, level: "Completed" }, { merge: true });
        }

        if (currentLevelIndex < levels.length - 1) {
            // 🟢 Let "next-level-btn" control progression, don't call generateSentence here
            db.collection("users").doc(userId).update({
                [`levelQuestions.${levelKey}`]: firebase.firestore.FieldValue.delete()
            });
        }
        }
    }

function hideLevelSummary() {
    const box = document.getElementById("test-result-summary");
    if (box) box.style.display = "none";
}

function showLevelSummary(score) {
    const box = document.getElementById("test-result-summary");
    const title = document.getElementById("result-title");
    const comment = document.getElementById("result-comment");
    const scoreText = document.getElementById("result-score");
    const nextBtn = document.getElementById("next-level-btn");

    box.style.display = "block";
    scoreText.textContent = `Your Score: ${score.toFixed(2)} / 5`;

    if (score >= 4.5) {
        title.textContent = "🌟 Excellent!";
        comment.textContent = "You're sounding like a native speaker!";
    } else if (score >= 3.5) {
        title.textContent = "✅ Passed!";
        comment.textContent = "Great job! You're ready for the next level.";
    } else {
        title.textContent = "❌ Not Passed";
        comment.textContent = "Keep practicing — you’ll improve in no time!";
    }

    // ✅ Show button only if user passed and has another level
    if (score >= 3.5 && currentLevelIndex < levels.length - 1) {
        nextBtn.style.display = "inline-block";
    } else {
        nextBtn.style.display = "none";
    }
}


function nextLevel() {
    hideLevelSummary();
    document.getElementById("next-level-btn").style.display = "none";

    currentLevelIndex++;
    document.getElementById("current-level").textContent = levels[currentLevelIndex];

    levelCorrectCount = 0;
    levelSentenceCount = 0;
    usedSentences = {};

    if (document.getElementById('points')) {
        document.getElementById('points').textContent = points;
    }

    document.getElementById("normalized-score").textContent = '0.00';
    document.getElementById("raw-score-detail").textContent = '(Correct: 0 / 0)';

    generateSentence();
}


function showFinalScore(scoreOutOf25) {
    const box = document.getElementById("final-score-summary");
    const text = document.getElementById("final-score-text");

    if (box && text) {
        box.style.display = "block";
        text.textContent = `Your Final Score: ${scoreOutOf25} / 25`;
    }
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
