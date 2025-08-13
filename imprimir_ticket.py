import sys
import os
import json
import win32print
import win32ui
from PIL import Image, ImageWin
import requests
from io import BytesIO

# Ruta absoluta correcta al archivo impresora.json dentro de back-end/configuracion/
CONFIG_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'configuracion', 'impresora.json'))

def obtener_impresora_configurada():
    print(f"DEBUG: Leyendo impresora desde: {CONFIG_PATH}")
    if not os.path.isfile(CONFIG_PATH):
        print("DEBUG: No existe archivo impresora.json")
        return None
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            impresora = data.get('impresora')
            if impresora and isinstance(impresora, str):
                print(f"DEBUG: Impresora configurada: '{impresora}'")
                return impresora
            else:
                print("DEBUG: No hay impresora configurada válida en JSON")
    except Exception as e:
        print(f"No se pudo leer impresora configurada: {e}")
    return None

def impresora_disponible(nombre_impresora):
    try:
        impresoras = [p[2] for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)]
        if nombre_impresora in impresoras:
            return True
        else:
            print(f"WARNING: Impresora configurada '{nombre_impresora}' NO está disponible en el sistema.")
            print(f"Impresoras disponibles: {impresoras}")
            return False
    except Exception as e:
        print(f"Error verificando impresoras instaladas: {e}")
        return False

def imprimir_codigo_barras(pdc, codigo, x, y):
    try:
        barcode_url = 'http://localhost:5000/api/tickets/barcode'
        response = requests.post(barcode_url, json={'text':  codigo}, timeout=5)
        
        if response.status_code != 200:
            print(f"Error API código barras: {response.status_code}")
            return 0

        with Image.open(BytesIO(response.content)) as img:
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                fondo = Image.new("RGB", img.size, (255, 255, 255))
                fondo.paste(img, mask=img.split()[3])
                bmp = fondo
            else:
                bmp = img.convert("RGB")

            ancho_final, alto_final = bmp.size
            dib = ImageWin.Dib(bmp)
            dib.draw(pdc.GetHandleOutput(), (x, y, x + ancho_final, y + alto_final))

        return alto_final

    except requests.exceptions.RequestException as e:
        print(f"Error de conexión: {e}")
    except Exception as e:
        print(f"Error inesperado: {e}")
    return 0

def imprimir_ticket(texto):
    try:
        printer_name = obtener_impresora_configurada()

        if not printer_name:
            print("ERROR: No hay impresora configurada en impresora.json. No se imprimirá.")
            return False

        if not impresora_disponible(printer_name):
            print("ERROR: La impresora configurada no está disponible. No se imprimirá.")
            return False

        hprinter = win32print.OpenPrinter(printer_name)
        dc = win32ui.CreateDC()
        dc.CreatePrinterDC(printer_name)
        dc.StartDoc("Ticket de Parking")
        dc.StartPage()

        ticket_num = texto.split('\n')[0].strip()

        font = win32ui.CreateFont({
            "name": "Courier New",
            "height": -35,
            "weight": 600,
        })
        dc.SelectObject(font)

        y_pos = 100
        line_height = 50
        
        for linea in texto.split("\n"):
            dc.TextOut(50, y_pos, linea)
            y_pos += line_height

        y_pos += 20

        alto_codigo = imprimir_codigo_barras(dc, ticket_num, 50, y_pos)
        if alto_codigo > 0:
            dc.TextOut(50, y_pos + alto_codigo + 10, f"Código: {ticket_num}")
        else:
            print("No se pudo imprimir código de barras, usando texto alternativo")
            dc.TextOut(50, y_pos, f"[CODIGO BARRAS: {ticket_num}]")

        dc.EndPage()
        dc.EndDoc()
        dc.DeleteDC()
        win32print.ClosePrinter(hprinter)

        print("Ticket impreso exitosamente")
        return True

    except Exception as e:
        print(f"Error crítico al imprimir: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        texto = sys.argv[1].replace("\\n", "\n")
        exit_code = 0 if imprimir_ticket(texto) else 1
        sys.exit(exit_code)
    else:
        print("Uso: python imprimir_ticket.py 'Texto\\ndel\\nticket'")
        sys.exit(1)
