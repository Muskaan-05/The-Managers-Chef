from pydantic import BaseModel
from typing import Any, Dict, List


class AskChefRequest(BaseModel):
    question: str


class AskChefResponse(BaseModel):
    question: str
    answer: str
    memories: List[Dict[str, Any]]
