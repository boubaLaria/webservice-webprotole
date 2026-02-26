"""
Modèles Pydantic partagés entre les endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal


class Message(BaseModel):
    """Un message dans l'historique de conversation."""
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    """Corps de requête commun à tous les modes de communication."""
    messages: list[Message] = Field(..., min_length=1, description="Historique de la conversation")
    model: str = Field(default="llama-3.1-8b-instant", description="Modèle Groq à utiliser")


class ChatResponse(BaseModel):
    """Réponse pour le mode REST Synchrone."""
    response: str


class TaskCreated(BaseModel):
    """Réponse immédiate du mode Polling : identifiant de la tâche créée."""
    task_id: str


class TaskStatus(BaseModel):
    """État d'une tâche asynchrone (Polling)."""
    status: Literal["pending", "processing", "completed", "error"]
    result: Optional[str] = None
    error: Optional[str] = None
