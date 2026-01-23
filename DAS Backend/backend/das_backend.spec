# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for DAS Backend

block_cipher = None

a = Analysis(
    ['run_server.py'],
    pathex=[],
    binaries=[
        # Include bcrypt C extension
        # PyInstaller will try to find bcrypt's compiled extensions
    ],
    datas=[
        # Include all Python files from app directory
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
        # Passlib handlers - required for password hashing
        'passlib.handlers',
        'passlib.handlers.bcrypt',
        'passlib.handlers.sha2_crypt',
        'passlib.handlers.des_crypt',
        'passlib.handlers.md5_crypt',
        'passlib.handlers.pbkdf2',
        'passlib.handlers.misc',
        # Bcrypt backend - try pure Python fallback
        'bcrypt',
        '_cffi_backend',
        # SQLAlchemy
        'sqlalchemy.dialects.sqlite',
        # FastAPI/Starlette
        'starlette.responses',
        'starlette.routing',
        'starlette.middleware',
        'starlette.middleware.cors',
        'starlette.staticfiles',
        # Pydantic
        'pydantic',
        'pydantic_core',
        # Email validator
        'email_validator',
        # Python multipart for form handling
        'python_multipart',
        # Anyio
        'anyio',
        'anyio._backends',
        'anyio._backends._asyncio',
        # Sniffio
        'sniffio',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'pytest',
        'coverage',
        'setuptools',
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
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    # Name must match the path that Tauri expects for the externalBin sidecar
    # Tauri will look for: dist/school-management-backend-x86_64-pc-windows-msvc.exe
    name='school-management-backend-x86_64-pc-windows-msvc',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
