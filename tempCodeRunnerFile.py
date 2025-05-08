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