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