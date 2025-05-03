import os
import librosa
import numpy as np
import soundfile as sf
from google.cloud import speech
from google.oauth2 import service_account
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
import noisereduce as nr
import openai
from rapidfuzz import fuzz
import sounddevice as sd
import wavio
import time
import keyboard

import joblib
score_model = joblib.load("score_classifier_model.pkl")


# ตั้งค่า API Key สำหรับ OpenAI
openai.api_key = "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"

# ตั้งค่า Google Cloud Speech-to-Text
GCP_CREDENTIALS = "C:/Users/User/Downloads/speech-to-text-449108-a475f8d995b3.json"

# 🔹 แยกเสียงต้นแบบเป็นชายและหญิง
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

def predict_score_from_similarity(similarity_percent):
    input_feature = np.array([[similarity_percent]])  # similarity% ต้องทำเป็น shape (1,1)
    score = score_model.predict(input_feature)[0]
    return score


def record_audio_by_key(filename="user_recorded.wav", fs=16000):
    """เริ่มอัดเมื่อกด 's' และหยุดเมื่อกด 'e'"""
    print("⌨️ กด 's' เพื่อเริ่มพูด และกด 'e' เพื่อหยุดพูด")

    while True:
        if keyboard.is_pressed('s'):
            print("🎙️ เริ่มอัดเสียง...")
            recording = []
            start_time = time.time()

            def callback(indata, frames, time_, status):
                recording.append(indata.copy())

            with sd.InputStream(samplerate=fs, channels=1, callback=callback):
                while not keyboard.is_pressed('e'):
                    sd.sleep(100)
                print("🛑 หยุดอัดเสียงแล้ว")

            audio_data = np.concatenate(recording, axis=0)
            wavio.write(filename, audio_data, fs, sampwidth=2)
            print(f"✅ บันทึกเสียงไว้ที่ {filename}")
            break
        else:
            time.sleep(0.1)


def remove_noise(audio_path):
    """ ลดเสียงรบกวนจากไฟล์เสียง """
    y, sr = librosa.load(audio_path, sr=16000)
    y_denoised = nr.reduce_noise(y=y, sr=sr, prop_decrease=0.8)
    denoised_path = "denoised_" + os.path.basename(audio_path)
    sf.write(denoised_path, y_denoised, sr)
    return denoised_path

def generate_speech_if_not_exists(text, voices):
    """ ตรวจสอบว่าไฟล์เสียงต้นแบบมีอยู่หรือไม่ ถ้าไม่มีให้สร้างใหม่ """
    reference_mfccs = {}
    for voice, file_path in voices.items():
        if not os.path.exists(file_path):
            print(f"🔹 ไฟล์ {file_path} ไม่มีอยู่ กำลังสร้างจาก GPT...")
            response = openai.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text
            )
            with open(file_path, "wb") as f:
                f.write(response.content)
        reference_mfccs[voice] = extract_mfcc(file_path)
    return reference_mfccs

def preprocess_audio(input_file, output_file, target_sr=16000):
    """ แปลงไฟล์เสียงเป็น Mono และ 16kHz """
    y, sr = librosa.load(input_file, sr=target_sr, mono=True)  
    sf.write(output_file, y, target_sr, format='WAV')  
    return output_file

def extract_mfcc(file_path, n_mfcc=13):
    """ ดึง MFCC จากไฟล์เสียง """
    y, sr = librosa.load(file_path, sr=16000)  
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n_mfcc).T  
    return mfcc

def speech_to_text(file_path, expected_text):
    """ แปลงเสียงเป็นข้อความ และตรวจสอบความถูกต้องแบบ fuzzy """
    credentials = service_account.Credentials.from_service_account_file(GCP_CREDENTIALS)
    client = speech.SpeechClient(credentials=credentials)

    with open(file_path, "rb") as audio_file:
        content = audio_file.read()

    audio = speech.RecognitionAudio(content=content)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="en-US"
    )

    response = client.recognize(config=config, audio=audio)

    if not response.results:
        print("⚠️ ไม่สามารถแปลงเสียงเป็นข้อความได้")
        return False, None

    transcript = response.results[0].alternatives[0].transcript
    confidence = response.results[0].alternatives[0].confidence

    print(f"📢 Transcript: {transcript}")
    print(f"🔹 Confidence: {confidence:.2f}")

    # ใช้ fuzzy matching แทนการเปรียบเทียบตรงๆ
    similarity_score = fuzz.ratio(expected_text.lower(), transcript.lower())
    print(f"🧠 Text Similarity: {similarity_score:.2f}")

    # กำหนด threshold เช่น >= 85 ถือว่าผ่าน
    return similarity_score >= 85, transcript

def compute_similarity(distance, num_frames):
    """
    คำนวณ similarity โดยใช้ max_distance เริ่มต้นที่ 15000 และเพิ่มตามจำนวนเฟรม
    """
    base = 15000
    max_distance = base + (num_frames * 500)  # เพิ่มตามความยาวเสียงเล็กน้อย
    min_distance = 0

    normalized_distance = max(min_distance, min(distance, max_distance))
    similarity = 100 * (1 - (normalized_distance - min_distance) / (max_distance - min_distance))
    print(max_distance)
    return round(similarity, 2)


def compare_accent_with_reference(user_mfcc, reference_mfcc):
    distance, _ = fastdtw(user_mfcc, reference_mfcc, dist=lambda x, y: euclidean(x, y))
    similarity = compute_similarity(distance, len(user_mfcc))
    return similarity



def compare_with_multiple_references(user_mfcc, reference_mfccs):
    best_similarity = 0
    best_voice = None

    for voice, ref_mfcc in reference_mfccs.items():
        similarity = compare_accent_with_reference(user_mfcc, ref_mfcc)
        if similarity > best_similarity:
            best_similarity = similarity
            best_voice = voice

    return best_voice, best_similarity


def main():
    expected_text = "good morning"
    user_gender = "male"
    reference_mfccs = generate_speech_if_not_exists(expected_text, REFERENCE_AUDIO_FILES[user_gender])

    print(f"🎤 กรุณาพูดประโยค: \"{expected_text}\"")
    recorded_file = "user_recorded.wav"
    record_audio_by_key(recorded_file)
    processed_audio = preprocess_audio(recorded_file, "processed_input.wav")
    denoised_audio = remove_noise("processed_input.wav")
    is_correct, recognized_text = speech_to_text(denoised_audio, expected_text)

    if is_correct:
        print("✅ คำพูดถูกต้อง! กำลังประเมินสำเนียง...")
        mfcc_user = extract_mfcc(denoised_audio)
        best_voice, best_similarity = compare_with_multiple_references(mfcc_user, reference_mfccs)

# 🔥 Predict คะแนนจาก similarity%
        predicted_score = predict_score_from_similarity(best_similarity)

        print(f"🔍 Best Matched Voice: {best_voice}")
        print(f"🔍 Similarity Score: {best_similarity:.2f}/100")
        print(f"🏆 Predicted Score: {predicted_score:.2f} (0-5)")

    else:
        print("⛔ กรุณาพูดใหม่อีกครั้ง")

    # 🧹 ลบเฉพาะไฟล์เสียงที่บันทึกจากไมค์
    #if os.path.exists(recorded_file):
    #    os.remove(recorded_file)
    #    print(f"🗑️ ลบไฟล์ {recorded_file} แล้ว")




if __name__ == "__main__":
    main()
