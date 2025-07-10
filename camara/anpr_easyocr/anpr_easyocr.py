# back-end/camara/anpr_easyocr/anpr_easyocr.py

import easyocr
import cv2
import os
import re
import itertools
import unicodedata
import tkinter as tk
from tkinter import messagebox

class ArgentinePlateRecognizer:
    def __init__(self, max_horizontal_gap=40, min_confidence=0.2):
        self.reader = easyocr.Reader(
            ['es'],
            gpu=False,
            verbose=False,
            download_enabled=False,
            detector=True,
            recognizer=True
        )
        self.max_horizontal_gap = max_horizontal_gap
        self.min_confidence = min_confidence

        self.ambiguous_map = {
            '0': ['0', 'O', 'D'], 'O': ['O', '0', 'D'], 'D': ['D', 'O', '0'],
            '1': ['1', 'I', 'L'], 'I': ['I', '1', 'L'], 'L': ['L', '1', 'I'],
            '2': ['2', 'Z'], 'Z': ['Z', '2'],
            '5': ['5', 'S'], 'S': ['S', '5'],
            '8': ['8', 'B'], 'B': ['B', '8'],
            '4': ['4', 'A'], 'A': ['A', '4'],
            'V': ['V', 'Y'], 'Y': ['Y', 'V'],
            'N': ['N', 'M'], 'M': ['M', 'N'],
            'C': ['C', 'G'], 'G': ['G', 'C'],
        }

        self.ignore_words = {
            "ARGENTINA", "REPUBLICA", "MERCOSUR", "AUTOMOTOR", "NACIONAL",
            "BLOG", "CO", "WWW", "FECOSUR", "FECOSURR", "DE", "DEL", "OFICIAL",
            "VEHICULO", "VEHICULOS", "GOBIERNO", "PODER", "EJECUTIVO", "SECCION"
        }

    def clean_text(self, text):
        text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
        text = text.upper()
        return re.sub(r'[^A-Z0-9]', '', text)

    def validate_plate_format(self, text):
        if len(text) == 6:
            return text[:3].isalpha() and text[3:].isdigit()
        elif len(text) == 7:
            return (
                (text[:2].isalpha() and text[2:5].isdigit() and text[5:].isalpha()) or
                (text[0].isalpha() and text[1:4].isdigit() and text[4:].isalpha())
            )
        else:
            return False

    def generate_ambiguity_variants(self, text):
        options = [self.ambiguous_map.get(c, [c]) for c in text]
        return (''.join(cand) for cand in itertools.product(*options))

    def group_close_texts(self, results):
        sorted_results = sorted(results, key=lambda r: (r[0][0][0] + r[0][1][0]) / 2)
        return [sorted_results]

    def extract_candidate_from_group(self, group, debug=False):
        def should_ignore(txt):
            return any(word in txt for word in self.ignore_words) or len(txt) > 8

        filtered_texts = []
        for box, t, p in group:
            t_clean = self.clean_text(t)
            if should_ignore(t_clean):
                continue
            if self.validate_plate_format(t_clean):
                if debug:
                    print(f"[DEBUG] Aceptado por formato válido: '{t}' → '{t_clean}'")
                filtered_texts.append((t_clean, 1.0))
            elif p >= self.min_confidence:
                filtered_texts.append((t_clean, p))

        if debug:
            print(f"[DEBUG] Textos limpiados y filtrados: {[t for t, _ in filtered_texts]}")

        cleaned_texts = [t for t, _ in filtered_texts]

        for candidate in cleaned_texts:
            if self.validate_plate_format(candidate):
                if debug:
                    print(f"[DEBUG] Candidato directo válido: {candidate}")
                return candidate

        combined = ''.join(cleaned_texts)
        if len(combined) <= 7 and self.validate_plate_format(combined):
            if debug:
                print(f"[DEBUG] Combinación directa válida: {combined}")
            return combined
        if len(combined) <= 7:
            for variant in self.generate_ambiguity_variants(combined):
                if self.validate_plate_format(variant):
                    if debug:
                        print(f"[DEBUG] Variante ambigua válida de combinación total: {variant}")
                    return variant

        for a, b in itertools.permutations(cleaned_texts, 2):
            ab = a + b
            if len(ab) <= 7 and self.validate_plate_format(ab):
                if debug:
                    print(f"[DEBUG] Combinación válida: '{a}' + '{b}' → {ab}")
                return ab
            if len(ab) <= 7:
                for variant in self.generate_ambiguity_variants(ab):
                    if self.validate_plate_format(variant):
                        if debug:
                            print(f"[DEBUG] Combinación ambigua válida: '{a}' + '{b}' → {variant}")
                        return variant

        if len(cleaned_texts) >= 3:
            for a, b, c in itertools.permutations(cleaned_texts, 3):
                abc = a + b + c
                if len(abc) <= 7 and self.validate_plate_format(abc):
                    if debug:
                        print(f"[DEBUG] Combinación triple válida: '{a}' + '{b}' + '{c}' → {abc}")
                    return abc
                if len(abc) <= 7:
                    for variant in self.generate_ambiguity_variants(abc):
                        if self.validate_plate_format(variant):
                            if debug:
                                print(f"[DEBUG] Combinación triple ambigua válida: '{a}' + '{b}' + '{c}' → {variant}")
                            return variant

        return None

    def recognize_plate(self, image_path, debug=False):
        if not os.path.exists(image_path):
            return f"Error: La imagen {image_path} no existe."

        image = cv2.imread(image_path)
        if image is None:
            return f"Error: No se pudo abrir la imagen {image_path}."

        results = self.reader.readtext(image)

        if debug:
            print("\n[DEBUG] Resultados detectados:")
            for bbox, text, prob in results:
                print(f"[DEBUG] Texto detectado: '{text}' con confianza {prob:.2f}")

        groups = self.group_close_texts(results)

        if debug:
            print(f"\n[DEBUG] Se agruparon en {len(groups)} grupos.\n")

        candidate = self.extract_candidate_from_group(groups[0], debug=debug)

        if candidate:
            return candidate
        else:
            raw_detected = [self.clean_text(t) for _, t, _ in results if t.strip()]
            return None, raw_detected


def ocr_from_image(image_path, debug=False):
    recognizer = ArgentinePlateRecognizer()
    result = recognizer.recognize_plate(image_path, debug=debug)

    # Crear ventana oculta para el popup
    root = tk.Tk()
    root.withdraw()

    if isinstance(result, tuple):
        candidate, raw_texts = result
    else:
        candidate = result
        raw_texts = []

    if candidate and "Error" not in candidate:
        validated_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "patentes_validadas"))
        os.makedirs(validated_dir, exist_ok=True)

        extension = os.path.splitext(image_path)[-1].lower()
        new_image_path = os.path.join(validated_dir, f"{candidate}{extension}")

        try:
            import shutil
            shutil.copy(image_path, new_image_path)
            if debug:
                print(f"[DEBUG] Imagen copiada a: {new_image_path}")
        except Exception as e:
            print(f"⚠️ Error al copiar imagen: {e}")

        messagebox.showinfo("Patente detectada", f"✅ Patente detectada: {candidate}")
    else:
        msg = "❌ No se detectó patente válida."
        if raw_texts:
            msg += "\nTextos leídos: " + ", ".join(raw_texts)
        elif isinstance(candidate, str) and "Error" in candidate:
            msg += f"\n{candidate}"

        messagebox.showwarning("Patente no detectada", msg)

    root.destroy()
    return candidate if isinstance(candidate, str) else None


if __name__ == "__main__":
    image_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "real_plate.jpg"))
    result = ocr_from_image(image_path, debug=True)
    print("\nResultado final:", result)
    input("\nPresioná ENTER para cerrar esta ventana...")
