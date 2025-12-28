"""
Director Notes File Management Service
Handles filesystem operations for director notes with folder/file hierarchy
"""

import os
import re
from pathlib import Path
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..database import SessionLocal
from ..models.director import DirectorNote
from ..config import settings, BASE_DIR

class DirectorNotesService:
    """Service for managing director notes files and folders"""
    
    # Category definitions
    CATEGORIES = {
        'goals': 'الأهداف',
        'projects': 'المشاريع',
        'blogs': 'مدونات',
        'educational_admin': 'الأمور التعليمية والإدارية'
    }
    
    def __init__(self):
        # Base directory for all director notes (relative to exe/script location)
        self.base_dir = BASE_DIR / "director_notes"
        self.base_dir.mkdir(exist_ok=True)
        
        # Maximum file size (5MB)
        self.max_file_size = 5 * 1024 * 1024
        
        # Initialize category structure
        self._initialize_directories()
    
    def _initialize_directories(self):
        """Create base directory structure for all categories"""
        for category in self.CATEGORIES.keys():
            category_dir = self.base_dir / category
            category_dir.mkdir(exist_ok=True)
    
    def _get_academic_year_path(self, academic_year_id: int, category: str) -> Path:
        """Get the path for a specific academic year and category"""
        path = self.base_dir / str(academic_year_id) / category
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def _validate_path(self, file_path: str) -> bool:
        """Validate file path to prevent directory traversal attacks"""
        # Check for dangerous characters and patterns
        if '..' in file_path or file_path.startswith('/') or file_path.startswith('\\'):
            return False
        
        # Check for absolute path attempts
        if os.path.isabs(file_path):
            return False
        
        # Normalize path separators to forward slashes for validation
        normalized_path = file_path.replace('\\', '/')
        
        # Only allow alphanumeric, spaces, underscores, hyphens, forward slashes, and Arabic characters
        if not re.match(r'^[\w\s\-/\u0600-\u06FF.]+$', normalized_path):
            return False
        
        return True
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to remove dangerous characters"""
        # Remove or replace dangerous characters
        filename = re.sub(r'[<>:"|?*\\]', '_', filename)
        # Remove leading/trailing spaces and dots
        filename = filename.strip('. ')
        return filename
    
    def _get_full_path(self, academic_year_id: int, category: str, file_path: Optional[str] = None) -> Path:
        """Get the full filesystem path for a note or folder"""
        base = self._get_academic_year_path(academic_year_id, category)
        
        if file_path:
            if not self._validate_path(file_path):
                raise ValueError("Invalid file path")
            return base / file_path
        
        return base
    
    def create_folder(self, db: Session, academic_year_id: int, category: str, 
                     folder_name: str, parent_folder_id: Optional[int] = None) -> Dict[str, Any]:
        """Create a new folder"""
        try:
            # Sanitize folder name
            folder_name = self._sanitize_filename(folder_name)
            
            if not folder_name:
                return {"success": False, "error": "Invalid folder name"}
            
            # Validate category
            if category not in self.CATEGORIES:
                return {"success": False, "error": "Invalid category"}
            
            # Determine parent path
            parent_path = ""
            if parent_folder_id:
                parent_folder = db.query(DirectorNote).filter(
                    DirectorNote.id == parent_folder_id,
                    DirectorNote.is_folder == True
                ).first()
                
                if not parent_folder:
                    return {"success": False, "error": "Parent folder not found"}
                
                parent_path = parent_folder.file_path or ""
            
            # Create relative path (normalize to forward slashes for cross-platform compatibility)
            relative_path = os.path.join(parent_path, folder_name) if parent_path else folder_name
            relative_path = relative_path.replace('\\', '/')
            
            # Check if folder already exists in database
            existing_folder = db.query(DirectorNote).filter(
                DirectorNote.academic_year_id == academic_year_id,
                DirectorNote.folder_type == category,
                DirectorNote.file_path == relative_path,
                DirectorNote.is_folder == True
            ).first()
            
            if existing_folder:
                return {"success": False, "error": "Folder already exists"}
            
            # Create physical directory
            full_path = self._get_full_path(academic_year_id, category, relative_path)
            full_path.mkdir(parents=True, exist_ok=True)
            
            # Create database record
            folder_record = DirectorNote(
                academic_year_id=academic_year_id,
                folder_type=category,
                title=folder_name,
                note_date=date.today(),
                file_path=relative_path,
                parent_folder_id=parent_folder_id,
                is_folder=True,
                content=None
            )
            
            db.add(folder_record)
            db.commit()
            db.refresh(folder_record)
            
            return {
                "success": True,
                "data": {
                    "folder_id": folder_record.id,
                    "folder_name": folder_name,
                    "file_path": relative_path
                }
            }
            
        except Exception as e:
            db.rollback()
            return {"success": False, "error": f"Failed to create folder: {str(e)}"}
    
    def create_file(self, db: Session, academic_year_id: int, category: str,
                   file_name: str, content: str, note_date: date,
                   parent_folder_id: Optional[int] = None) -> Dict[str, Any]:
        """Create a new markdown file"""
        try:
            # Sanitize and ensure .md extension
            file_name = self._sanitize_filename(file_name)
            if not file_name.endswith('.md'):
                file_name = file_name + '.md'
            
            if not file_name:
                return {"success": False, "error": "Invalid file name"}
            
            # Validate category
            if category not in self.CATEGORIES:
                return {"success": False, "error": "Invalid category"}
            
            # Check content size
            if len(content.encode('utf-8')) > self.max_file_size:
                return {"success": False, "error": "File content too large"}
            
            # Determine parent path
            parent_path = ""
            if parent_folder_id:
                parent_folder = db.query(DirectorNote).filter(
                    DirectorNote.id == parent_folder_id,
                    DirectorNote.is_folder == True
                ).first()
                
                if not parent_folder:
                    return {"success": False, "error": "Parent folder not found"}
                
                parent_path = parent_folder.file_path or ""
            
            # Create relative path (normalize to forward slashes for cross-platform compatibility)
            relative_path = os.path.join(parent_path, file_name) if parent_path else file_name
            relative_path = relative_path.replace('\\', '/')
            
            # Check if file already exists
            existing_file = db.query(DirectorNote).filter(
                DirectorNote.academic_year_id == academic_year_id,
                DirectorNote.folder_type == category,
                DirectorNote.file_path == relative_path,
                DirectorNote.is_folder == False
            ).first()
            
            if existing_file:
                return {"success": False, "error": "File already exists"}
            
            # Write physical file
            full_path = self._get_full_path(academic_year_id, category, relative_path)
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Create database record
            file_title = file_name.replace('.md', '')
            file_record = DirectorNote(
                academic_year_id=academic_year_id,
                folder_type=category,
                title=file_title,
                note_date=note_date,
                content=content,
                file_path=relative_path,
                parent_folder_id=parent_folder_id,
                is_folder=False
            )
            
            db.add(file_record)
            db.commit()
            db.refresh(file_record)
            
            return {
                "success": True,
                "data": {
                    "file_id": file_record.id,
                    "file_name": file_name,
                    "file_path": relative_path
                }
            }
            
        except Exception as e:
            db.rollback()
            return {"success": False, "error": f"Failed to create file: {str(e)}"}
    
    def read_file(self, db: Session, file_id: int) -> Dict[str, Any]:
        """Read a markdown file content"""
        try:
            # Get file record
            file_record = db.query(DirectorNote).filter(
                DirectorNote.id == file_id,
                DirectorNote.is_folder == False
            ).first()
            
            if not file_record:
                return {"success": False, "error": "File not found"}
            
            # Read physical file
            full_path = self._get_full_path(
                file_record.academic_year_id,
                file_record.folder_type,
                file_record.file_path
            )
            
            if not full_path.exists():
                return {"success": False, "error": "Physical file not found"}
            
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            return {
                "success": True,
                "data": {
                    "id": file_record.id,
                    "title": file_record.title,
                    "content": content,
                    "note_date": file_record.note_date,
                    "file_path": file_record.file_path,
                    "category": file_record.folder_type,
                    "created_at": file_record.created_at,
                    "updated_at": file_record.updated_at
                }
            }
            
        except Exception as e:
            return {"success": False, "error": f"Failed to read file: {str(e)}"}
    
    def update_file(self, db: Session, file_id: int, title: Optional[str] = None,
                   content: Optional[str] = None, note_date: Optional[date] = None) -> Dict[str, Any]:
        """Update a markdown file"""
        try:
            # Get file record
            file_record = db.query(DirectorNote).filter(
                DirectorNote.id == file_id,
                DirectorNote.is_folder == False
            ).first()
            
            if not file_record:
                return {"success": False, "error": "File not found"}
            
            # Update content if provided
            if content is not None:
                # Check content size
                if len(content.encode('utf-8')) > self.max_file_size:
                    return {"success": False, "error": "File content too large"}
                
                # Write to physical file
                full_path = self._get_full_path(
                    file_record.academic_year_id,
                    file_record.folder_type,
                    file_record.file_path
                )
                
                # Create backup before writing
                backup_content = None
                if full_path.exists():
                    with open(full_path, 'r', encoding='utf-8') as f:
                        backup_content = f.read()
                
                try:
                    with open(full_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    file_record.content = content
                except Exception as e:
                    # Restore backup if write fails
                    if backup_content is not None:
                        with open(full_path, 'w', encoding='utf-8') as f:
                            f.write(backup_content)
                    raise e
            
            # Update title if provided
            if title is not None:
                file_record.title = title
            
            # Update date if provided
            if note_date is not None:
                file_record.note_date = note_date
            
            file_record.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(file_record)
            
            return {
                "success": True,
                "data": {
                    "file_id": file_record.id
                },
                "message": "File updated successfully"
            }
            
        except Exception as e:
            db.rollback()
            return {"success": False, "error": f"Failed to update file: {str(e)}"}
    
    def delete_item(self, db: Session, item_id: int) -> Dict[str, Any]:
        """Delete a file or folder (recursive for folders)"""
        try:
            # Get item record
            item_record = db.query(DirectorNote).filter(DirectorNote.id == item_id).first()
            
            if not item_record:
                return {"success": False, "error": "Item not found"}
            
            # Get full path
            full_path = self._get_full_path(
                item_record.academic_year_id,
                item_record.folder_type,
                item_record.file_path
            )
            
            if item_record.is_folder:
                # Delete all children recursively in database
                self._delete_folder_recursive(db, item_id)
                
                # Delete physical directory
                if full_path.exists():
                    import shutil
                    shutil.rmtree(full_path)
            else:
                # Delete physical file
                if full_path.exists():
                    os.remove(full_path)
            
            # Delete database record
            db.delete(item_record)
            db.commit()
            
            return {
                "success": True,
                "message": f"{'Folder' if item_record.is_folder else 'File'} deleted successfully"
            }
            
        except Exception as e:
            db.rollback()
            return {"success": False, "error": f"Failed to delete item: {str(e)}"}
    
    def _delete_folder_recursive(self, db: Session, folder_id: int):
        """Recursively delete all children of a folder"""
        # Get all children
        children = db.query(DirectorNote).filter(
            DirectorNote.parent_folder_id == folder_id
        ).all()
        
        for child in children:
            if child.is_folder:
                # Recursively delete subfolder children
                self._delete_folder_recursive(db, child.id)
            db.delete(child)
    
    def list_items(self, db: Session, academic_year_id: int, category: str,
                  parent_folder_id: Optional[int] = None) -> Dict[str, Any]:
        """List all files and folders in a directory"""
        try:
            # Validate category
            if category not in self.CATEGORIES:
                return {"success": False, "error": "Invalid category"}
            
            # Query items
            query = db.query(DirectorNote).filter(
                DirectorNote.academic_year_id == academic_year_id,
                DirectorNote.folder_type == category
            )
            
            if parent_folder_id is None:
                query = query.filter(DirectorNote.parent_folder_id.is_(None))
            else:
                query = query.filter(DirectorNote.parent_folder_id == parent_folder_id)
            
            items = query.order_by(
                DirectorNote.is_folder.desc(),  # Folders first
                DirectorNote.title.asc()
            ).all()
            
            result_items = []
            for item in items:
                result_items.append({
                    "id": item.id,
                    "title": item.title,
                    "is_folder": item.is_folder,
                    "note_date": item.note_date,
                    "file_path": item.file_path,
                    "parent_folder_id": item.parent_folder_id,
                    "created_at": item.created_at,
                    "updated_at": item.updated_at
                })
            
            return {
                "success": True,
                "data": {
                    "items": result_items,
                    "total": len(result_items)
                }
            }
            
        except Exception as e:
            return {"success": False, "error": f"Failed to list items: {str(e)}"}
    
    def get_category_summary(self, db: Session, academic_year_id: int) -> Dict[str, Any]:
        """Get summary statistics for all categories"""
        try:
            summaries = []
            
            for category, display_name in self.CATEGORIES.items():
                # Count files and folders
                total_files = db.query(DirectorNote).filter(
                    DirectorNote.academic_year_id == academic_year_id,
                    DirectorNote.folder_type == category,
                    DirectorNote.is_folder == False
                ).count()
                
                total_folders = db.query(DirectorNote).filter(
                    DirectorNote.academic_year_id == academic_year_id,
                    DirectorNote.folder_type == category,
                    DirectorNote.is_folder == True
                ).count()
                
                summaries.append({
                    "category": category,
                    "display_name": display_name,
                    "total_files": total_files,
                    "total_folders": total_folders
                })
            
            return {
                "success": True,
                "data": {
                    "categories": summaries
                }
            }
            
        except Exception as e:
            return {"success": False, "error": f"Failed to get category summary: {str(e)}"}
    
    def search_notes(self, db: Session, query: str, academic_year_id: Optional[int] = None,
                    category: Optional[str] = None) -> Dict[str, Any]:
        """Search notes by title and content"""
        try:
            if len(query) < 1:
                return {"success": False, "error": "Search query is required"}
            
            # Build search query - include both files and folders
            search_pattern = f"%{query}%"
            db_query = db.query(DirectorNote).filter(
                or_(
                    DirectorNote.title.ilike(search_pattern),
                    DirectorNote.content.ilike(search_pattern)
                )
            )
            
            if academic_year_id:
                db_query = db_query.filter(DirectorNote.academic_year_id == academic_year_id)
            
            if category and category in self.CATEGORIES:
                db_query = db_query.filter(DirectorNote.folder_type == category)
            
            results = db_query.order_by(DirectorNote.updated_at.desc()).limit(50).all()
            
            search_results = []
            for result in results:
                # Create snippet from content
                snippet = None
                if result.content:
                    content_lower = result.content.lower()
                    query_lower = query.lower()
                    idx = content_lower.find(query_lower)
                    if idx != -1:
                        start = max(0, idx - 50)
                        end = min(len(result.content), idx + len(query) + 50)
                        snippet = "..." + result.content[start:end] + "..."
                    else:
                        snippet = result.content[:100] + "..." if len(result.content) > 100 else result.content
                
                search_results.append({
                    "id": result.id,
                    "title": result.title,
                    "folder_type": result.folder_type,
                    "note_date": result.note_date,
                    "snippet": snippet,
                    "file_path": result.file_path,
                    "is_folder": result.is_folder
                })
            
            return {
                "success": True,
                "data": {
                    "results": search_results,
                    "total": len(search_results)
                }
            }
            
        except Exception as e:
            return {"success": False, "error": f"Search failed: {str(e)}"}
    
    def rename_item(self, db: Session, item_id: int, new_name: str) -> Dict[str, Any]:
        """Rename a file or folder"""
        try:
            # Get item record
            item_record = db.query(DirectorNote).filter(DirectorNote.id == item_id).first()
            
            if not item_record:
                return {"success": False, "error": "Item not found"}
            
            # Sanitize new name
            new_name = self._sanitize_filename(new_name)
            if not new_name:
                return {"success": False, "error": "Invalid name"}
            
            # Add .md extension for files if not present
            if not item_record.is_folder and not new_name.endswith('.md'):
                new_name = new_name + '.md'
            
            # Calculate new path
            old_path = item_record.file_path
            if not old_path:
                return {"success": False, "error": "Invalid item path"}
            
            parent_path = os.path.dirname(old_path)
            new_relative_path = os.path.join(parent_path, new_name) if parent_path else new_name
            
            # Check if new name already exists
            existing = db.query(DirectorNote).filter(
                DirectorNote.academic_year_id == item_record.academic_year_id,
                DirectorNote.folder_type == item_record.folder_type,
                DirectorNote.file_path == new_relative_path,
                DirectorNote.id != item_id
            ).first()
            
            if existing:
                return {"success": False, "error": "Name already exists"}
            
            # Rename physical file/folder
            old_full_path = self._get_full_path(
                item_record.academic_year_id,
                item_record.folder_type,
                old_path
            )
            
            new_full_path = self._get_full_path(
                item_record.academic_year_id,
                item_record.folder_type,
                new_relative_path
            )
            
            if old_full_path.exists():
                os.rename(old_full_path, new_full_path)
            
            # Update database record
            item_record.title = new_name.replace('.md', '') if not item_record.is_folder else new_name
            item_record.file_path = new_relative_path
            item_record.updated_at = datetime.utcnow()
            
            # Update children paths if it's a folder
            if item_record.is_folder:
                self._update_children_paths(db, item_record.id, old_path, new_relative_path)
            
            db.commit()
            
            return {
                "success": True,
                "message": "Item renamed successfully",
                "new_name": new_name
            }
            
        except Exception as e:
            db.rollback()
            return {"success": False, "error": f"Failed to rename item: {str(e)}"}
    
    def _update_children_paths(self, db: Session, folder_id: int, old_parent_path: str, new_parent_path: str):
        """Update file paths for all children when a folder is renamed"""
        children = db.query(DirectorNote).filter(
            DirectorNote.parent_folder_id == folder_id
        ).all()
        
        for child in children:
            if child.file_path:
                # Replace old parent path with new parent path
                child.file_path = child.file_path.replace(old_parent_path, new_parent_path, 1)
                
                if child.is_folder:
                    # Recursively update grandchildren
                    self._update_children_paths(db, child.id, old_parent_path, new_parent_path)

# Global service instance
director_notes_service = DirectorNotesService()

