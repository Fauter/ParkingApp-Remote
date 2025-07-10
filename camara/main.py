import tkinter as tk
from tkinter import ttk
import subprocess
import sys
import os
import platform

# Modo especial para ejecutar el detector desde el mismo .exe
if len(sys.argv) > 1 and sys.argv[1] == "--run-detector":
    import platedetector.platedetector
    sys.exit()

# Para importar el visor desde subcarpeta
sys.path.append(os.path.join(os.path.dirname(__file__), "anpr_easyocr"))
from viewer import ViewerWindow

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Lector de Patentes")
        self.geometry("300x150")

        ttk.Label(self, text="Sistema activo").pack(pady=10)
        ttk.Button(self, text="Ver patentes detectadas", command=self.abrir_viewer).pack(pady=10)
        ttk.Button(self, text="Salir", command=self.salir).pack(pady=10)

        # Ejecutar detector automáticamente con nueva consola si estamos en Windows
        creationflags = subprocess.CREATE_NEW_CONSOLE if platform.system() == "Windows" else 0

        self.detector_proc = subprocess.Popen(
            [sys.executable, os.path.abspath(__file__), "--run-detector"],
            creationflags=creationflags
        )

        self.protocol("WM_DELETE_WINDOW", self.salir)

    def abrir_viewer(self):
        ViewerWindow(self)

    def salir(self):
        if self.detector_proc and self.detector_proc.poll() is None:
            self.detector_proc.terminate()
        self.destroy()

if __name__ == "__main__":
    app = App()
    app.mainloop()
