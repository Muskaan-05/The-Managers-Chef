from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.task import Task
from app.api.schemas.task_schema import (
    TaskCreate,
    TaskUpdate,
    TaskOut,
    TaskListOut,
)

from app.services.task_service import (
    create_task as svc_create_task,
    list_tasks as svc_list_tasks,
    update_task as svc_update_task,
    delete_task as svc_delete_task,
)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=TaskListOut)
@router.get("/", response_model=TaskListOut, include_in_schema=False)
def list_tasks(
    status: Optional[str] = None,
    context_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tasks = svc_list_tasks(db, current_user.id, status=status, context_id=context_id)
    return {"tasks": tasks}


@router.post("", response_model=TaskOut)
@router.post("/", response_model=TaskOut, include_in_schema=False)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc_create_task(
        db=db,
        user_id=current_user.id,
        **payload.model_dump(),
    )


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = svc_update_task(
        db=db,
        user_id=current_user.id,
        task_id=task_id,
        updates=payload.model_dump(exclude_unset=True),
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = svc_delete_task(db=db, user_id=current_user.id, task_id=task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return None

