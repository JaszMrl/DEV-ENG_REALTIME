let mediaRecorder = null;
let audioChunks = [];

// ฟังก์ชันแสดงหน้าต่างต่างๆ
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
    });

    const selectedPage = document.getElementById(`${pageId}-page`);
    selectedPage.classList.add('active');
}


let recognition;
let isRecognizing = false;
let finalTranscript = '';

function startSpeechRecognition() {
    console.log("Starting speech recognition...");

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        alert('Your browser does not support Speech Recognition. Try using Google Chrome or Microsoft Edge.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    // Speech Recognition settings
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.start();
    isRecognizing = true;

    // Update UI
    document.getElementById('start-speech-btn').disabled = true;
    document.getElementById('stop-speech-btn').disabled = false;
    document.getElementById('transcription-output').innerText = 'Listening...';

    // Handle results
    recognition.onresult = (event) => {
        let interimTranscript = '';
        console.log("Processing results...");

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        // Update UI
        document.getElementById('transcription-output').innerHTML = `
            ${finalTranscript} <span style="color: gray;">${interimTranscript}</span>
        `;

        console.log(`Final Transcript: ${finalTranscript}`);
        console.log(`Interim Transcript: ${interimTranscript}`);
    };

    // Error Handling
    recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        document.getElementById('transcription-output').innerText = `Error: ${event.error}`;
    };

    // Handle stopping
    recognition.onend = () => {
        console.log("Speech recognition ended.");
        if (isRecognizing) {
            recognition.start(); // Restart if continuous
        }
    };
}

function stopSpeechRecognition() {
    if (recognition && isRecognizing) {
        console.log("Stopping speech recognition...");
        recognition.stop();
        isRecognizing = false;

        // Update UI
        document.getElementById('start-speech-btn').disabled = false;
        document.getElementById('stop-speech-btn').disabled = true;

        // Send the final transcript to Flask
        if (finalTranscript) {
            fetch('/process-transcription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transcription: finalTranscript })
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Server Response:', data);
                    document.getElementById('transcription-output').innerText = `Server Response: ${data.message}`;
                })
                .catch(error => {
                    console.error('Error sending transcription to server:', error);
                    document.getElementById('transcription-output').innerText = 'Error sending transcription to server.';
                });
        }
    }
}


fetch('/process-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription: finalTranscript })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Server Response:', data);
    })
    .catch(error => {
        console.error('Error sending transcription to server:', error);
    });



function onFileSelect() {
    const selectElement = document.getElementById('audioFileSelect');
    const selectedFile = selectElement.value;

    if (selectedFile) {
        const audioSource = document.getElementById('audioSource');
        console.log(`Selected file: ${selectedFile}`); // Debugging line
        audioSource.src = `/audio/${selectedFile}`;
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.load();
    }
}



// Predict based on the selected pre-uploaded file
function predictFromServerFile() {
    const selectedFile = document.getElementById("audioFileSelect").value;
    if (!selectedFile) {
        alert("Please select an audio file.");
        return;
    }

    fetch('http://localhost:5000/predict-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: selectedFile })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Error: ${data.error}`);
            } else {
                alert(`Prediction: ${data.prediction}`);
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert("An error occurred while processing the request.");
        });
}

async function predictSelectedFile() {
    const audioSource = document.getElementById('audioSource').src;
    const filename = audioSource.split('/').pop();

    try {
        const response = await fetch('/predict-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
        });

        const data = await response.json();

        if (data.error) {
            alert(`Error: ${data.error}`);
        } else {
            const modal = document.getElementById("resultModal");
            const modalText = document.getElementById("modalText");
            const modalDetail = document.getElementById("modalDetail");
            const predictionIcon = document.getElementById("prediction-icon");

            modalText.innerText = `Prediction for ${filename}`;
            modalDetail.innerText = `It's a ${data.prediction}!`;

            if (data.prediction === "Dog") {
                modalDetail.style.color = "#007bff";
                predictionIcon.className = "prediction-icon dog";
            } else if (data.prediction === "Cat") {
                modalDetail.style.color = "#e83e8c";
                predictionIcon.className = "prediction-icon cat";
            }

            modal.style.display = "block"; // Show the modal
        }
    } catch (error) {
        console.error("Prediction error:", error);
        alert("An error occurred during prediction. Please try again.");
    }
}




function closeModal() {
    const modal = document.getElementById("resultModal");
    modal.style.display = "none";
}


function closeModal() {
    const modal = document.getElementById("resultModal");
    modal.style.display = "none";
}

function showLesson(lessonId) {
    const pages = document.querySelectorAll('.page'); // Find all pages
    pages.forEach(page => page.classList.remove('active')); // Hide all pages
    const lessonPage = document.getElementById(`${lessonId}-page`); // Find the specific lesson page
    if (lessonPage) {
        lessonPage.classList.add('active'); // Show the selected lesson
    } else {
        console.error(`Lesson with id "${lessonId}" not found.`);
    }
}

function onFileSelect() {
    const selectElement = document.getElementById('audioFileSelect');
    const selectedFile = selectElement.value;

    if (selectedFile) {
        const audioSource = document.getElementById('audioSource');
        console.log(`Selected file: ${selectedFile}`); // Debugging line
        audioSource.src = `/audio/${selectedFile}`;
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.load();
    }
}