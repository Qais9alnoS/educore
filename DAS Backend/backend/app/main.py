import sys
import os
import io

# Ensure UTF-8 encoding (critical for compiled PyInstaller builds on Windows)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
os.environ['PYTHONIOENCODING'] = 'utf-8'

from fastapi import FastAPI, Depends, Request, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, get_db, update_database_schema, Base
from app.models import *  # Import all models
from app.api import auth, academic, students, teachers, finance, activities, schedules, search, system, advanced, monitoring, director, daily, history, analytics
from app.utils.security import get_password_hash
from app.core.rate_limiting import rate_limiter, security_headers_middleware, create_custom_rate_limit_handler
from app.core.exceptions import (
    global_exception_handler, http_exception_handler, 
    validation_exception_handler, database_exception_handler
)
from app.services.security_service import security_service
from app.services.config_service import config_service
from app.core.telegram_logging_handler import setup_telegram_logging
from app.core.logging_config import setup_logging

# Create database tables
# Suppressing type error for Base.metadata as it's a known SQLAlchemy pattern
Base.metadata.create_all(bind=engine)  # type: ignore

# Setup Telegram logging handler for error reporting
setup_telegram_logging()

# Initialize FastAPI app
app = FastAPI(
    title="School Management System API",
    description="Backend API for comprehensive school management",
    version="1.0.0"
)

# Setup CORS for localhost access - THIS MUST BE FIRST to handle preflight requests
# Allow all origins for desktop app - no credentials needed for local backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for desktop app
    allow_credentials=False,  # Disabled to allow wildcard
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Add rate limiter to app state
app.state.limiter = rate_limiter.limiter

# Add security headers middleware
app.middleware("http")(security_headers_middleware)

# Add exception handlers with proper type signatures
# Using type: ignore comments to suppress basedpyright errors for known working patterns
app.add_exception_handler(Exception, global_exception_handler)  
app.add_exception_handler(HTTPException, http_exception_handler)  
app.add_exception_handler(RequestValidationError, validation_exception_handler)  
app.add_exception_handler(SQLAlchemyError, database_exception_handler)  
app.add_exception_handler(RateLimitExceeded, create_custom_rate_limit_handler())  

# Create upload directories
os.makedirs(settings.UPLOAD_DIRECTORY, exist_ok=True)
os.makedirs(settings.BACKUP_DIRECTORY, exist_ok=True)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIRECTORY), name="uploads")

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(academic.router, prefix="/api/academic", tags=["Academic"])
# Fixed routes - each router should have its specific prefix
app.include_router(students.router, prefix="/api/students", tags=["Students"])
app.include_router(teachers.router, prefix="/api/teachers", tags=["Teachers"])
app.include_router(finance.router, prefix="/api/finance", tags=["Finance"])
app.include_router(activities.router, prefix="/api/activities", tags=["Activities"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["Schedules"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(system.router, prefix="/api/system", tags=["System"])
app.include_router(advanced.router, prefix="/api/advanced", tags=["Advanced System Management"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["Monitoring"])
app.include_router(director.router, prefix="/api/director", tags=["Director Dashboard"])
app.include_router(daily.router, prefix="/api/daily", tags=["Daily Page"])
app.include_router(history.router, prefix="/api/history", tags=["History"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    # Setup custom logging to filter 401 errors
    setup_logging()
    
    # Update database schema to match current models
    update_database_schema()
    
    # Check if this is the first run (no academic years exist)
    from app.database import SessionLocal
    from app.models.academic import AcademicYear
    from app.models.system import SystemSetting
    
    db = SessionLocal()
    try:
        # Check if any academic years exist
        academic_years_count = db.query(AcademicYear).count()
        if academic_years_count == 0:
            # Mark this as first run in system settings
            # Using type: ignore to suppress basedpyright error for working query pattern
            first_run_setting = db.query(SystemSetting).filter(
                SystemSetting.setting_key == "first_run_completed"
            ).first()  # type: ignore
            
            if not first_run_setting:
                # Create setting using dictionary to avoid type errors
                setting_data = {
                    "setting_key": "first_run_completed",
                    "setting_value": "false",
                    "description": "Indicates if the first run setup has been completed"
                }
                first_run_setting = SystemSetting(**setting_data)
                db.add(first_run_setting)
                db.commit()
        else:
            # If academic years exist, mark first run as completed
            # Using type: ignore to suppress basedpyright error for working query pattern
            first_run_setting = db.query(SystemSetting).filter(
                SystemSetting.setting_key == "first_run_completed"
            ).first()  # type: ignore
            
            if first_run_setting:
                first_run_setting.setting_value = "true"
                db.commit()
            elif academic_years_count > 0:
                # Create the setting if it doesn't exist but years do
                # Create setting using dictionary to avoid type errors
                setting_data = {
                    "setting_key": "first_run_completed",
                    "setting_value": "true",
                    "description": "Indicates if the first run setup has been completed"
                }
                first_run_setting = SystemSetting(**setting_data)
                db.add(first_run_setting)
                db.commit()
    finally:
        db.close()
    
    await create_default_admin()
    
    # Initialize default system configurations
    from app.database import SessionLocal
    from app.models.users import User
    
    db = SessionLocal()
    try:
        # Using type: ignore to suppress basedpyright error for working query pattern
        admin_user = db.query(User).filter(User.role == "director").first()  # type: ignore
        if admin_user:
            config_service.initialize_default_configs(admin_user.id)
    finally:
        db.close()

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    pass

@app.get("/")
async def root():
    return {"message": "School Management System API", "version": "1.0.0"}

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    try:
        # Test database connection
        db.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

async def create_default_admin():
    """Create default admin user if none exists"""
    from app.database import SessionLocal
    from app.models.users import User
    from app.utils.security import get_password_hash
    
    db = SessionLocal()
    try:
        # Check if admin user exists
        # Using type: ignore to suppress basedpyright error for working query pattern
        admin_user = db.query(User).filter(User.username == "admin").first()  # type: ignore
        if not admin_user:
            # Create admin user (director role) using dictionary approach to avoid type errors
            admin_user_data = {
                "username": "admin",
                "password_hash": get_password_hash("admin123"),
                "role": "director",
                "is_active": True
            }
            admin_user = User(**admin_user_data)
            db.add(admin_user)
            
            db.commit()
            print("Default admin user created:")
            print("  - Username: admin, Password: admin123, Role: director")
        else:
            print("Admin user already exists")
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False  # Never use reload in exe mode - causes startup chaos
    )


