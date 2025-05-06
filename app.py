from flask import Flask, request, jsonify, render_template, send_file, after_this_request
import os, re, uuid
from difflib import SequenceMatcher
from Levenshtein import ratio
from gtts import gTTS
import pronouncing
import joblib
import librosa
import numpy as np
import soundfile as sf
import noisereduce as nr
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
from rapidfuzz import fuzz
from dotenv import load_dotenv
import openai
from google.cloud import speech
load_dotenv()

app = Flask(__name__)
score_model = joblib.load("score_classifier_model.pkl")

REFERENCE_AUDIO_FILES = {
    "male": {
        "alloy": "male_reference_alloy.wav",
        "echo": "male_reference_echo.wav",
        "onyx": "male_reference_onyx.wav",
        "fable": "male_reference_fable.wav"
    },
    "female": {
        "nova": "female_reference_nova.wav",
        "alloy": "female_reference_alloy.wav",
        "shimmer": "female_reference_shimmer.wav"
    }
}

# ----------------- Helpers -----------------
def extract_mfcc(file_path, n_mfcc=13):
    y, sr = librosa.load(file_path, sr=16000)
    return librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc).T

import ffmpeg

def preprocess_audio(input_file, output_file, target_sr=16000):
    try:
        # If input is webm, we specify opus audio codec conversion
        if input_file.endswith('.webm'):
            ffmpeg.input(input_file).output(output_file, ar=target_sr, acodec='pcm_s16le').run(overwrite_output=True)
        else:
            ffmpeg.input(input_file).output(output_file, ar=target_sr).run(overwrite_output=True)
    except Exception as e:
        raise RuntimeError(f"FFmpeg conversion failed: {e}")
    y, sr = librosa.load(output_file, sr=target_sr, mono=True)
    sf.write(output_file, y, sr)
    return output_file

def normalize(text):
    return re.sub(r'[^\w\s]', '', text).lower().strip()

def remove_noise(audio_path):
    y, sr = librosa.load(audio_path, sr=16000)
    y_denoised = nr.reduce_noise(y=y, sr=sr)
    denoised_path = "denoised_" + os.path.basename(audio_path)
    sf.write(denoised_path, y_denoised, sr)
    return denoised_path

def compute_similarity(distance, num_frames):
    base = 15000
    max_distance = base + (num_frames * 500)
    normalized_distance = max(0, min(distance, max_distance))
    similarity = 100 * (1 - (normalized_distance / max_distance))
    return round(similarity, 2)

def compare_accent_with_reference(user_mfcc, reference_mfcc):
    distance, _ = fastdtw(user_mfcc, reference_mfcc, dist=euclidean)
    return compute_similarity(distance, len(user_mfcc))

def compare_with_multiple_references(user_mfcc, reference_mfccs):
    best_similarity = 0
    best_voice = None
    for voice, ref_mfcc in reference_mfccs.items():
        sim = compare_accent_with_reference(user_mfcc, ref_mfcc)
        if sim > best_similarity:
            best_similarity = sim
            best_voice = voice
    return best_voice, best_similarity

def predict_score_from_similarity(similarity_percent):
    input_feature = np.array([[similarity_percent]])
    return score_model.predict(input_feature)[0]

def generate_speech_if_not_exists(text, voices):
    load_dotenv()
    openai.api_key = os.getenv("OPENAI_API_KEY")
    reference_mfccs = {}

    for voice in voices:
        # Unique file per sentence + voice
        safe_text = re.sub(r'\W+', '_', text.lower())[:30]
        file_path = f"refs/{voice}_{safe_text}.wav"

        if not os.path.exists(file_path):
            response = openai.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text
            )
            with open(file_path, "wb") as f:
                f.write(response.content)

        reference_mfccs[voice] = extract_mfcc(file_path)

    return reference_mfccs

# ----------------- Analyze Route -----------------
@app.route('/analyze_audio', methods=['POST'])
def analyze_audio():
    try:
        audio_file = request.files.get('audio')
        sentence = request.form.get('target_sentence', '').strip()

        if not audio_file or not sentence:
            return jsonify({"error": "Missing audio or sentence"}), 400

        # Save uploaded file
        filename = f"user_audio_{uuid.uuid4().hex}.webm"
        audio_path = os.path.join("temp", filename)
        audio_file.save(audio_path)

        # Convert to WAV
        processed_path = preprocess_audio(audio_path, "processed.wav")
        denoised_path = remove_noise(processed_path)

        # ✅ Google Speech-to-Text: Transcribe user speech
        client = speech.SpeechClient()
        with open(denoised_path, "rb") as audio_file:
                content = audio_file.read()

        audio = speech.RecognitionAudio(content=content)
        config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=16000,
                language_code="en-US"
            )

        print("📥 Sending audio to Google STT...")
        try:
            response = client.recognize(config=config, audio=audio)
            print("📝 Google STT response received:", response)
        except Exception as e:
            print("❌ Google STT error:", e)
            return jsonify({"error": "Google STT failed", "details": str(e)}), 500

        user_transcript = " ".join([r.alternatives[0].transcript for r in response.results]).strip()

        from rapidfuzz import fuzz

        def word_match_ratio(ref, hypo):
            ref_words = ref.lower().strip().split()
            hypo_words = hypo.lower().strip().split()
            matches = sum(1 for r, h in zip(ref_words, hypo_words) if r == h)
            return (matches / len(ref_words)) * 100 if ref_words else 0

        similarity = fuzz.ratio(normalize(user_transcript), normalize(sentence))
        word_match = word_match_ratio(normalize(sentence), normalize(user_transcript))

        # Calculate combined similarity using both transcript similarity and accent similarity
        combined_similarity = 0  # fallback if no accent score yet


        if similarity < 85 or word_match < 70:
            return jsonify({
                "transcription": user_transcript,
                "target_sentence": sentence,
                "similarity": round(similarity, 2),
                "word_match": round(word_match, 2),
                "error": "Spoken sentence doesn't match target sentence closely enough.",
                "score": 0
            }), 200

       # ✅ Compare accent
        user_mfcc = extract_mfcc(denoised_path)
        reference_mfccs = generate_speech_if_not_exists(sentence, REFERENCE_AUDIO_FILES["male"])
        best_voice, accent_similarity = compare_with_multiple_references(user_mfcc, reference_mfccs)  # ✅ renamed
        score = predict_score_from_similarity(accent_similarity)

        # Combine the similarity and accent similarity
        combined_similarity = (similarity + accent_similarity) / 2
        bonus = 0.5 if combined_similarity >= 80 else 0.0

        # Cleanup
        os.remove(audio_path)
        os.remove(processed_path)
        os.remove(denoised_path)

        return jsonify({
        "transcription": user_transcript,
        "target_sentence": sentence,
        "similarity": round(similarity, 2),
        "word_match": round(word_match, 2),
        "accent_similarity": round(accent_similarity, 2),
        "accent_score": round(score, 2),
        "combined_similarity": round(combined_similarity, 2),
        "bonus_score": bonus
    })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze_pronunciation():
    try:
        data = request.json
        target_sentence = data.get('target_sentence', '').lower().strip()
        user_speech = data.get('user_speech', '').lower().strip()
        if not user_speech:
            return jsonify({"error": "User speech is empty. Cannot generate accent score."}), 400
        strictness = data.get('strictness', 'medium')

        def preprocess_sentence(sentence):
            return re.sub(r'[^\w\s]', '', sentence).strip()

        def sentence_to_phonemes(sentence):
            return [pronouncing.phones_for_word(word)[0] if pronouncing.phones_for_word(word) else "" for word in sentence.split()]

        target_sentence = preprocess_sentence(target_sentence)
        user_speech = preprocess_sentence(user_speech)
        target_phonemes = sentence_to_phonemes(target_sentence)
        user_phonemes = sentence_to_phonemes(user_speech)

        if not target_phonemes or not user_phonemes:
            return jsonify({"error": "Phoneme extraction failed."}), 400

        def phoneme_similarity(p1, p2):
            key_phonemes = {"TH", "S", "NG", "STH"}
            penalty_factor = 1.5
            seq_score = SequenceMatcher(None, p1, p2).ratio()
            lev_score = ratio(p1, p2)
            base_score = (lev_score * 0.7) + (seq_score * 0.3)
            if p1 in key_phonemes and p1 != p2:
                return base_score / penalty_factor
            return base_score

        correct = sum(phoneme_similarity(t, u) for t, u in zip(target_phonemes, user_phonemes))
        total = len(target_phonemes)
        accuracy = (correct / total) * 100 if total > 0 else 0

        def check_key_phonemes(t_ph, u_ph):
            key_phonemes = {"TH", "S", "NG", "STH"}
            return all(p not in t_ph or p in u_ph for p in key_phonemes)

        if not check_key_phonemes(target_phonemes, user_phonemes):
            accuracy *= 0.7
        if accuracy > 95:
            accuracy *= 0.98
        if strictness == "high" and accuracy < 95:
            accuracy *= 0.85
        elif strictness == "very_high" and accuracy < 98:
            accuracy *= 0.75

        accuracy = max(0, min(accuracy, 100))
        similarity_score = fuzz.ratio(target_sentence, user_speech)

        def word_match_ratio(ref, hypo):
            ref_words = ref.split()
            hypo_words = hypo.split()
            matches = sum(1 for r, h in zip(ref_words, hypo_words) if r == h)
            return (matches / len(ref_words)) * 100 if ref_words else 0

        word_match = word_match_ratio(target_sentence, user_speech)

        def flag_accent_mistakes(t_ph, u_ph):
            accent_issues = []
            confusions = {
                "TH": ["D", "T"], "V": ["B", "W", "F"],
                "L": ["R"], "R": ["L"],
                "S": ["SH"], "Z": ["S"], "NG": ["N"]
            }
            for t, u in zip(t_ph, u_ph):
                for key, wrongs in confusions.items():
                    if key in t and any(conf in u for conf in wrongs):
                        accent_issues.append(f"{key} → {u}")
            return accent_issues

        accent_mistakes = flag_accent_mistakes(target_phonemes, user_phonemes)

        # Accent Score
        temp_wav = f"user_audio_{uuid.uuid4().hex}.mp3"
        gTTS(user_speech, lang='en').save(temp_wav)
        processed = preprocess_audio(temp_wav, "processed.wav")
        denoised = remove_noise("processed.wav")
        user_mfcc = extract_mfcc(denoised)
        reference_mfccs = generate_speech_if_not_exists(target_sentence, REFERENCE_AUDIO_FILES["male"])
        _, accent_similarity = compare_with_multiple_references(user_mfcc, reference_mfccs)
        accent_score = predict_score_from_similarity(accent_similarity)
        os.remove(temp_wav)

        try:
            os.remove("processed.wav")
            os.remove("denoised_processed.wav")
        except Exception as cleanup_err:
            print("⚠️ Cleanup error:", cleanup_err)

        return jsonify({
            "target_phonemes": target_phonemes,
            "user_phonemes": user_phonemes,
            "transcription": user_speech,
            "similarity": round(similarity_score, 2),
            "word_match": round(word_match, 2),
            "accuracy": round(accuracy, 2),
            "strictness": strictness,
            "accent_issues": accent_mistakes,
            "accent_score": round(accent_score, 2),
            "accent_similarity": round(accent_similarity, 2)
        })

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# ----------------- TTS Endpoint -----------------
@app.route('/get_native_audio')
def get_native_audio():
    try:
        text = request.args.get("text", "").strip()
        if not text:
            return "Missing text", 400

        filename = f"tts_{uuid.uuid4().hex}.mp3"
        tts = gTTS(text, lang="en")
        tts.save(filename)

        @after_this_request
        def remove_file(response):
            try: os.remove(filename)
            except: pass
            return response

        return send_file(filename, mimetype="audio/mpeg", as_attachment=False)

    except Exception as e:
        return f"Error generating audio: {str(e)}", 500

# ----------------- UI Pages -----------------
@app.route('/')
def home(): return render_template('index.html')

@app.route('/user')
def user(): return render_template('user.html')

@app.route('/difficulty')
def difficulty(): return render_template('difficulty.html')

@app.route('/settings')
def settings(): return render_template('settings.html')

@app.route('/test')
def speech_test(): return render_template('test.html')

@app.route('/learn')
def learn(): return render_template('learn.html', current_page='learn')

@app.route('/lesson1')
def lesson1(): return render_template('lesson1.html')

@app.route('/lesson2')
def lesson2(): return render_template('lesson2.html')

@app.route('/lesson3')
def lesson3(): return render_template('lesson3.html')

@app.route('/lesson4')
def lesson4(): return render_template('lesson4.html')

@app.route('/lesson5')
def lesson5(): return render_template('lesson5.html')

@app.route('/admin')
def admin(): return render_template('admin.html')

@app.route('/forget-password')
def forget_password(): return render_template('forget-password.html')

# ----------------- Run -----------------
if __name__ == '__main__':
    app.run(debug=True)
