from flask import Flask, request, jsonify, render_template, send_file
import pronouncing
import os
import json
import re
from difflib import SequenceMatcher
from Levenshtein import ratio
from gtts import gTTS
import tempfile
from rapidfuzz import fuzz

app = Flask(__name__)

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

# ----------------- Audio Generation -----------------
@app.route('/get_native_audio')
def get_native_audio():
    text = request.args.get('text', '')
    if not text:
        return jsonify({'error': 'No text provided'}), 400

    tts = gTTS(text=text, lang='en')
    temp_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3").name
    tts.save(temp_path)
    return send_file(temp_path, mimetype='audio/mpeg')

# ----------------- Load Sentences -----------------
@app.route('/get-test-sentences', methods=['GET'])
def get_test_sentences():
    try:
        json_path = os.path.join(os.getcwd(), "static", "sentences.json")
        if not os.path.exists(json_path):
            return jsonify({"error": "sentences.json file not found!"}), 404
        with open(json_path, "r", encoding="utf-8") as file:
            data = json.load(file)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)})

# ----------------- Pronunciation Analysis -----------------
@app.route('/analyze', methods=['POST'])
def analyze_pronunciation():
    try:
        data = request.json
        target_sentence = data.get('target_sentence', '').lower().strip()
        user_speech = data.get('user_speech', '').lower().strip()
        strictness = data.get('strictness', 'medium')

        def preprocess_sentence(sentence):
            return re.sub(r'[^\w\s]', '', sentence).strip()

        target_sentence = preprocess_sentence(target_sentence)
        user_speech = preprocess_sentence(user_speech)

        def sentence_to_phonemes(sentence):
            return [pronouncing.phones_for_word(word)[0] if pronouncing.phones_for_word(word) else "" for word in sentence.split()]

        target_phonemes = sentence_to_phonemes(target_sentence)
        user_phonemes = sentence_to_phonemes(user_speech)

        if not target_phonemes or not user_phonemes:
            return jsonify({"error": "Phoneme extraction failed. Check input sentences."}), 400

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
            for p in key_phonemes:
                if p in t_ph and p not in u_ph:
                    return False
            return True

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

        # ✅ NEW: Word-level matching
        def word_match_ratio(ref, hypo):
            ref_words = ref.split()
            hypo_words = hypo.split()
            matches = sum(1 for r, h in zip(ref_words, hypo_words) if r == h)
            return (matches / len(ref_words)) * 100 if ref_words else 0

        word_match = word_match_ratio(target_sentence, user_speech)

        return jsonify({
            "target_phonemes": target_phonemes,
            "user_phonemes": user_phonemes,
            "transcription": user_speech,
            "similarity": round(similarity_score, 2),
            "word_match": round(word_match, 2),  # ✅ Included in response
            "accuracy": round(accuracy, 2),
            "strictness": strictness
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ----------------- Run -----------------
if __name__ == '__main__':
    app.run(debug=True)
