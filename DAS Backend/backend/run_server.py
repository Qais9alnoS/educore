#!/usr/bin/env python3

import sys
import os
import io

# Set UTF-8 encoding for stdout and stderr (critical for PyInstaller .exe)
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Set environment variable for any child processes
os.environ['PYTHONIOENCODING'] = 'utf-8'

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("Testing imports...")
    
    # Test config import
    from app.config import settings
    print("Config imported successfully")
    
    # Test models import
    from app.models import AcademicYear, User
    print("Models imported successfully")
    
    # Test security import
    from app.utils.security import verify_password
    print("Security utils imported successfully")
    
    # Test API import
    from app.api.auth import router
    print("Auth API imported successfully")
    
    # Test main app import
    from app.main import app
    print("Main app imported successfully")
    
    print("\nAll imports successful! Starting server...")
    
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
    
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()