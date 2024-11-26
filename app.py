from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import joblib
import librosa
import numpy as np
import pandas as pd
from google.cloud import texttospeech

# Initialize Flask app
app = Flask(__name__)

# Base directory of the project
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Paths for audio files and trained model
AUDIO_FILES_DIR = os.path.join(BASE_DIR, 'Animal sound')  # Directory to store audio files
MODEL_PATH = os.path.join(BASE_DIR, 'decision_tree_model.joblib')  # Path to the trained model
TTS_AUDIO_DIR = os.path.join(BASE_DIR, 'static', 'Generated_audio')  # Directory for generated TTS audio

# Ensure the directories exist
os.makedirs(AUDIO_FILES_DIR, exist_ok=True)
os.makedirs(TTS_AUDIO_DIR, exist_ok=True)

clf = None  # Global variable to hold the trained model

# Load the trained model
# Load the trained model
def load_model():
    """Load the trained decision tree model."""
    global clf  # Ensure we modify the global clf variable
    try:
        print(f"Attempting to load model from: {MODEL_PATH}")
        if os.path.exists(MODEL_PATH):
            # Attempt to load the model
            clf = joblib.load(MODEL_PATH)
            print("Model loaded successfully.")
        else:
            # If model file does not exist
            print(f"Model file not found at {MODEL_PATH}. Ensure it is included in your deployment.")
            clf = None
    except Exception as e:
        # Catch any errors during model loading
        print(f"Error during model loading: {e}")
        clf = None


print(f"BASE_DIR: {BASE_DIR}")
print(f"MODEL_PATH: {MODEL_PATH}")
print(f"Does model file exist? {os.path.exists(MODEL_PATH)}")

@app.route('/')
def home():
    """Render the homepage with the file selection options."""
    # List available audio files in the directory
    audio_files = [f for f in os.listdir(AUDIO_FILES_DIR) if f.endswith('.wav')]
    return render_template('index.html', audio_files=audio_files)

@app.route('/lesson1')
def lesson1():
    """Render the Lesson 1 Practice page."""
    return render_template('lesson1.html')

@app.route('/lesson1_learn')
def lesson1_learn():
    """Render the Lesson 1 Overview page."""
    return render_template('lesson1_learn.html')

@app.route('/lesson2')
def lesson2():
    """Render the Lesson 2 Practice page."""
    return render_template('lesson2.html')

@app.route('/lesson2_learn')
def lesson2_learn():
    """Render the Lesson 2 Overview page."""
    return render_template('lesson2_learn.html')

@app.route('/lesson3')
def lesson3():
    """Render the Lesson 3 Practice page."""
    return render_template('lesson3.html')

@app.route('/lesson3_learn')
def lesson3_learn():
    """Render the Lesson 3 Overview page."""
    return render_template('lesson3_learn.html')

@app.route('/lesson4')
def lesson4():
    """Render the Lesson 4 page (Pronunciation)."""
    return render_template('lesson4.html')


# New route to generate TTS audio
@app.route('/generate_audio/<text>', methods=['GET'])
def generate_audio(text):
    """Generate speech using Google Cloud Text-to-Speech and return an audio file."""
    try:
        # Instantiate Google TTS client
        client = texttospeech.TextToSpeechClient()

        # Set the text input to be synthesized
        synthesis_input = texttospeech.SynthesisInput(text=text)

        # Choose the language and SSML voice gender
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US", ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
        )

        # Set the audio file configuration
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )

        # Request the synthesis of the speech
        response = client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )

        # Save the audio content to a file in the static folder
        audio_filename = os.path.join(app.static_folder, 'Generated_Audio', f"{text.replace(' ', '_')}.mp3")
        with open(audio_filename, "wb") as out:
            out.write(response.audio_content)

        # Return the URL for the generated audio file
        return jsonify({"audio_url": f"/static/Generated_Audio/{os.path.basename(audio_filename)}"})

    except Exception as e:
        print(f"Error generating audio: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/audio/<filename>')
def serve_audio(filename):
    """Serve audio files for playback."""
    try:
        return send_from_directory(AUDIO_FILES_DIR, filename)
    except FileNotFoundError:
        return f"File {filename} not found.", 404

@app.route('/process-transcription', methods=['POST'])
def process_transcription():
    try:
        # Parse JSON data from the POST request
        data = request.get_json()
        transcription = data.get('transcription')

        if not transcription:
            return jsonify({"error": "No transcription provided."}), 400

        return jsonify({"message": "Transcription received.", "transcription": transcription})
    except Exception as e:
        print(f"Error processing transcription: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/predict-audio', methods=['POST'])
def predict_audio():
    """Predict the class of the selected audio file."""
    try:
        # Check if the model is loaded
        if clf is None:
            print("Error: Model is not loaded.")
            return jsonify({"error": "Model is not loaded. Please check your deployment."}), 500

        if not request.is_json:
            print("Error: Invalid content type. Expected JSON.")
            return jsonify({"error": "Invalid content type. Expected 'application/json'."}), 415

        data = request.get_json()
        filename = data.get('filename')
        if not filename:
            print("Error: Filename not provided.")
            return jsonify({"error": "Filename not provided."}), 400

        # Check if the audio file exists
        audio_path = os.path.join(AUDIO_FILES_DIR, filename)
        if not os.path.exists(audio_path):
            print(f"Error: File '{filename}' not found in {AUDIO_FILES_DIR}.")
            return jsonify({"error": f"File '{filename}' not found."}), 404

        print(f"Audio file path: {audio_path}")

        # Extract MFCC features
        audio_data, sr = librosa.load(audio_path, sr=None)
        print(f"Audio loaded successfully. Sample rate: {sr}, Audio data shape: {audio_data.shape}")
        mfcc_features = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=39)
        print(f"MFCC features shape: {mfcc_features.shape}")
        mfcc_mean = np.mean(mfcc_features.T, axis=0).reshape(1, -1)

        # Create a DataFrame with the MFCC features
        column_names = [f'mfcc_{i+1}' for i in range(39)]
        mfcc_mean_df = pd.DataFrame(mfcc_mean, columns=column_names)
        print(f"MFCC DataFrame: {mfcc_mean_df}")

        # Predict using the loaded model
        probabilities = clf.predict_proba(mfcc_mean_df)
        prediction = clf.predict(mfcc_mean_df)[0]

        print(f"Prediction: {prediction}, Probabilities: {probabilities}")
        return jsonify({
            "filename": filename,
            "prediction": prediction,
            "probabilities": probabilities.tolist()
        })

    except Exception as e:
        print(f"Error in prediction route: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Flask app...")
    load_model()  # Ensure the model is loaded
    app.run(debug=True)