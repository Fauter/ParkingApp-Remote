import os
import tkinter as tk
from tkinter import ttk, messagebox

CONFIG_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "config.txt"))

class ConfigWindow(tk.Toplevel):
    def __init__(self, master, callback_iniciar):
        super().__init__(master)
        self.title("Configuración de la cámara")
        self.geometry("400x250")
        self.callback_iniciar = callback_iniciar

        # IP
        ttk.Label(self, text="IP de la cámara:").pack(pady=(15, 5))
        self.ip_entry = ttk.Entry(self, width=40)
        self.ip_entry.pack()
        ttk.Label(self, text="(Formato esperado: 192.168.100.54)").pack(pady=(0, 10))

        # Path RTSP
        ttk.Label(self, text="Path del stream:").pack()
        self.path_var = tk.StringVar()
        self.path_selector = ttk.Combobox(self, textvariable=self.path_var, state="readonly")
        self.path_selector['values'] = ["/streaming/channels/1", "/h264", "/live.sdp"]
        self.path_selector.current(0)
        self.path_selector.pack(pady=(0, 10))

        # Botón
        ttk.Button(self, text="Guardar y comenzar", command=self.guardar).pack(pady=10)

        # Cargar valores anteriores si existen
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r") as f:
                for line in f:
                    if line.startswith("RTSP_URL="):
                        url = line.strip().split("=", 1)[1]
                        if "@" in url:
                            ip = url.split("@")[1].split(":")[0]
                            self.ip_entry.insert(0, ip)

                        for i, path in enumerate(self.path_selector['values']):
                            if url.endswith(path):
                                self.path_selector.current(i)
                                break

    def guardar(self):
        ip = self.ip_entry.get().strip()
        path = self.path_var.get().strip()

        if not ip or not path:
            messagebox.showerror("Error", "Por favor completá todos los campos.")
            return

        rtsp_url = f"rtsp://admin:admin@{ip}:554{path}"
        with open(CONFIG_PATH, "w") as f:
            f.write(f"RTSP_URL={rtsp_url}\n")

        self.callback_iniciar()
        self.destroy()
