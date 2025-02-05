from flask import Flask, request, jsonify, render_template
import pronouncing
import os
import json
from Levenshtein import ratio

app = Flask(__name__)

# Home Page
@app.route('/')
def home():
    return render_template('index.html')

# User Page
@app.route('/user')
def user():
    return render_template('user.html')
  # Added a user page

# Difficulty Page
@app.route('/difficulty')
def difficulty():
    return render_template('difficulty.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')


# Test Page
@app.route('/test')
def speech_test():
    return render_template('test.html')

# Get Test Sentences API
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

# Pronunciation Analysis API
@app.route('/analyze', methods=['POST'])
def analyze_pronunciation():
    try:
        data = request.json
        target_sentence = data.get('target_sentence', '').lower()
        user_speech = data.get('user_speech', '').lower()

        # Clean sentences
        def preprocess_sentence(sentence):
            import re
            return re.sub(r'[^\w\s]', '', sentence).strip()

        target_sentence = preprocess_sentence(target_sentence)
        user_speech = preprocess_sentence(user_speech)

        # Convert to phonemes
        def sentence_to_phonemes(sentence):
            phonemes = [pronouncing.phones_for_word(word)[0] if pronouncing.phones_for_word(word) else "" for word in sentence.split()]
            return phonemes

        target_phonemes = sentence_to_phonemes(target_sentence)
        user_phonemes = sentence_to_phonemes(user_speech)

        # Compare phonemes
        correct = sum(1 for t, u in zip(target_phonemes, user_phonemes) if t == u)
        total = len(target_phonemes)
        accuracy = (correct / total) * 100 if total > 0 else 0

        return jsonify({
            "target_phonemes": target_phonemes,
            "user_phonemes": user_phonemes,
            "accuracy": accuracy
        })

    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == '__main__':
    app.run(debug=True)
