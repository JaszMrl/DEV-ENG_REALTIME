from flask import Flask, request, jsonify, render_template
import pronouncing
import os
import json
import re
from difflib import SequenceMatcher
from Levenshtein import ratio

app = Flask(__name__)

# หน้าหลัก
@app.route('/')
def home():
    return render_template('index.html')

# หน้าผู้ใช้
@app.route('/user')
def user():
    return render_template('user.html')

# หน้าความยาก
@app.route('/difficulty')
def difficulty():
    return render_template('difficulty.html')

# หน้าตั้งค่า
@app.route('/settings')
def settings():
    return render_template('settings.html')

# หน้าทดสอบ
@app.route('/test')
def speech_test():
    return render_template('test.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/forget-password')
def forget_password():
    return render_template('forget-password.html')

# API สำหรับดึงประโยคทดสอบ
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

# API วิเคราะห์การออกเสียง
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
            phonemes = [pronouncing.phones_for_word(word)[0] if pronouncing.phones_for_word(word) else "" for word in sentence.split()]
            return phonemes

        target_phonemes = sentence_to_phonemes(target_sentence)
        user_phonemes = sentence_to_phonemes(user_speech)

        if not target_phonemes or not user_phonemes or len(target_phonemes) == 0 or len(user_phonemes) == 0:
            return jsonify({"error": "Phoneme extraction failed. Check input sentences."}), 400

        def phoneme_similarity(phoneme1, phoneme2):
            key_phonemes = {"TH", "S", "NG", "STH"}  # Key phonemes to check
            penalty_factor = 1.5  # Increase penalty for incorrect target phonemes
            
            seq_match_score = SequenceMatcher(None, phoneme1, phoneme2).ratio()
            lev_score = ratio(phoneme1, phoneme2)
            base_score = (lev_score * 0.7) + (seq_match_score * 0.3)
            
            if phoneme1 in key_phonemes and phoneme1 != phoneme2:
                return base_score / penalty_factor  # Reduce score for key phonemes
            
            return base_score

        correct = sum(phoneme_similarity(t, u) for t, u in zip(target_phonemes, user_phonemes))
        total = len(target_phonemes)
        accuracy = (correct / total) * 100 if total > 0 else 0

        def check_key_phonemes(target_phonemes, user_phonemes):
            key_phonemes = {"TH", "S", "NG", "STH"}
            for phoneme in key_phonemes:
                if phoneme in target_phonemes and phoneme not in user_phonemes:
                    return False  # Critical phoneme is missing
            return True

        if not check_key_phonemes(target_phonemes, user_phonemes):
            accuracy *= 0.7  # Reduce accuracy if key phonemes are missing

        if accuracy > 95:
            accuracy *= 0.98

        if strictness == "high" and accuracy < 95:
            accuracy *= 0.85  # 10% penalty if below 95%
        elif strictness == "very_high" and accuracy < 98:
            accuracy *= 0.75  # 15% penalty if below 98%

        accuracy = max(0, min(accuracy, 100))

        print(f"Strictness: {strictness}, Accuracy Before Scaling: {accuracy}%")

        return jsonify({
            "target_phonemes": target_phonemes,
            "user_phonemes": user_phonemes,
            "accuracy": round(accuracy, 2),
            "strictness": strictness
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
