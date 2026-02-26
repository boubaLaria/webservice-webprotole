"""
Point d'entrée FastAPI — Atelier 2 : Architectures Webservices Chatbot IA

Expose 4 modes de communication distincts :
  1. POST /api/sync/chat          → REST Synchrone
  2. POST /api/async/chat         → REST Asynchrone (création de tâche)
     GET  /api/async/status/{id}  → Polling de l'état
  3. POST /api/sse/chat           → Server-Sent Events (streaming)
  4. WS   /ws/chat                → WebSocket (bidirectionnel)
"""
import json
import uuid
from typing import Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from schemas import ChatRequest, ChatResponse, TaskCreated, TaskStatus
from services.groq_service import call_groq_complete, stream_groq_tokens

# ── Application ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Chatbot — Architecture Comparison",
    description="Atelier 2 : comparaison de 4 modes de communication avec Groq",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restreindre en production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stockage en mémoire des tâches asynchrones (polling)
# En production : remplacer par Redis ou une base de données
tasks: Dict[str, Any] = {}


# ── Santé ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Infra"])
async def health_check():
    return {"status": "ok"}


@app.get("/", tags=["Infra"])
async def root():
    return {
        "name": "AI Chatbot API",
        "architectures": ["sync", "polling", "sse", "websocket"],
        "docs": "/docs",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. REST SYNCHRONE
# ═══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/api/sync/chat",
    response_model=ChatResponse,
    tags=["1 - REST Synchrone"],
    summary="Requête/Réponse classique",
    description=(
        "Envoie un message et attend **la réponse complète** avant de retourner. "
        "La connexion HTTP reste ouverte pendant toute la durée de l'inférence."
    ),
)
async def sync_chat(request: ChatRequest):
    result = await call_groq_complete(request.message, request.model)
    return ChatResponse(response=result)


# ═══════════════════════════════════════════════════════════════════════════════
# 2. REST ASYNCHRONE + POLLING
# ═══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/api/async/chat",
    response_model=TaskCreated,
    status_code=202,
    tags=["2 - REST Polling"],
    summary="Créer une tâche asynchrone",
    description=(
        "Crée une tâche en arrière-plan et retourne un `task_id` **immédiatement**. "
        "Le client doit ensuite interroger `/api/async/status/{task_id}` pour obtenir le résultat."
    ),
)
async def async_chat(request: ChatRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    tasks[task_id] = {"status": "pending", "result": None, "error": None}
    background_tasks.add_task(_process_groq_task, task_id, request.message, request.model)
    return TaskCreated(task_id=task_id)


async def _process_groq_task(task_id: str, message: str, model: str) -> None:
    """Tâche exécutée en arrière-plan pour le mode Polling."""
    tasks[task_id]["status"] = "processing"
    try:
        result = await call_groq_complete(message, model)
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["result"] = result
    except Exception as exc:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(exc)


@app.get(
    "/api/async/status/{task_id}",
    response_model=TaskStatus,
    tags=["2 - REST Polling"],
    summary="Vérifier l'état d'une tâche",
)
async def get_task_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    task = tasks[task_id]
    return TaskStatus(
        status=task["status"],
        result=task.get("result"),
        error=task.get("error"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. SERVER-SENT EVENTS (SSE)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post(
    "/api/sse/chat",
    tags=["3 - SSE Streaming"],
    summary="Streaming via Server-Sent Events",
    description=(
        "Ouvre une connexion HTTP persistante et pousse les tokens au client "
        "au fur et à mesure via le protocole SSE. "
        "Le frontend lit le flux avec `fetch` + `ReadableStream`."
    ),
)
async def sse_chat(request: ChatRequest):
    async def event_generator():
        async for token in stream_groq_tokens(request.message, request.model):
            yield {"data": json.dumps({"token": token})}
        # Signal de fin pour que le client puisse clore la connexion
        yield {"data": json.dumps({"done": True})}

    return EventSourceResponse(event_generator())


# ═══════════════════════════════════════════════════════════════════════════════
# 4. WEBSOCKET
# ═══════════════════════════════════════════════════════════════════════════════

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """
    Connexion WebSocket persistante et bidirectionnelle.

    Protocole de messages JSON :
      Client → Serveur : { "message": "...", "model": "..." }
      Serveur → Client : { "type": "start" | "token" | "done" | "error", "data": "..." }
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "").strip()
            model = data.get("model", "llama-3.1-8b-instant")

            if not message:
                await websocket.send_json({"type": "error", "data": "Message vide"})
                continue

            await websocket.send_json({"type": "start"})

            async for token in stream_groq_tokens(message, model):
                await websocket.send_json({"type": "token", "data": token})

            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        pass  # Déconnexion normale côté client
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "data": str(exc)})
        except Exception:
            pass
