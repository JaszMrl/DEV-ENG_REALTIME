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
const phonemeLabels = {
    "TH": "TH as in 'think'",
    "R": "R as in 'red'",
    "L": "L as in 'light'",
    "V": "V as in 'van'",
    "W": "W as in 'water'",
    "NG": "NG as in 'sing'",
    "S": "S as in 'snake'",
    "Z": "Z as in 'zoo'"
};
function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/\b0\b/g, 'zero')
        .replace(/\b1\b/g, 'one')
        .replace(/\b2\b/g, 'two')
        .replace(/\b3\b/g, 'three')
        .replace(/\b4\b/g, 'four')
        .replace(/\b5\b/g, 'five')
        .replace(/\b6\b/g, 'six')
        .replace(/\b7\b/g, 'seven')
        .replace(/\b8\b/g, 'eight')
        .replace(/\b9\b/g, 'nine')
        .replace(/[^\w\s]/g, '') // remove punctuation
        .trim();
}
// ✅ Show "Last Test" Info on Dashboard
function loadRecentActivity() {
    auth.onAuthStateChanged(user => {
        if (user) {
            const userRef = db.collection("users").doc(user.uid);
            userRef.get().then(doc => {
                const recentActivity = document.getElementById("recent-activity");
                if (recentActivity && doc.exists) {
                    const data = doc.data();
                    const lastDate = data.lastTestDate;
                    const lastLevel = data.lastTestLevel;

                    if (lastDate && lastLevel) {
                        const formatted = new Date(lastDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                        });
                        recentActivity.textContent = `Last test: ${lastLevel} on ${formatted}`;
                    } else {
                        recentActivity.textContent = "No recent test";
                    }
                }
            }).catch(err => {
                console.error("❌ Error loading last test info:", err);
            });
        }
    });
}

// ✅ Load this on page load
window.addEventListener("DOMContentLoaded", loadRecentActivity);


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
let finalLevelCompleted = false; // ✅ NEW FLAG
let levelEvaluationTriggered;
let isNextLevelLocked = false;  // ✅ ADD THIS LINE


const user = firebase.auth().currentUser;
if (user) {
  firebase.firestore().collection("users").doc(user.uid).set({
    lastTestDate: new Date().toISOString()
  }, { merge: true });
}

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

function generateSentence() {
    document.getElementById("test-result").innerHTML = "";

    if (finalLevelCompleted) {
        const scoreUI = document.getElementById("level-score-ui");
        if (scoreUI) scoreUI.style.display = "none";
    }

    const resultBox = document.getElementById("test-result-summary");
    if (resultBox) resultBox.style.display = "none";

    const user = auth.currentUser;
    const levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];

    // ✅ Ensure sentences are loaded
    if (!sentences || !sentences[levelKey] || sentences[levelKey].length === 0) {
        document.getElementById("test-sentence").textContent = "⚠️ Sentences are still loading...";
        return;
    }

    // ✅ Setup sentence queue if not done yet
    if (!usedSentences[levelKey]) {
        const fullSet = sentences[levelKey];
        const selected = [...fullSet].sort(() => Math.random() - 0.5).slice(0, 10);
        usedSentences[levelKey] = [...selected];

        if (user) {
            const userRef = db.collection("users").doc(user.uid);
            userRef.set({
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

    // ✅ Display next sentence
    document.getElementById("test-sentence").textContent = remaining[0];
    document.getElementById("start-speech-btn").disabled = false;

    console.log("📜 Sentence for", levelKey, "→", remaining[0]);
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

function playNativeCustom() {
    const audio = document.getElementById("nativeAudio");
    if (!audio.src) {
        alert("❌ No native audio available.");
        return;
    }
    audio.play().catch(() => {
        alert("❌ Audio cannot be played.");
    });
}

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("next-level-btn")?.addEventListener("click", nextLevel);
});

function analyzeSpeech(targetSentence, userSpeech) {
    const user = auth.currentUser;
    const userId = user?.uid || null;
    const levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];
    const totalSentences = 10;

    if (!targetSentence || !userSpeech) return;

    if (levelSentenceCount >= totalSentences || !usedSentences[levelKey] || usedSentences[levelKey].length === 0) {
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
    .then(async res => {
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Server error");
        }
        return res.json();
    })
    .then(result => {
        const accuracy = result.accuracy || 0;
        const transcription = result.transcription || '';
        const similarity = result.similarity || 0;
        const wordMatch = result.word_match || 0;
        const accentMistakes = result.accent_issues || [];
        const accentSimilarity = result.accent_similarity || 0;
        const combinedScore = (accuracy + accentSimilarity) / 2;

        if (result.audio_url) {
            document.getElementById("nativeAudio").src = result.audio_url;
        }

        if (transcription.trim() === '' || similarity < 60 || wordMatch < 80) {
            document.getElementById("test-result").innerHTML = `
                <p style="color: red; font-weight: bold;">⚠️ Your sentence didn’t match well enough. Please try again.</p>
                <p><strong>Transcribed:</strong> "${transcription}"</p>
                <p><strong>Similarity:</strong> ${similarity.toFixed(2)}%</p>
                <p><strong>Word Match:</strong> ${wordMatch.toFixed(2)}%</p>
                <p style="color: #1976d2;"><strong>🧮 Combined Score:</strong> ${combinedScore.toFixed(2)}%</p>
            `;
            return;
        }

        usedSentences[levelKey].shift();
        if (accuracy >= 85 && combinedScore >= 50) levelCorrectCount++;
        levelSentenceCount++;

        let accentFeedback = '';
        if (accentMistakes.length > 0 && accuracy < 80) {
            const tips = accentMistakes.map(pair => {
                const phoneme = pair.split('→')[0].trim();
                return phonemeLabels[phoneme] || phoneme;
            });
            const uniqueTips = [...new Set(tips)];
            accentFeedback = `
                <p style="color: #ff9800; font-weight: bold;">
                    🟠 Accent Tips:
                </p>
                <p style="color: #444; margin-top: -10px;">
                    Try improving these sounds: ${uniqueTips.join(', ')}
                </p>
            `;
        }

        const highlighted = highlightDifferences(targetSentence, transcription);

        document.getElementById("test-result").innerHTML = `
            <p><strong>Target Sentence:</strong> "${targetSentence}"</p>
            <p><strong>Your Speech:</strong> ${highlighted}</p>
            <p><strong>Word Match:</strong> ${wordMatch.toFixed(2)}%</p>
            <p style="color: #1976d2;"><strong>🧮 Combined Score:</strong> ${combinedScore.toFixed(2)}%</p>
            ${accentFeedback}
        `;

        document.getElementById("raw-score-detail").textContent = `(Correct: ${levelCorrectCount} / ${totalSentences})`;
        document.getElementById("normalized-score").textContent = ((levelCorrectCount / totalSentences) * 5).toFixed(2);

        const progressBar = document.getElementById('level-progress');
        if (progressBar) {
            progressBar.max = totalSentences;
            progressBar.value = levelSentenceCount;
        }

        const levelScore = (levelCorrectCount / totalSentences) * 5;

        if (levelSentenceCount === totalSentences || (levelSentenceCount >= 5 && levelScore >= 3.5)) {
            evaluateLevelProgress(userId);
        }

    })
    .catch(error => {
        console.error("❌ Error analyzing speech:", error);
        alert("❌ Failed to analyze speech: " + error.message);
    });
}

function highlightDifferences(target, user) {
    const clean = normalizeText;
    const targetWords = clean(target).split(/\s+/);
    const userWords = clean(user).split(/\s+/);

    const length = Math.max(targetWords.length, userWords.length);

    return Array.from({ length }).map((_, i) => {
        const t = targetWords[i] || '';
        const u = userWords[i] || '';

        if (t === u) {
            return `<span style="color: green; font-weight: bold;">${u}</span>`;
        } else {
            return `<span style="color: red;">${u}</span>`;
        }
    }).join(' ');
}

function evaluateLevelProgress(userId) {
    if (levelEvaluationTriggered) return; // ✅ already triggered
    levelEvaluationTriggered = true; // ✅ lock it now
    console.log("🧪 Checking level progression...");
    console.log("📍 Current Level Index:", currentLevelIndex);

    let totalSentences = 10;
    let levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];

    if (levelSentenceCount < 5) {
        alert(`⚠️ You must answer at least 5 sentences to complete this level.`);
    }

    let levelScore = (levelCorrectCount / totalSentences) * 5;
    levelScore = parseFloat(levelScore.toFixed(2));

    // ✅ Always show & record score
    const scoreDisplay = document.getElementById('normalized-score');
    const detailDisplay = document.getElementById('raw-score-detail');
    if (scoreDisplay) scoreDisplay.textContent = levelScore.toFixed(2);
    if (detailDisplay) detailDisplay.textContent = `(Correct: ${levelCorrectCount} / ${totalSentences})`;

    const userRef = db.collection("users").doc(userId);
    const levelName = levels[currentLevelIndex];

    userRef.set({
        [`levelScores.${levelName}`]: levelScore
    }, { merge: true });

    levelScoreHistory.push(levelScore);  // ✅ Always store this

    if (currentLevelIndex === levels.length - 1) {
        const total = levelScoreHistory.reduce((a, b) => a + b, 0);
        const finalScore = parseFloat(total.toFixed(2));
        finalLevelCompleted = true;
    
        document.getElementById("level-score-ui").style.display = "none";
        document.getElementById("test-result-summary").style.display = "none";
        showFinalScore(finalScore);
    
        const userRef = db.collection("users").doc(userId);
        const levelName = levels[currentLevelIndex];
        
        userRef.set({
            [`levelScores.${levelName}`]: levelScore,
            lastTestDate: new Date().toISOString(),
            lastTestLevel: levelName  // ✅ <-- add this line
        }, { merge: true });            
        
        document.getElementById("next-level-btn").style.display = "none";
        return;
    }    
        if (currentLevelIndex === levels.length - 1) {
            // [Your existing final-level logic]
            return;
        }
        
        // ✅ Only allow saving last test if passed
        if (levelScore >= 3.5) {
            userRef.set({
                lastTestDate: new Date().toISOString(),
                lastTestLevel: levelName
            }, { merge: true }).then(() => {
                console.log("✅ Saved recent activity:", levelName);
            });
        
            showLevelSummary(levelScore);
        }
}

function hideLevelSummary() {
    const box = document.getElementById("test-result-summary");
    if (box) box.style.display = "none";
}

function showLevelSummary(score) {
    // 🛑 BLOCK if all levels are complete
    if (finalLevelCompleted) {
        console.log("🚫 Skipping showLevelSummary because final level is done.");
        return;
    }

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

    if (score >= 3.5 && currentLevelIndex < levels.length - 1) {
        nextBtn.style.display = "inline-block";
    } else {
        nextBtn.style.display = "none";
    }
}

function nextLevel() {
    if (isNextLevelLocked) {
        console.warn("🚫 nextLevel() already triggered. Ignoring.");
        return;
    }
    isNextLevelLocked = true;

    const nextBtn = document.getElementById("next-level-btn");
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.style.display = "none";
    }

    if (currentLevelIndex >= levels.length - 1) return;

    currentLevelIndex += 1;
    levelEvaluationTriggered = false;

    const levelDisplay = document.getElementById("current-level");
    if (levelDisplay) levelDisplay.textContent = levels[currentLevelIndex];

    console.log("➡️ Progressed to:", levels[currentLevelIndex]);

    // 🔄 Reset tracking
    levelCorrectCount = 0;
    levelSentenceCount = 0;

    // ❗ Clear previous level's sentence memory
    usedSentences = {};

    // 🧼 Reset score display
    document.getElementById("normalized-score").textContent = '0.00';
    document.getElementById("raw-score-detail").textContent = '(Correct: 0 / 0)';
    //document.getElementById("accent-similarity").innerHTML = "";
    document.getElementById("test-result-summary").style.display = "none";
    document.getElementById("level-score-ui").style.display = "block";

    // 🧠 Save to Firestore
    const user = auth.currentUser;
    if (user) {
        const userRef = db.collection("users").doc(user.uid);
        userRef.set({ currentLevel: currentLevelIndex }, { merge: true });

        const previousKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex - 1];
        db.collection("users").doc(user.uid).update({
            [`levelQuestions.${previousKey}`]: firebase.firestore.FieldValue.delete()
        });
    } else {
        console.log("👤 Guest user: skipping Firestore update");
    }

    generateSentence();

    setTimeout(() => {
        isNextLevelLocked = false;
    }, 500);
}


function showFinalScore(scoreOutOf25) {
    const box = document.getElementById("final-score-summary");
    const text = document.getElementById("final-score-text");

    const scoreUI = document.getElementById("level-score-ui");
    const summaryBox = document.getElementById("test-result-summary");

    if (scoreUI) scoreUI.style.display = "none";
    if (summaryBox) summaryBox.style.display = "none";  // 🧼 Add this to hide summary

    if (box && text) {
        box.style.display = "block";
        text.textContent = `Your Final Score: ${scoreOutOf25} / 25`;
    }

    document.getElementById("normalized-score").textContent = '';
    document.getElementById("raw-score-detail").textContent = '';
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

function resetUserLevel() {
    const user = auth.currentUser;
    if (user) {
      db.collection("users").doc(user.uid).set({
        currentLevel: 0,
        levelScores: {},  // optional: reset scores too
        lessons: {}
      }, { merge: true }).then(() => {
        currentLevelIndex = 0;
        levelCorrectCount = 0;
        levelSentenceCount = 0;
        usedSentences = {};
        levelScoreHistory = [];
        document.getElementById("current-level").textContent = levels[0];
        document.getElementById("normalized-score").textContent = '0.00';
        document.getElementById("raw-score-detail").textContent = '(Correct: 0 / 0)';
        generateSentence();
      });
    }
  }  

  document.addEventListener("DOMContentLoaded", function () {
    initializeSpeechRecognition();
    loadSentences();

    auth.onAuthStateChanged(user => {
        if (user) {
            const userRef = db.collection("users").doc(user.uid);
            userRef.get().then(doc => {
                if (doc.exists) {
                    const savedLevel = parseInt(doc.data().currentLevel);
                    currentLevelIndex = isNaN(savedLevel) || savedLevel < 0 || savedLevel >= levels.length ? 0 : savedLevel;
                    document.getElementById("current-level").textContent = levels[currentLevelIndex];
                } else {
                    currentLevelIndex = 0;
                    document.getElementById("current-level").textContent = levels[0];
                }
            });

            // ✅ Bind once only
            const btn = document.getElementById("next-level-btn");
            if (btn) {
                const newBtn = btn.cloneNode(true); // remove all listeners
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener("click", nextLevel);
            }

            document.getElementById("generate-btn")?.addEventListener("click", generateSentence);
            document.getElementById("start-speech-btn")?.addEventListener("click", () => startSpeechRecognition(user.uid));
        }
    });
});


