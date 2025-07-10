import os
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk

VALIDADAS_DIR = os.path.join(os.path.dirname(__file__), "anpr_easyocr", "patentes_validadas")

class ViewerWindow(tk.Toplevel):
    def __init__(self, master):
        super().__init__(master)
        self.title("Patentes detectadas")
        self.geometry("600x400")

        self.listbox = tk.Listbox(self)
        self.listbox.pack(side="left", fill="y")

        scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.listbox.yview)
        scrollbar.pack(side="left", fill="y")
        self.listbox.config(yscrollcommand=scrollbar.set)

        self.image_label = tk.Label(self)
        self.image_label.pack(side="right", fill="both", expand=True)

        self.current_image = None
        self.load_images()
        self.listbox.bind("<<ListboxSelect>>", self.on_select)

    def load_images(self):
        if not os.path.exists(VALIDADAS_DIR):
            return
        files = sorted([f for f in os.listdir(VALIDADAS_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg'))])
        for f in files:
            self.listbox.insert(tk.END, f)

    def on_select(self, event):
        if not self.listbox.curselection():
            return
        index = self.listbox.curselection()[0]
        filename = self.listbox.get(index)
        filepath = os.path.join(VALIDADAS_DIR, filename)

        img = Image.open(filepath)
        img.thumbnail((400, 400))
        self.current_image = ImageTk.PhotoImage(img)
        self.image_label.config(image=self.current_image)
