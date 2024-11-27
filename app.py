from flask import Flask, request, jsonify, render_template
from accent_phoneme_dict import ACCENT_PHONEME_DICT  # Import the dictionary
import pronouncing
from Levenshtein import ratio

app = Flask(__name__)

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
        # Parse request data
        data = request.json
        target_sentence = data.get('target_sentence', '').lower()
        user_speech = data.get('user_speech', '').lower()
        accent = data.get('accent', 'en-US')  # Accent specified in the request

        # Preprocess and convert to phonemes
        def preprocess_sentence(sentence):
            import re
            return re.sub(r'[^\w\s]', '', sentence).strip()

        target_sentence = preprocess_sentence(target_sentence)
        user_speech = preprocess_sentence(user_speech)

        # Map words to phonemes
        def words_to_phoneme_mapping(sentence, accent):
            word_to_phoneme = {}
            for word in sentence.split():
                phoneme = get_accent_phonemes(word, accent)
                word_to_phoneme[word] = phoneme
            return word_to_phoneme

        # Generate phoneme mappings for target and user speech
        target_mapping = words_to_phoneme_mapping(target_sentence, accent)
        user_mapping = words_to_phoneme_mapping(user_speech, accent)

        # Align phonemes and their corresponding words
        target_words = list(target_mapping.keys())
        user_words = list(user_mapping.keys())

        target_phonemes = list(target_mapping.values())
        user_phonemes = list(user_mapping.values())

        max_length = max(len(target_phonemes), len(user_phonemes))
        target_phonemes.extend([""] * (max_length - len(target_phonemes)))
        user_phonemes.extend([""] * (max_length - len(user_phonemes)))

        target_words.extend([""] * (max_length - len(target_words)))
        user_words.extend([""] * (max_length - len(user_words)))

        # Compare phonemes
        def compare_phonemes_with_correction(target, user, target_word):
            if not target or not user:
                return {"match": False, "correction": "No input detected."}
            similarity = ratio(target, user)
            match = similarity > 0.999  # Adjust threshold as needed
            correction = (
                f"Try pronouncing the word '{target_word}' more clearly."
                if not match
                else "Good job!"
            )
            return {"match": match, "correction": correction, "similarity": similarity}

        # Generate feedback
        feedback = [
            compare_phonemes_with_correction(t, u, w)
            for t, u, w in zip(target_phonemes, user_phonemes, target_words)
        ]

        # Calculate weighted accuracy
        accuracy = sum(1 for f in feedback if f["match"]) / len(feedback) * 100 if feedback else 0

        return jsonify({
            "target_phonemes": target_phonemes,
            "user_phonemes": user_phonemes,
            "accuracy": accuracy,
            "feedback": feedback,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

if __name__ == '__main__':
    app.run(debug=True)
