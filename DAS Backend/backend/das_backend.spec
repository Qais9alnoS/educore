# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for DAS Backend
# Simplified to avoid subprocess crashes on CI

block_cipher = None

a = Analysis(
    ['run_server.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('app', 'app'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'click',
        'passlib.handlers',
        'passlib.handlers.bcrypt',
        'bcrypt',
        '_cffi_backend',
        'sqlalchemy.dialects.sqlite',
        'starlette.responses',
        'starlette.routing',
        'starlette.middleware',
        'starlette.middleware.cors',
        'starlette.staticfiles',
        'pydantic',
        'pydantic_core',
        'email_validator',
        'python_multipart',
        'anyio',
        'anyio._backends',
        'anyio._backends._asyncio',
        'sniffio',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'pytest',
        'coverage',
        'setuptools',
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'app',  # Exclude app from analysis - we include it as data
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='school-management-backend-x86_64-pc-windows-msvc',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='school-management-backend-x86_64-pc-windows-msvc',
)
