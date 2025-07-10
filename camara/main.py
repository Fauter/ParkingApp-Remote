import tkinter as tk
from tkinter import ttk
import subprocess
import sys
import os
import platform

# Detectar si estamos en un exe congelado
IS_FROZEN = getattr(sys, 'frozen', False)

# Modo especial para ejecutar el detector desde el mismo .exe o python
if len(sys.argv) > 1 and sys.argv[1] == "--run-detector":
    import platedetector.platedetector
    sys.exit()

# Rutas necesarias
sys.path.append(os.path.join(os.path.dirname(__file__), "anpr_easyocr"))
from viewer import ViewerWindow
from config_gui import ConfigWindow  # 👈 IMPORTANTE

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Lector de Patentes")
        self.geometry("300x150")
        self.detector_proc = None

        # Mostrar primero la ventana de configuración
        self.withdraw()  # Esconder ventana principal
        ConfigWindow(self, self.iniciar_detector)

    def iniciar_detector(self):
        self.deiconify()  # Mostrar ventana principal

        ttk.Label(self, text="Sistema activo").pack(pady=10)
        ttk.Button(self, text="Ver patentes detectadas", command=self.abrir_viewer).pack(pady=10)
        ttk.Button(self, text="Salir", command=self.salir).pack(pady=10)

        creationflags = subprocess.CREATE_NEW_CONSOLE if platform.system() == "Windows" else 0

        if IS_FROZEN:
            cmd = [sys.executable, "--run-detector"]
        else:
            cmd = [sys.executable, os.path.abspath(__file__), "--run-detector"]

        self.detector_proc = subprocess.Popen(
            cmd,
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
