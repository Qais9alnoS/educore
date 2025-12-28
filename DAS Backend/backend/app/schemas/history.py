"""
History Schemas - Pydantic models for history API
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class HistoryLogCreate(BaseModel):
    """Schema for creating a history log entry"""
    action_type: str = Field(..., description="Type of action: create, update, delete, etc.")
    action_category: str = Field(..., description="Category: morning, evening, finance, director, system, activity")
    entity_type: str = Field(..., description="Entity type: student, class, transaction, etc.")
    entity_id: Optional[int] = Field(None, description="ID of the affected entity")
    entity_name: Optional[str] = Field(None, description="Display name of the entity")
    description: str = Field(..., description="Human-readable description in Arabic")
    academic_year_id: Optional[int] = None
    session_type: Optional[str] = Field(None, description="morning, evening, both, or null")
    severity: str = Field("info", description="info, warning, or critical")
    meta_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    tags: Optional[List[str]] = Field(default_factory=list)


class HistoryLogResponse(BaseModel):
    """Schema for history log response"""
    id: int
    timestamp: datetime
    action_type: str
    action_category: str
    entity_type: str
    entity_id: Optional[int]
    entity_name: Optional[str]
    user_id: Optional[int]
    user_name: Optional[str]
    user_role: Optional[str]
    description: str
    meta_data: Optional[Dict[str, Any]]
    session_type: Optional[str]
    severity: str
    is_visible: bool
    tags: Optional[List[str]]
    academic_year_id: Optional[int]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class HistoryFilters(BaseModel):
    """Schema for filtering history logs"""
    skip: int = Field(0, ge=0)
    limit: int = Field(20, ge=1, le=100)
    action_category: Optional[str] = None
    action_type: Optional[str] = None
    entity_type: Optional[str] = None
    severity: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    search_query: Optional[str] = None
    academic_year_id: Optional[int] = None


class HistoryStatistics(BaseModel):
    """Schema for history statistics"""
    actions_today: int
    actions_week: int
    actions_month: int
    most_active_user: Optional[str]
    most_active_user_count: int
    last_action_time: Optional[str]
    action_breakdown: Dict[str, int]


class HistoryListResponse(BaseModel):
    """Schema for paginated history list"""
    items: List[HistoryLogResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


class HistoryDetailResponse(BaseModel):
    """Schema for detailed history view"""
    id: int
    timestamp: str
    action_type: str
    action_category: str
    entity_type: str
    entity_id: Optional[int]
    entity_name: Optional[str]
    user_name: Optional[str]
    user_role: Optional[str]
    description: str
    meta_data: Optional[Dict[str, Any]]
    session_type: Optional[str]
    severity: str
    tags: Optional[List[str]]
    created_at: Optional[str]
