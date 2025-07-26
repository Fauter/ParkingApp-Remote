import subprocess
import json
import re

def obtener_impresoras():
    try:
        resultado = subprocess.run(
            ['wmic', 'printer', 'get', 'Name,Default', '/format:list'],
            capture_output=True, text=True, check=True
        )

        impresoras = []
        sistema_default = None

        bloques = resultado.stdout.strip().split('\n\n')
        for bloque in bloques:
            nombre_match = re.search(r'Name=(.+)', bloque)
            default_match = re.search(r'Default=(.+)', bloque)

            if nombre_match:
                nombre = nombre_match.group(1).strip()
                impresoras.append(nombre)

                if default_match and default_match.group(1).strip().lower() == 'true':
                    sistema_default = nombre

        return {
            "impresoras": impresoras,
            "default": sistema_default
        }

    except Exception as e:
        return {
            "error": f"Error al obtener impresoras: {str(e)}"
        }

if __name__ == "__main__":
    print(json.dumps(obtener_impresoras()))
