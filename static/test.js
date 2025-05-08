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
    const nextSentence = remaining[0];
    document.getElementById("test-sentence").textContent = nextSentence;
    document.getElementById("start-speech-btn").disabled = false;
    document.getElementById("stop-recording-btn").disabled = true;  // Reset state
    document.getElementById("test-result").textContent = "🎯 Please read the sentence   ...";

    console.log("📜 Sentence for", levelKey, "→", nextSentence);
}

let mediaRecorder;
let recordedChunks = [];

// Start audio recording
async function startAudioRecording() {
    recordedChunks = []; 
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus"
    });

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", blob, "user_audio.webm");
        const sentence = document.getElementById("test-sentence").innerText.trim();
        formData.append("target_sentence", sentence);

        // Send the FormData to the backend for analysis
        fetch("/analyze_audio", {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log("🎯 Backend Response:", data);
            const levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];
        
            if (data.error) {
                const spoken = data.transcription || "(not recognized)";
                showResult(
                    `<strong>Spoken:</strong> "${spoken}"`,
                    0,
                    0
                );
            } else {
                showResult(
                    `✅ You said: ${data.transcription}`,
                    data.accent_score,
                    data.combined_similarity
                );                
                // ✅ Score tracking logic
                // Always count each attempt
                levelSentenceCount++;

                // Only count as correct if combined similarity is at least 80%
                if (data.combined_similarity >= 80) {
                    levelCorrectCount++;
                } else {
                    console.log("❌ Not correct: Combined similarity too low");
                }
            }
        
            // ✅ Only shift sentence after a recording attempt
            usedSentences[levelKey].shift();
        
            // ✅ Update UI
            document.getElementById("raw-score-detail").textContent = `(Correct: ${levelCorrectCount} / 10)`;
            document.getElementById("normalized-score").textContent = ((levelCorrectCount / 10) * 5).toFixed(2);
        
            // ✅ Save score to Firestore after every attempt
            const user = auth.currentUser;
            if (user) {
            const levelScore = parseFloat(((levelCorrectCount / 10) * 5).toFixed(2));
            const userRef = db.collection("users").doc(user.uid);
            userRef.set({
                [`levelScores.${levels[currentLevelIndex]}`]: levelScore
            }, { merge: true });
            }

            // ✅ Check progression
            if (levelSentenceCount === 10) {
                console.log("🟡 10 attempts reached, evaluating progress...");
                evaluateLevelProgress();
            }
        })
    }        
    mediaRecorder.start();
    console.log("🎙 Recording started");
    document.getElementById("start-speech-btn").disabled = true;
    document.getElementById("stop-recording-btn").disabled = false;
}

// Stop audio recording
function stopAudioRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        console.log("🛑 Recording stopped");
    }
    document.getElementById("stop-recording-btn").disabled = true;
    document.getElementById("start-speech-btn").disabled = false;
}

function showResult(message, accentScore = 0, combinedSimilarity = 0) {
    const resultBox = document.getElementById("test-result");

    let bg = "#f0f0f0", textColor = "#000", border = "#ccc";

    if (combinedSimilarity >= 90) {
        bg = "#d4edda";         // greenish
        textColor = "#155724";
        border = "#28a745";
    } else if (combinedSimilarity >= 70) {
        bg = "#fff3cd";         // yellowish
        textColor = "#856404";
        border = "#ffc107";
    } else {
        bg = "#f8d7da";         // reddish
        textColor = "#721c24";
        border = "#dc3545";
    }

    resultBox.innerHTML = `
        ${message}<br>
        <strong>Accent Score:</strong> ${accentScore || 0}/5<br>
        <div style="
            background-color: ${bg};
            color: ${textColor};
            border: 2px solid ${border};
            padding: 10px;
            margin-top: 10px;
            border-radius: 10px;
            font-weight: bold;
            font-size: 1.2em;
        ">
            📊 Combined Score: ${combinedSimilarity?.toFixed(1) || "0.0"}%
        </div>
    `;
}

// Analyze audio
function analyzeAudio(formData) {
    fetch('/analyze_audio', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        const { transcription, accuracy, accent_similarity } = data;

        const combinedScore = (accuracy + accent_similarity) / 2;

        document.getElementById("test-result").innerHTML = `
            <p><strong>Your Speech:</strong> ${transcription}</p>
             <strong>📊 Combined Score:</strong> <strong>${combinedSimilarity?.toFixed(1) || "0.0"}%</strong>
        `;

        // Update score and level progress
        if (accuracy >= 85 && combinedScore >= 50) levelCorrectCount++;
        levelSentenceCount++;

        // Update the score display
        document.getElementById("raw-score-detail").textContent = `(Correct: ${levelCorrectCount} / 10)`;
        document.getElementById("normalized-score").textContent = ((levelCorrectCount / 10) * 5).toFixed(2);

        // Check if it's time to evaluate level progression
        if (levelSentenceCount === 10 || (levelSentenceCount >= 5 && levelCorrectCount >= 7)) {
            evaluateLevelProgress();
        }
    })
    .catch(error => {
        console.error("❌ Error analyzing audio:", error);
    });
}

function evaluateLevelProgress() {
    console.log("✅ evaluateLevelProgress() called");
    // ✅ Calculate level score (out of 5)
    let levelScore = (levelCorrectCount / 10) * 5;
    levelScore = parseFloat(levelScore.toFixed(2));

    // ✅ Update UI
    const scoreDisplay = document.getElementById('normalized-score');
    const detailDisplay = document.getElementById('raw-score-detail');
    if (scoreDisplay) scoreDisplay.textContent = levelScore.toFixed(2);
    if (detailDisplay) detailDisplay.textContent = `(Correct: ${levelCorrectCount} / 10)`;

    // ✅ Save score to Firestore
    const user = auth.currentUser;
    if (user) {
    const userRef = db.collection("users").doc(user.uid);
    userRef.set({
        [`levelScores.${levels[currentLevelIndex]}`]: levelScore
    }, { merge: true });
    }

    // ✅ If it's the final level, show final score instead of next level
    if (currentLevelIndex === levels.length - 1) {
        showFinalScore(levelScore);
        return; // ⛔️ Stop here
    }

    // ✅ Show level summary popup
    showLevelSummary(levelScore);

    const passed = levelCorrectCount >= 7 && levelSentenceCount >= 5;

    // ✅ Auto-progress if passed
    if (passed) {
        const nextBtn = document.getElementById("next-level-btn");
        if (nextBtn) {
            nextBtn.style.display = "none";
            nextBtn.disabled = true;
        }

        setTimeout(() => {
            nextLevel();
        }, 1500);
    }
}

function showFinalScore(score) {
    const finalModal = document.getElementById("final-score-modal");
    const finalText = document.getElementById("final-score-text");
    // ✅ SAVE final test results to Firestore
        const user = auth.currentUser;
        if (user) {
            const userRef = db.collection("users").doc(user.uid);
            userRef.set({
                lastTestDate: new Date().toISOString(),
                lastTestLevel: "All Levels Completed",
                score: score,
                isCompleted: true
            }, { merge: true }).then(() => {
                console.log("✅ Final score saved to Firestore:", {
                    score,
                    level: "All Levels Completed",
                    completed: true
                });
            }).catch((err) => {
                console.error("❌ Failed to save final score:", err);
            });
        }        

    if (finalModal && finalText) {
        finalModal.style.display = "flex";
        document.body.style.overflow = "hidden";

        if (score >= 12.5) {
            finalText.innerHTML = `
                🎉 <strong>Congratulations!</strong> You passed the full test.<br>
                ✅ <strong>Your Final Score:</strong> ${score.toFixed(2)} / 25
            `;
        } else {
            finalText.innerHTML = `
                ⚠️ <strong>Keep practicing!</strong> You didn’t pass the full test.<br>
                📉 <strong>Your Final Score:</strong> ${score.toFixed(2)} / 25
            `;
        }
    }
}

function closeFinalModal() {
    const finalModal = document.getElementById("final-score-modal");
    if (finalModal) {
        finalModal.style.display = "none";
        document.body.style.overflow = "auto"; // 🔓 restore scroll
    }
}

function showLevelSummary(score) {
    const box = document.getElementById("test-result-summary");
    const title = document.getElementById("result-title");
    const comment = document.getElementById("result-comment");
    const scoreText = document.getElementById("result-score");
    const nextBtn = document.getElementById("next-level-btn");

    if (!box || !title || !comment || !scoreText || !nextBtn) {
        console.warn("⛔ Missing one or more summary elements");
        return;
    }

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

    nextBtn.style.display = score >= 3.5 && currentLevelIndex < levels.length - 1 ? "inline-block" : "none";
}


// Move to the next level
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

    // Reset progress
    levelCorrectCount = 0;
    levelSentenceCount = 0;
    usedSentences = {};

    // Reset UI
    document.getElementById("normalized-score").textContent = '0.00';
    document.getElementById("raw-score-detail").textContent = '(Correct: 0 / 0)';
    document.getElementById("test-result-summary").style.display = "none";
    document.getElementById("level-score-ui").style.display = "block";

    // Save new level
    const user = auth.currentUser;
    if (user) {
    const userRef = db.collection("users").doc(user.uid);
    userRef.set({ currentLevel: currentLevelIndex }, { merge: true });

    const previousKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex - 1];
    db.collection("users").doc(user.uid).update({
        [`levelQuestions.${previousKey}`]: firebase.firestore.FieldValue.delete()
    });
    }

    generateSentence();

    // ✅ Reset lock AFTER generateSentence completes
    setTimeout(() => {
        isNextLevelLocked = false;
    }, 300);
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
    loadSentences();  // ✅ Make sure this runs once on page load

    auth.onAuthStateChanged(user => {
        // ✅ Always bind test buttons
        document.getElementById("generate-btn")?.addEventListener("click", generateSentence);
        document.getElementById("start-speech-btn")?.addEventListener("click", startAudioRecording);
        document.getElementById("stop-recording-btn")?.addEventListener("click", stopAudioRecording);

        // ✅ Firestore logic for signed-in users
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

            const btn = document.getElementById("next-level-btn");
            if (btn) {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener("click", nextLevel);
            }
        } else {
            const warning = document.getElementById("guest-warning");
            if (warning) {
                warning.style.display = "block";
                warning.textContent = "⚠️ You're in guest mode. Progress won't be saved.";
            }
        }
    });
});
