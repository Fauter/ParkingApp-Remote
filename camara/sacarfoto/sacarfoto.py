import cv2
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

def cargar_rtsp():
    config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "config.txt"))
    if not os.path.exists(config_path):
        print("❌ No se encontró el archivo config.txt.")
        print("ERROR")
        return None
    with open(config_path, "r") as f:
        for line in f:
            if line.startswith("RTSP_URL="):
                return line.strip().split("=", 1)[1]
    print("❌ No se encontró RTSP_URL en config.txt.")
    print("ERROR")
    return None

def sacar_foto(nombre_archivo="captura.jpg"):
    rtsp_url = cargar_rtsp()
    if not rtsp_url:
        return

    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        print("❌ No se pudo abrir la cámara.")
        print("ERROR")
        return

    ret, frame = cap.read()
    if not ret:
        print("❌ Error al capturar la imagen.")
        cap.release()
        print("ERROR")
        return

    output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), nombre_archivo))
    cv2.imwrite(output_path, frame)
    print(f"✅ Foto guardada en {output_path}")
    cap.release()
    print("OK")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        sacar_foto("capturaTest.jpg")
    else:
        sacar_foto("captura.jpg")
