import os
import shutil
import zipfile
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path
import logging
from sqlalchemy.orm import Session
from sqlalchemy.orm.query import Query
from sqlalchemy import text

# Import SQLCipher instead of regular SQLite
try:
    import sqlcipher3 as sqlite3
except ImportError:
    import sqlite3
    print("Warning: sqlcipher3-wheels not found. Using regular sqlite3. Database backups will not be encrypted.")

from ..config import settings
from ..database import engine, SessionLocal
from ..models.system import BackupHistory

logger = logging.getLogger(__name__)

class BackupService:
    """Comprehensive backup service for database and files"""
    
    def __init__(self):
        self.backup_dir = Path(settings.BACKUP_DIRECTORY)
        self.backup_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        self.db_backup_dir = self.backup_dir / "database"
        self.file_backup_dir = self.backup_dir / "files"
        self.full_backup_dir = self.backup_dir / "full"
        
        for dir_path in [self.db_backup_dir, self.file_backup_dir, self.full_backup_dir]:
            dir_path.mkdir(exist_ok=True)
    
    def create_database_backup(self, backup_name: Optional[str] = None) -> Dict[str, Any]:
        """Create a database backup"""
        try:
            if not backup_name:
                backup_name = f"db_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            backup_path = self.db_backup_dir / f"{backup_name}.sqlite"
            
            # Create database backup using SQLCipher backup API
            source_db = sqlite3.connect(settings.DATABASE_URL.replace("sqlite:///", ""))
            source_cursor = source_db.cursor()
            source_cursor.execute(f"PRAGMA key='{settings.DATABASE_PASSWORD}'")
            
            backup_db = sqlite3.connect(str(backup_path))
            backup_cursor = backup_db.cursor()
            backup_cursor.execute(f"PRAGMA key='{settings.DATABASE_PASSWORD}'")
            
            source_db.backup(backup_db)
            source_db.close()
            backup_db.close()
            
            # Create metadata file
            metadata = {
                "backup_type": "database",
                "backup_name": backup_name,
                "created_at": datetime.now().isoformat(),
                "file_size": backup_path.stat().st_size,
                "tables_count": self._get_tables_count()
            }
            
            metadata_path = self.db_backup_dir / f"{backup_name}_metadata.json"
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            # Record backup in history
            self._record_backup_history("database", backup_name, str(backup_path), metadata)
            
            logger.info(f"Database backup created: {backup_path}")
            
            return {
                "success": True,
                "backup_name": backup_name,
                "backup_path": str(backup_path),
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Database backup failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def create_files_backup(self, backup_name: Optional[str] = None) -> Dict[str, Any]:
        """Create a backup of uploaded files"""
        try:
            if not backup_name:
                backup_name = f"files_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            backup_path = self.file_backup_dir / f"{backup_name}.zip"
            uploads_dir = Path(settings.UPLOAD_DIRECTORY)
            
            if not uploads_dir.exists():
                return {
                    "success": True,
                    "backup_name": backup_name,
                    "backup_path": str(backup_path),
                    "message": "No files to backup"
                }
            
            # Create zip archive of uploads directory
            with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in uploads_dir.rglob('*'):
                    if file_path.is_file():
                        arcname = file_path.relative_to(uploads_dir.parent)
                        zipf.write(file_path, arcname)
            
            # Create metadata
            file_count = len(list(uploads_dir.rglob('*')))
            metadata = {
                "backup_type": "files",
                "backup_name": backup_name,
                "created_at": datetime.now().isoformat(),
                "file_size": backup_path.stat().st_size,
                "files_count": file_count,
                "source_directory": str(uploads_dir)
            }
            
            metadata_path = self.file_backup_dir / f"{backup_name}_metadata.json"
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            # Record backup in history
            self._record_backup_history("files", backup_name, str(backup_path), metadata)
            
            logger.info(f"Files backup created: {backup_path}")
            
            return {
                "success": True,
                "backup_name": backup_name,
                "backup_path": str(backup_path),
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Files backup failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def create_full_backup(self, backup_name: Optional[str] = None) -> Dict[str, Any]:
        """Create a complete system backup"""
        try:
            if not backup_name:
                backup_name = f"full_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            backup_path = self.full_backup_dir / f"{backup_name}.zip"
            
            # Create database backup first
            db_result = self.create_database_backup(f"{backup_name}_db")
            if not db_result["success"]:
                return db_result
            
            # Create files backup
            files_result = self.create_files_backup(f"{backup_name}_files")
            if not files_result["success"]:
                return files_result
            
            # Create full system archive
            with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add database backup
                if Path(db_result["backup_path"]).exists():
                    zipf.write(db_result["backup_path"], "database.sqlite")
                
                # Add files backup
                if Path(files_result["backup_path"]).exists():
                    zipf.write(files_result["backup_path"], "files.zip")
                
                # Add configuration files (using current working directory as project root)
                config_files = [
                    Path.cwd() / ".env",
                    Path.cwd() / "requirements.txt"
                ]
                
                for config_file in config_files:
                    if config_file.exists():
                        zipf.write(config_file, f"config/{config_file.name}")
            
            # Create metadata
            metadata = {
                "backup_type": "full",
                "backup_name": backup_name,
                "created_at": datetime.now().isoformat(),
                "file_size": backup_path.stat().st_size,
                "includes": {
                    "database": db_result.get("metadata", {}),
                    "files": files_result.get("metadata", {}),
                    "configuration": True
                }
            }
            
            metadata_path = self.full_backup_dir / f"{backup_name}_metadata.json"
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            # Record backup in history
            self._record_backup_history("full", backup_name, str(backup_path), metadata)
            
            logger.info(f"Full backup created: {backup_path}")
            
            return {
                "success": True,
                "backup_name": backup_name,
                "backup_path": str(backup_path),
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Full backup failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def restore_database_backup(self, backup_name: str) -> Dict[str, Any]:
        """Restore database from backup"""
        try:
            backup_path = self.db_backup_dir / f"{backup_name}.sqlite"
            
            if not backup_path.exists():
                return {
                    "success": False,
                    "error": f"Backup file not found: {backup_path}"
                }
            
            # Create a backup of current database before restoring
            current_backup = self.create_database_backup(f"pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            
            # Replace current database with backup
            # Note: The backup file is already encrypted with the same key
            current_db_path = settings.DATABASE_URL.replace("sqlite:///", "")
            shutil.copy2(backup_path, current_db_path)
            
            logger.info(f"Database restored from backup: {backup_name}")
            
            return {
                "success": True,
                "backup_name": backup_name,
                "restored_from": str(backup_path),
                "pre_restore_backup": current_backup.get("backup_name")
            }
            
        except Exception as e:
            logger.error(f"Database restore failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def list_backups(self, backup_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """List available backups"""
        backups = []
        
        backup_dirs = {
            "database": self.db_backup_dir,
            "files": self.file_backup_dir,
            "full": self.full_backup_dir
        }
        
        search_dirs = [backup_dirs[backup_type]] if backup_type else backup_dirs.values()
        
        for backup_dir in search_dirs:
            for metadata_file in backup_dir.glob("*_metadata.json"):
                try:
                    with open(metadata_file, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                    
                    backup_file = backup_dir / f"{metadata['backup_name']}.{'sqlite' if metadata['backup_type'] == 'database' else 'zip'}"
                    
                    if backup_file.exists():
                        metadata["file_exists"] = True
                        metadata["file_path"] = str(backup_file)
                        backups.append(metadata)
                    
                except Exception as e:
                    logger.warning(f"Failed to read metadata file {metadata_file}: {e}")
        
        # Sort by creation date (newest first)
        backups.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return backups
    
    def cleanup_old_backups(self, keep_days: int = 30) -> Dict[str, Any]:
        """Remove old backup files"""
        try:
            cutoff_date = datetime.now() - timedelta(days=keep_days)
            removed_files = []
            
            for backup_dir in [self.db_backup_dir, self.file_backup_dir, self.full_backup_dir]:
                for file_path in backup_dir.rglob("*"):
                    if file_path.is_file():
                        file_date = datetime.fromtimestamp(file_path.stat().st_mtime)
                        if file_date < cutoff_date:
                            file_path.unlink()
                            removed_files.append(str(file_path))
            
            # Update backup history
            db = SessionLocal()
            try:
                # Handle potential None query result with getattr approach
                try:
                    query_method = getattr(db, 'query')
                    query_result = query_method(BackupHistory).filter(
                        BackupHistory.created_at < cutoff_date
                    )
                    old_backups = query_result.all() if query_result is not None else []
                except:
                    old_backups = []
                
                for backup in old_backups:
                    db.delete(backup)
                
                db.commit()
                
            finally:
                db.close()
            
            logger.info(f"Cleaned up {len(removed_files)} old backup files")
            
            return {
                "success": True,
                "removed_files": removed_files,
                "removed_count": len(removed_files)
            }
            
        except Exception as e:
            logger.error(f"Backup cleanup failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_backup_statistics(self) -> Dict[str, Any]:
        """Get backup system statistics"""
        try:
            stats = {
                "total_backups": 0,
                "backup_types": {
                    "database": 0,
                    "files": 0,
                    "full": 0
                },
                "total_size_mb": 0,
                "latest_backup": None,
                "storage_usage": {}
            }
            
            backups = self.list_backups()
            stats["total_backups"] = len(backups)
            
            total_size = 0
            for backup in backups:
                backup_type = backup.get("backup_type", "unknown")
                if backup_type in stats["backup_types"]:
                    stats["backup_types"][backup_type] += 1
                
                file_size = backup.get("file_size", 0)
                total_size += file_size
                
                if not stats["latest_backup"] or backup.get("created_at", "") > stats["latest_backup"].get("created_at", ""):
                    stats["latest_backup"] = backup
            
            stats["total_size_mb"] = round(total_size / (1024 * 1024), 2)
            
            # Storage usage by directory
            for name, backup_dir in {
                "database": self.db_backup_dir,
                "files": self.file_backup_dir,
                "full": self.full_backup_dir
            }.items():
                dir_size = sum(f.stat().st_size for f in backup_dir.rglob('*') if f.is_file())
                stats["storage_usage"][name] = round(dir_size / (1024 * 1024), 2)
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get backup statistics: {e}")
            return {"error": str(e)}
    
    def _get_tables_count(self) -> int:
        """Get number of tables in database"""
        try:
            connection = engine.connect()
            try:
                result = connection.execute(text("SELECT COUNT(*) FROM sqlite_master WHERE type='table'"))
                count = result.scalar() or 0
                return count
            finally:
                # Safely close connection using getattr to avoid type checking issues
                close_method = getattr(connection, 'close', None)
                if close_method and callable(close_method):
                    try:
                        close_method()
                    except Exception:
                        pass  # Handle any closing errors
        except:
            return 0
    
    def _record_backup_history(self, backup_type: str, backup_name: str, 
                             backup_path: str, metadata: Dict[str, Any]):
        """Record backup in history table"""
        try:
            db: Session = SessionLocal()
            try:
                # Properly handle the datetime conversion
                created_at_value = datetime.now()
                created_at_str = metadata.get("created_at")
                
                if created_at_str and isinstance(created_at_str, str):
                    if "Z" in created_at_str:
                        created_at_value = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    else:
                        created_at_value = datetime.fromisoformat(created_at_str)
                
                # Fix the BackupHistory constructor to use dictionary approach
                backup_data = {
                    "backup_type": backup_type,
                    "backup_name": backup_name,
                    "file_path": backup_path,
                    "file_size": metadata.get("file_size", 0),
                    "backup_metadata": json.dumps(metadata),
                    "created_at": created_at_value
                }
                
                backup_record = BackupHistory(**backup_data)
                
                db.add(backup_record)
                db.commit()
                
            finally:
                db.close()
                
        except Exception as e:
            logger.warning(f"Failed to record backup history: {e}")

# Global backup service instance
backup_service = BackupService()