# Architecture Documentation — AI Chatbot Webservices

> **Atelier 2** · Conception et comparaison d'architectures de communication pour un chatbot IA connecté à l'API Groq.

---

## Vue d'ensemble

Ce projet expose **quatre modes de communication** distincts entre un frontend React et un backend FastAPI, tous alimentés par les modèles LLM Groq.

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend React                        │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │  Sync    │  │ Polling  │  │   SSE    │  │  WebSck  │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└────────┼─────────────┼─────────────┼──────────────┼────────┘
         │  HTTP POST  │  HTTP POST  │  HTTP POST   │  WS
    ┌────▼─────────────▼─────────────▼──────────────▼────┐
    │                  Nginx (port 3000)                  │
    │          Reverse proxy + SSE buffering off          │
    └────────────────────────┬────────────────────────────┘
                             │
    ┌────────────────────────▼────────────────────────────┐
    │               Backend FastAPI (port 8000)            │
    │  /api/sync/chat  /api/async/*  /api/sse/*  /ws/chat │
    └────────────────────────┬────────────────────────────┘
                             │  groq-python SDK
    ┌────────────────────────▼────────────────────────────┐
    │                    API Groq                          │
    │         LLaMA 3.1 8B / 3.3 70B / Mixtral 8x7B      │
    └─────────────────────────────────────────────────────┘
```

---

## Diagrammes de séquence

### 1. REST Synchrone

```
Client                    FastAPI                   Groq
  │                          │                          │
  │── POST /api/sync/chat ──►│                          │
  │     { message, model }   │── completions.create() ─►│
  │                          │      (non-streaming)     │
  │                          │◄── réponse complète ─────│
  │◄── 200 { response } ─────│                          │
  │                          │                          │
```

**Caractéristiques :**
- Connexion HTTP maintenue jusqu'à la fin de l'inférence
- Risque de timeout HTTP pour les longues réponses (>30 s)
- Idéal : questions courtes, FAQ, APIs de type RPC

---

### 2. REST Asynchrone + Polling

```
Client                    FastAPI                   Groq
  │                          │                          │
  │── POST /api/async/chat ─►│                          │
  │                          │── BackgroundTask ────────►│
  │◄── 202 { task_id } ──────│   (inférence async)      │
  │                          │                          │
  │── GET /status/{task_id} ►│  status = "pending"      │
  │◄── { status:"pending" } ─│                          │
  │                          │                          │
  │── GET /status/{task_id} ►│  status = "processing"   │
  │◄── { status:"processing"}│◄── réponse complète ─────│
  │                          │                          │
  │── GET /status/{task_id} ►│  status = "completed"    │
  │◄── { status:"completed", │                          │
  │      result: "..." }     │                          │
```

**Caractéristiques :**
- Découple la soumission de la récupération du résultat
- Pas de timeout (la tâche tourne en arrière-plan)
- Génère N+1 requêtes réseau (1 création + N polls)
- Idéal : traitement batch, longues inférences

---

### 3. Server-Sent Events (SSE)

```
Client                    FastAPI                   Groq
  │                          │                          │
  │── POST /api/sse/chat ───►│                          │
  │                          │── stream=True ──────────►│
  │◄── data: {"token":"Bon"} │◄── token 1 ──────────────│
  │◄── data: {"token":"jour"}│◄── token 2 ──────────────│
  │◄── data: {"token":"!"}   │◄── token 3 ──────────────│
  │◄── data: {"done":true}   │◄── [DONE] ───────────────│
  │  (connexion fermée)      │                          │
```

**Caractéristiques :**
- Flux **unidirectionnel** serveur → client
- Connexion HTTP longue durée (`text/event-stream`)
- Le premier token arrive très rapidement (TTFB bas)
- Reconnexion automatique native (EventSource API)
- Nginx : `proxy_buffering off` obligatoire

---

### 4. WebSocket

```
Client                    FastAPI                   Groq
  │                          │                          │
  │══ WS Connect /ws/chat ══►│                          │
  │◄══ 101 Switching Proto ══│                          │
  │                          │                          │
  │──{ message, model }─────►│                          │
  │                          │── stream=True ──────────►│
  │◄── { type:"start" } ─────│                          │
  │◄── { type:"token","Bon"} │◄── token 1 ──────────────│
  │◄── { type:"token","jour"}│◄── token 2 ──────────────│
  │◄── { type:"done" } ──────│◄── [DONE] ───────────────│
  │                          │                          │
  │──{ message:"Autre..." }─►│  (même connexion WS)     │
```

**Caractéristiques :**
- Connexion **bidirectionnelle persistante**
- Faible latence après l'établissement initial
- Support des échanges multi-tours sans ré-établir la connexion
- Plus complexe à gérer (déconnexions, ping/pong, auth)
- Nginx : headers `Upgrade` et `Connection: Upgrade` requis

---

## Stack technique

| Composant       | Technologie           | Rôle                                  |
|-----------------|-----------------------|---------------------------------------|
| Backend         | FastAPI + Uvicorn     | API REST, SSE, WebSocket              |
| LLM Client      | `groq` (AsyncGroq)    | Appels API Groq en mode async/stream  |
| SSE             | `sse-starlette`       | `EventSourceResponse`                 |
| Frontend        | React 18 + Vite 5     | SPA avec 4 composants spécialisés     |
| Proxy/Serveur   | Nginx                 | Serve React, proxy API + WS + SSE     |
| Orchestration   | Docker Compose        | Backend + Frontend                    |

---

## Configuration

### Variables d'environnement

| Variable      | Description                               | Requis |
|---------------|-------------------------------------------|--------|
| `GROQ_API_KEY`| Clé API Groq (console.groq.com)           | Oui    |

### Ports

| Service   | Port  | URL                        |
|-----------|-------|----------------------------|
| Frontend  | 3000  | http://localhost:3000      |
| Backend   | 8000  | http://localhost:8000/docs |

---

## Lancement

### Avec Docker (recommandé)

```bash
# 1. Configurer l'environnement
cp .env.example .env
# → Editer .env et renseigner GROQ_API_KEY

# 2. Construire et démarrer
docker-compose up --build

# 3. Accéder à l'interface
open http://localhost:3000

# Swagger UI du backend (optionnel)
open http://localhost:8000/docs
```

### En développement local (sans Docker)

```bash
# Terminal 1 — Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Créer backend/.env avec GROQ_API_KEY=xxx
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173 (proxy Vite vers localhost:8000)
```

---

## Structure des fichiers

```
/
├── .env.example              # Template de variables d'environnement
├── docker-compose.yml        # Orchestration des services
├── backend/
│   ├── main.py               # Routes FastAPI (sync, polling, SSE, WS)
│   ├── schemas.py            # Modèles Pydantic
│   ├── services/
│   │   └── groq_service.py   # Appels API Groq (AsyncGroq)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Shell principal + onglets
│   │   ├── index.css         # Design system (thème sombre)
│   │   └── components/
│   │       ├── SyncChat.jsx
│   │       ├── PollingChat.jsx
│   │       ├── SSEChat.jsx
│   │       └── WebSocketChat.jsx
│   ├── nginx.conf            # Config Nginx (proxy SSE/WS)
│   ├── vite.config.js        # Proxy de dev
│   └── Dockerfile
└── docs/
    ├── ARCHITECTURE.md       # Ce fichier
    └── COMPARISON.md         # Tableau comparatif (à remplir)
```
