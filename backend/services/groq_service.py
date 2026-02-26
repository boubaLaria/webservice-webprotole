"""
Couche d'accès à l'API Groq.

Utilise le client AsyncGroq pour toutes les opérations afin de rester
compatible avec la boucle d'événements FastAPI sans bloquer.
"""
import os
from typing import AsyncGenerator
from dotenv import load_dotenv, find_dotenv
from groq import AsyncGroq

# Charge le .env depuis le répertoire courant OU les répertoires parents.
# En production Docker, la variable est injectée par docker-compose → no-op.
load_dotenv(find_dotenv(raise_error_if_not_found=False))

DEFAULT_MODEL = "llama-3.1-8b-instant"
MAX_TOKENS = 1024

# Singleton client (réutilisé entre les requêtes)
_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY manquante. "
                "Copiez .env.example en .env et renseignez votre clé."
            )
        _client = AsyncGroq(api_key=api_key)
    return _client


async def call_groq_complete(messages: list[dict], model: str = DEFAULT_MODEL) -> str:
    """
    Appel non-streaming : attend la réponse complète.
    Utilisé par REST Synchrone et Polling (tâche background).
    """
    client = _get_client()
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=MAX_TOKENS,
    )
    return response.choices[0].message.content or ""


async def stream_groq_tokens(
    messages: list[dict], model: str = DEFAULT_MODEL
) -> AsyncGenerator[str, None]:
    """
    Appel streaming : yield chaque token au fur et à mesure.
    Utilisé par SSE et WebSocket.
    """
    client = _get_client()
    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=MAX_TOKENS,
        stream=True,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content
