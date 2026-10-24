from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class MeetingCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: Optional[datetime] = None
    meet_link: Optional[str] = None
    status: Optional[str] = "scheduled"
    participants: Optional[List[str]] = []
    context_id: UUID


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    meet_link: Optional[str] = None
    status: Optional[str] = None
    participants: Optional[List[str]] = None
    context_id: Optional[UUID] = None


class MeetingOut(BaseModel):
    id: UUID
    user_id: UUID
    context_id: UUID
    title: str
    start_time: datetime
    end_time: Optional[datetime] = None
    participants: Optional[List[str]] = []
    transcript: Optional[str] = None
    summary: Optional[str] = None
    meet_link: Optional[str] = None
    status: Optional[str] = "scheduled"
    bot_process_id: Optional[int] = None
    bot_transcript_path: Optional[str] = None

    class Config:
        from_attributes = True


class MeetingListOut(BaseModel):
    meetings: List[MeetingOut]


class TranscriptPayload(BaseModel):
    transcript: str


class ActionItemOut(BaseModel):
    person: str
    task: str
    deadline: Optional[str] = None


class MeetingSummaryOut(BaseModel):
    summary: str
    decisions: List[str] = []
    action_items: List[ActionItemOut] = []
    unresolved_questions: List[str] = []


class MeetingBriefItemOut(BaseModel):
    type: str
    content: str
    source_reference: Optional[str] = None


class MeetingBriefResponse(BaseModel):
    brief: List[MeetingBriefItemOut] = []


class JoinMeetingRequest(BaseModel):
    meet_link: Optional[str] = None


class JoinMeetingResponse(BaseModel):
    status: str
    bot_pid: Optional[int] = None
    meet_link: Optional[str] = None
    message: Optional[str] = None


class MeetingProcessResponse(BaseModel):
    status: str
    meeting_id: str
    summary: str
    decisions: List[str] = []
    commitments: List[dict] = []
