from flask import Flask, request, jsonify, render_template
from accent_phoneme_dict import ACCENT_PHONEME_DICT  # Import the dictionary
import pronouncing
import os
import json
from Levenshtein import ratio

app = Flask(__name__)
@app.route('/get-test-sentences', methods=['GET'])
def get_test_sentences():
    try:
        json_path = os.path.join(os.getcwd(), "static", "sentences.json")  # Ensure correct absolute path
        if not os.path.exists(json_path):
            return jsonify({"error": "sentences.json file not found!"}), 404
        
        with open(json_path, "r", encoding="utf-8") as file:
            data = json.load(file)

        print("✅ Loaded Sentences JSON:", data)  # Debugging Output
        return jsonify(data)
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return jsonify({"error": str(e)})



def get_accent_phonemes(word, accent="en-US"):
    # Use accent-specific dictionary if available
    if accent in ACCENT_PHONEME_DICT and word in ACCENT_PHONEME_DICT[accent]:
        return ACCENT_PHONEME_DICT[accent][word]
    # Fallback to CMU Pronouncing Dictionary
    phonemes = pronouncing.phones_for_word(word)
    return phonemes[0] if phonemes else ""

@app.route('/analyze', methods=['POST'])
def analyze_pronunciation():
    try:
        data = request.json
        target_sentence = data.get('target_sentence', '').lower()
        user_speech = data.get('user_speech', '').lower()

        # Preprocess and clean sentences
        def preprocess_sentence(sentence):
            import re
            return re.sub(r'[^\w\s]', '', sentence).strip()

        target_sentence = preprocess_sentence(target_sentence)
        user_speech = preprocess_sentence(user_speech)

        # Convert to phonemes
        def sentence_to_phonemes(sentence):
            phonemes = []
            for word in sentence.split():
                word_phonemes = pronouncing.phones_for_word(word)
                phonemes.append(word_phonemes[0] if word_phonemes else "")
            return phonemes

        target_phonemes = sentence_to_phonemes(target_sentence)
        user_phonemes = sentence_to_phonemes(user_speech)

        # Compare phonemes and calculate accuracy
        correct = sum(1 for t, u in zip(target_phonemes, user_phonemes) if t == u)
        total = len(target_phonemes)
        accuracy = (correct / total) * 100 if total > 0 else 0

        # Debugging Output
        print(f"Target: {target_sentence} -> {target_phonemes}")
        print(f"User: {user_speech} -> {user_phonemes}")
        print(f"Accuracy: {accuracy:.2f}%")

        return jsonify({
            "target_phonemes": target_phonemes,
            "user_phonemes": user_phonemes,
            "accuracy": accuracy
        })

    except Exception as e:
        return jsonify({"error": str(e)})


# Home Page
@app.route('/')
def home():
    return render_template('index.html')

# Easy Mode Page
@app.route('/easy')
def easy():
    return render_template('easy-mode.html')

# Medium Mode Page
@app.route('/medium')
def medium():
    return render_template('medium-mode.html')

# Hard Mode Page
@app.route('/hard')
def hard():
    return render_template('hard-mode.html')

@app.route('/difficulty')
def difficulty():
    return render_template('index.html')

@app.route('/test')
def speech_test():
    return render_template('test.html')


if __name__ == '__main__':
    app.run(debug=True)
