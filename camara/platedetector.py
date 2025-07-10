import cv2
import numpy as np
import time
import subprocess
import math

RTSP_URL = "rtsp://admin:@192.168.100.54:554/streaming/channels/1"

cap = cv2.VideoCapture(RTSP_URL)

if not cap.isOpened():
    print("No se puede abrir la cámara.")
    exit()

cooldown = 10
last_capture = time.time() - cooldown

# Tiempo que debe mantenerse la placa estable para confirmar (segundos)
plate_confirmed_time = 1.5
last_plate_time = 0
last_plate_pos = None

print("Buscando placas dentro de la zona de interés central...")

cv2.namedWindow("Zona de interes", cv2.WINDOW_NORMAL)
cv2.resizeWindow("Zona de interes", 640, 360)  # Tamaño inicial
cv2.moveWindow("Zona de interes", 100, 100)   # Posición en pantalla

def dist(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

while True:
    ret, frame = cap.read()
    if not ret:
        print("Error leyendo frame.")
        break

    h_img, w_img = frame.shape[:2]

    # Zona central para análisis (60% ancho x 60% alto)
    crop_x = int(w_img * 0.2)
    crop_y = int(h_img * 0.2)
    w_roi = int(w_img * 0.6)
    h_roi = int(h_img * 0.6)

    # Extraemos ROI para procesar (no para mostrar)
    roi = frame[crop_y:crop_y+h_roi, crop_x:crop_x+w_roi]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5,5), 0)

    edges = cv2.Canny(blurred, 50, 200)
    edges = cv2.dilate(edges, None, iterations=1)

    contours, _ = cv2.findContours(edges.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    plate_candidate = None
    max_area = 0

    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.03 * peri, True)

        if len(approx) == 4:
            (x_c, y_c, w_c, h_c) = cv2.boundingRect(approx)
            area = w_c * h_c
            if area < 2000:
                continue

            aspect_ratio = w_c / float(h_c)
            if 1.3 <= aspect_ratio <= 3.5:
                if area > max_area:
                    max_area = area
                    plate_candidate = (x_c, y_c, w_c, h_c)

    # Lógica para confirmación temporal
    current_time = time.time()
    if plate_candidate is not None:
        px, py, pw, ph = plate_candidate
        center_current = (px + pw/2, py + ph/2)

        if last_plate_pos is None:
            last_plate_pos = center_current
            last_plate_time = current_time
            # No capturamos aún, esperando confirmación
            # print("Placa detectada primer frame, esperando confirmación...")
        else:
            if dist(center_current, last_plate_pos) < 50:
                # Placa estable
                if current_time - last_plate_time >= plate_confirmed_time:
                    # Confirmado para captura si cooldown cumplido
                    if current_time - last_capture > cooldown:
                        plate_img = frame[crop_y+py:crop_y+py+ph, crop_x+px:crop_x+px+pw]
                        cv2.imwrite("real_plate.jpg", plate_img)
                        print("⚠️ Placa confirmada y capturada tras persistencia.")
                        last_capture = current_time
                        subprocess.Popen(["python", "anpr_easyocr.py"])
                else:
                    # Seguimos acumulando tiempo
                    pass
            else:
                # Se movió mucho, resetear timer y posición
                last_plate_pos = center_current
                last_plate_time = current_time
    else:
        # No detectado, resetear
        last_plate_pos = None
        last_plate_time = 0

    # Dibujos sobre frame original
    # Rectángulo fijo zona ROI
    cv2.rectangle(frame, (crop_x, crop_y), (crop_x+w_roi, crop_y+h_roi), (0, 255, 0), 2)

    # Rectángulo placa detectada (en coordenadas globales)
    if plate_candidate is not None:
        px, py, pw, ph = plate_candidate
        cv2.rectangle(frame, (crop_x+px, crop_y+py), (crop_x+px+pw, crop_y+py+ph), (0, 255, 0), 2)

    # Mostrar en ventana achicada (30%)
    scale_percent = 30
    width = int(w_img * scale_percent / 100)
    height = int(h_img * scale_percent / 100)
    dim = (width, height)
    small_frame = cv2.resize(frame, dim, interpolation=cv2.INTER_AREA)

    cv2.imshow("Zona de interes", small_frame)

    key = cv2.waitKey(1)
    if key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
