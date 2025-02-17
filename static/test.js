let sentences = { basic: [], intermediateLow: [], intermediateHigh: [], advanced: [], native: [] };
let levels = ["Basic/Beginner", "Intermediate Low", "Intermediate High", "Advanced", "Native/Fluent"];
let currentLevelIndex = 0;
let testCount = 0;
const totalTests = 10;
let totalScore = 0;
let points = 0;
let recognition;
let usedSentences = {}; // ติดตามประโยคที่ใช้ในแต่ละระดับ

// ✅ เริ่มการจดจำเสียง
function startSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("❌ Speech Recognition is not supported in this browser. Try Chrome or Edge.");
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

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

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => recognition.start())
        .catch(error => alert("Microphone access is blocked. Enable it in your browser settings."));
}

// ✅ หยุดการจดจำเสียง
function stopSpeechRecognition() {
    if (recognition) recognition.stop();
    document.getElementById("test-result").textContent = "Speech recognition stopped.";
    document.getElementById("stop-speech-btn").disabled = true;
}

// ✅ ดึงประโยคจาก Flask API
async function loadSentences() {
    try {
        const response = await fetch('/get-test-sentences');
        if (!response.ok) throw new Error(`Failed to fetch sentences: ${response.status}`);

        const data = await response.json();
        sentences = data;
    } catch (error) {
        document.getElementById("test-sentence").textContent = "Error loading sentences.";
    }
}

// ✅ สร้างประโยคทดสอบ
async function generateSentence() {
    if (!sentences.basic.length) await loadSentences();

    let levelKey = ["basic", "intermediateLow", "intermediateHigh", "advanced", "native"][currentLevelIndex];
    let levelSentences = sentences[levelKey];

    if (!levelSentences || levelSentences.length === 0) return;

    if (!usedSentences[levelKey]) {
        usedSentences[levelKey] = [...levelSentences].sort(() => Math.random() - 0.5);
    }

    let testSentence = usedSentences[levelKey].shift();
    document.getElementById("test-sentence").textContent = testSentence;
    document.getElementById("start-speech-btn").disabled = false;
}

// ✅ วิเคราะห์การพูดและปรับคะแนน
async function analyzeSpeech(targetSentence, userSpeech) {
    try {
        let strictnessLevels = ["medium", "high", "very_high"];
        let currentStrictness = strictnessLevels[currentLevelIndex] || "medium";

        const response = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_sentence: targetSentence, user_speech: userSpeech, strictness: currentStrictness }),
        });

        if (!response.ok) throw new Error(`Failed to analyze pronunciation: ${response.statusText}`);

        const result = await response.json();
        let accuracy = result.accuracy || 0;

        totalScore += accuracy;
        testCount++;

        if (accuracy >= 80) points++;
        document.getElementById('points').textContent = points;

        document.getElementById('test-result').innerHTML = `
            <p><strong>Target Sentence:</strong> "${targetSentence}"</p>
            <p><strong>Your Speech:</strong> "${userSpeech}"</p>
            <p><strong>Pronunciation Accuracy:</strong> ${accuracy.toFixed(2)}%</p>
        `;

        if (testCount >= totalTests) adjustLevel();
    } catch (error) {
        document.getElementById('test-result').textContent = "Error analyzing speech.";
    }
}

function adjustLevel() {
    if (points >= 3 && currentLevelIndex < levels.length - 1) {
        currentLevelIndex++;
        document.getElementById("current-level").textContent = levels[currentLevelIndex];
        alert(`🎉 You have leveled up to ${levels[currentLevelIndex]}!`);
        points = 0;
        testCount = 0;
        totalScore = 0;
        usedSentences = {};
        document.getElementById('points').textContent = points;
    } else {
        showFinalScore();
    }
}

function showFinalScore() {
    let finalPercentage = Math.floor((totalScore / (testCount * 100)) * 100);
    document.getElementById("final-score").innerHTML = `📝 <strong>Your Overall Score:</strong> ${finalPercentage}%`;
    document.getElementById("final-comment").innerHTML = `💬 Keep practicing!`;
    document.getElementById("final-score-section").style.display = "block";
}

document.addEventListener("DOMContentLoaded", async function () { await loadSentences(); });

