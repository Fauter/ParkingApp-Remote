# -*- mode: python ; coding: utf-8 -*-

import os
block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[os.path.abspath('.')],  # carpeta base proyecto
    binaries=[],
    datas=[
        ('real_plate.jpg', '.'),  # imagen ejemplo
        ('config.txt', '.'),      # config
        ('config_gui.py', '.'),   # archivo config_gui.py
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Incluyo los scripts que están en carpetas para que se copien, pero no en "datas" porque no son recursos, sino código
# Para que funcione bien, agregamos los scripts explícitamente en Analysis agregando un 'pathex' para los imports
# O podemos agregarlos en hiddenimports si tienen imports dinámicos
# Pero PyInstaller ya incluye los módulos importados por main.py automáticamente.
# Si tenés problemas con imports dinámicos, agregar hiddenimports.

# Si querés asegurarte que los .py estén disponibles (no sólo compilados en .pyc dentro el exe), podés agregar como datas:

from PyInstaller.utils.hooks import collect_submodules

# Recopilo todos los submódulos dentro de anpr_easyocr y platedetector para hiddenimports (por si hay imports dinámicos)
hidden_mods = collect_submodules('anpr_easyocr') + collect_submodules('platedetector')

a.hiddenimports.extend(hidden_mods)

pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=block_cipher,
)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=False,
    name='main',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # <--- si querés sin consola negra
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='main',
)
