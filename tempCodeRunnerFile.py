from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import joblib
import librosa
import numpy as np
import pandas as pd

# Initialize Flask app
app = Flask(__name__)

# Paths for audio files and trained model
AUDIO_FILES_DIR = '/Users/PC/Desktop/SENIOR PROJECT 3/Animal sound'  # Directory to store audio files
MODEL_PATH = '/Users/PC/Desktop/SENIOR PROJECT 3/decision_tree_model.joblib'

# Ensure the audio directory exists
os.makedirs(AUDIO_FILES_DIR, exist_ok=True)

# Load the trained model
clf = None


def load_model():
    """Load the trained decision tree model."""
    global clf
    if os.path.exists(MODEL_PATH):
        clf = joblib.load(MODEL_PATH)
        print(f"Model loaded successfully from: {MODEL_PATH}")
    else:
        print(f"Model not found at: {MODEL_PATH}. Please train the model first.")


@app.route('/')
def home():
    """Render the homepage with the file selection options."""
    # List available audio files in the directory
    audio_files = [f for f in os.listdir(AUDIO_FILES_DIR) if f.endswith('.wav')]
    return render_template('index.html', audio_files=audio_files)

@app.route('/lesson1')
def lesson1():
    """Render the Lesson 1 page."""
    return render_template('lesson1.html')

@app.route('/lesson2')
def lesson2():
    """Render the Lesson 2 page."""
    return render_template('lesson2.html')

@app.route('/lesson3')
def lesson3():
    """Render the Lesson 3 page."""
    return render_template('lesson3.html')

@app.route('/lesson4')
def lesson4():
    """Render the Lesson 4 page."""
    return render_template('lesson4.html')



@app.route('/audio/<filename>')
def serve_audio(filename):
    """Serve audio files for playback."""
    try:
        print(f"Serving file: {filename}")  # Debugging line
        return send_from_directory(AUDIO_FILES_DIR, filename)
    except FileNotFoundError:
        print(f"File {filename} not found.")  # Debugging line
        return f"File {filename} not found.", 404
    

@app.route('/process-transcription', methods=['POST'])
def process_transcription():
    try:
        # Parse JSON data from the POST request
        data = request.get_json()
        transcription = data.get('transcription')

        if not transcription:
            return jsonify({"error": "No transcription provided."}), 400

        # Debugging: Print the transcription
        print(f"Received transcription: {transcription}")

        # (Optional) Process the transcription (e.g., save to a file or analyze it)
        # For now, just return the transcription as a response
        return jsonify({"message": "Transcription received.", "transcription": transcription})
    except Exception as e:
        print(f"Error processing transcription: {e}")
        return jsonify({"error": str(e)}), 500

    

@app.route('/predict-audio', methods=['POST'])
def predict_audio():
    """Predict the class of the selected audio file."""
    try:
        # Check if the request contains JSON data
        if not request.is_json:
            return jsonify({"error": "Invalid content type. Expected 'application/json'."}), 415

        data = request.get_json()
        filename = data.get('filename')
        if not filename:
            return jsonify({"error": "Filename not provided."}), 400

        audio_path = os.path.join(AUDIO_FILES_DIR, filename)
        if not os.path.exists(audio_path):
            return jsonify({"error": f"File '{filename}' not found."}), 404

        print(f"Selected audio file from server: {filename}")

        # Extract MFCC features
        audio_data, sr = librosa.load(audio_path, sr=None)
        mfcc_features = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=39)
        mfcc_mean = np.mean(mfcc_features.T, axis=0).reshape(1, -1)

        # Match the model's feature names
        column_names = [f'mfcc_{i+1}' for i in range(39)]
        mfcc_mean_df = pd.DataFrame(mfcc_mean, columns=column_names)

        # Predict probabilities
        probabilities = clf.predict_proba(mfcc_mean_df)
        prediction = clf.predict(mfcc_mean_df)[0]

        print(f"Prediction probabilities: {probabilities}")
        print(f"Prediction result: {prediction}")

        return jsonify({
            "filename": filename,
            "prediction": prediction,
            "probabilities": probabilities.tolist()
        })
    
   

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500
    

if __name__ == '__main__':
    print("Starting Flask app...")
    load_model()  # Ensure the model is loaded
    app.run(debug=True)