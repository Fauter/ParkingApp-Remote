import cv2
import easyocr
import numpy as np
import os
import re
import time
import threading
from datetime import datetime

# ========== CONFIG ========== #
RTSP_URL = "rtsp://admin:admin@192.168.100.54:554"
OUTPUT_DIR = "./capturas"
WIDTH = 800
FRAME_INTERVAL = 1.0  # segundos entre capturas
CONFIDENCE_THRESHOLD = 0.4
OMITIR_PALABRAS = {"ARGENTINA", "REPUBLICA", "REPUBLICA ARGENTINA"}

os.makedirs(OUTPUT_DIR, exist_ok=True)
reader = easyocr.Reader(['en'], gpu=False)

def is_valid_plate(plate):
    return bool(re.fullmatch(r'[A-Z]{3}[0-9]{3}', plate) or
                re.fullmatch(r'[A-Z]{2}[0-9]{3}[A-Z]{2}', plate))

def clean_plate_text_positional(text):
    text = text.upper()
    result = []
    for i, c in enumerate(text):
        if c in '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ':
            result.append(c)
            continue

        is_number_position = False
        if len(text) == 6:  # ABC123
            is_number_position = i >= 3
        elif len(text) == 7:  # AB123CD
            is_number_position = 2 <= i <= 4

        if is_number_position:
            if c in ('O', 'Q', 'D'):
                result.append('0')
            elif c in ('I', '|', 'L'):
                result.append('1')
            elif c == 'Z':
                result.append('2')
            elif c == 'S':
                result.append('5')
            elif c == 'B':
                result.append('8')
            else:
                result.append(c)
        else:
            result.append(c)
    return ''.join(result)

def sharpen(image):
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    return cv2.filter2D(image, -1, kernel)

def crop_center(image, percent=0.10):
    h, w = image.shape[:2]
    top = int(h * percent)
    bottom = int(h * (1 - percent))
    left = int(w * percent)
    right = int(w * (1 - percent))
    return image[top:bottom, left:right]

def save_image(image, plate_text):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"patente_{plate_text}_{timestamp}.jpg"
    path = os.path.join(OUTPUT_DIR, filename)
    cv2.imwrite(path, image)
    print(f"[💾] Imagen guardada: {path}")

def detect_license_plate_text(image):
    cropped = crop_center(image, percent=0.10)
    results = reader.readtext(cropped)
    if not results:
        print("[🛑] EasyOCR no detectó texto.")
        return ""

    contiene_basura = any(text.strip().upper() in OMITIR_PALABRAS for _, text, _ in results)
    if contiene_basura:
        print("[🧼] Evitando reconstrucción por palabras prohibidas.")
        return ""

    candidates = []
    for bbox, text, conf in results:
        if conf < CONFIDENCE_THRESHOLD:
            continue
        raw = text.strip().upper()
        if raw in OMITIR_PALABRAS:
            continue
        print(f"[🔍] '{raw}' ({conf:.2f})")
        corrected = clean_plate_text_positional(raw)
        corrected_no_spaces = re.sub(r'\s+', '', corrected)
        print(f"[EasyOCR 🧠] → {corrected_no_spaces}")
        candidates.append((corrected_no_spaces, conf))

    for text, conf in candidates:
        if is_valid_plate(text):
            print(f"[✅] Patente válida: {text}")
            return text

    joined = ''.join(t.replace(" ", "") for t, _ in sorted(candidates, key=lambda x: -x[1]))
    joined = re.sub(r'[^A-Z0-9]', '', joined)
    posibles = re.findall(r'[A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2}', joined)
    if posibles:
        print(f"[🔧] Reconstruida: {posibles[0]}")
        return posibles[0]

    print("[❌] Ninguna patente válida.")
    return ""

ultima_patente = [None]

def captura_periodica(get_frame):
    while True:
        frame = get_frame()
        if frame is None:
            time.sleep(0.1)
            continue
        resized = cv2.resize(frame, (WIDTH, int(frame.shape[0] * WIDTH / frame.shape[1])))
        sharp = sharpen(resized)
        plate = detect_license_plate_text(sharp)
        if plate and plate != ultima_patente[0]:
            save_image(resized, plate)
            ultima_patente[0] = plate
        time.sleep(FRAME_INTERVAL)

def main():
    print("[📷] Conectando a la cámara...")
    cap = cv2.VideoCapture(RTSP_URL)
    if not cap.isOpened():
        print("[❌] No se pudo conectar al stream RTSP.")
        return

    latest_frame = [None]

    def get_latest_frame():
        return latest_frame[0]

    threading.Thread(target=captura_periodica, args=(get_latest_frame,), daemon=True).start()

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            print("[⚠️] Frame inválido.")
            continue

        latest_frame[0] = frame
        display = cv2.resize(frame, (WIDTH, int(frame.shape[0] * WIDTH / frame.shape[1])))
        cv2.imshow("Vista en tiempo real", display)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
