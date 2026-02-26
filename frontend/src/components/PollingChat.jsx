/**
 * Mode 2 — REST Asynchrone + Polling
 *
 * Flux :
 *   1. POST /api/async/chat  → reçoit { task_id } immédiatement
 *   2. GET  /api/async/status/{task_id} toutes les 500 ms
 *   3. Arrêt du polling quand status === "completed" | "error"
 * Supporte l'historique multi-tours.
 */
import { useState, useRef, useEffect } from "react";
import MessageList from "./MessageList";
import { loadMessages, saveMessages, clearMessages } from "../utils/db";

const DB_KEY = "polling";

const MODELS = [
  { id: "llama-3.1-8b-instant",   label: "LLaMA 3.1 8B (Rapide)" },
  { id: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B (Qualité)" },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B (Équilibré)" },
];

const STATUS_LABELS = {
  pending:    "En attente",
  processing: "En cours de traitement…",
  completed:  "Terminé",
  error:      "Erreur",
};

export default function PollingChat() {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [status,    setStatus]    = useState(null);
  const [taskId,    setTaskId]    = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const [model,     setModel]     = useState(MODELS[0].id);
  const [error,     setError]     = useState(null);

  const intervalRef  = useRef(null);
  const historyRef   = useRef([]);

  // Chargement initial depuis IndexedDB
  useEffect(() => {
    loadMessages(DB_KEY).then(setMessages).catch(() => {});
  }, []);

  // Sauvegarde automatique à chaque changement de messages
  useEffect(() => {
    if (messages.length > 0) saveMessages(DB_KEY, messages).catch(() => {});
  }, [messages]);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    stopPolling();

    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    historyRef.current = history;
    setMessages(history);
    setInput("");
    setLoading(true);
    setStatus(null);
    setTaskId(null);
    setPollCount(0);
    setError(null);

    const start = Date.now();
    try {
      // ① Créer la tâche — retour immédiat
      const res = await fetch("/api/async/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          model,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { task_id } = await res.json();
      setTaskId(task_id);
      setStatus("pending");

      // ② Polling toutes les 500 ms
      let polls = 0;
      intervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/async/status/${task_id}`);
          if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
          const data = await statusRes.json();
          polls += 1;
          setPollCount(polls);
          setStatus(data.status);

          if (data.status === "completed") {
            stopPolling();
            const total = Date.now() - start;
            setMessages([
              ...historyRef.current,
              { role: "assistant", content: data.result ?? "", metrics: { total, polls } },
            ]);
            setLoading(false);
          } else if (data.status === "error") {
            stopPolling();
            setError(data.error ?? "Erreur inconnue");
            setMessages(historyRef.current);
            setLoading(false);
          }
        } catch (err) {
          stopPolling();
          setError(`Erreur polling : ${err.message}`);
          setMessages(historyRef.current);
          setLoading(false);
        }
      }, 500);
    } catch (err) {
      setError(err.message);
      setMessages(historyRef.current);
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const isActive = status === "pending" || status === "processing";

  return (
    <div className="chat-panel">
      <div className="panel-header polling">
        <h2>REST Asynchrone + Polling</h2>
        <p className="description">
          La tâche est créée en arrière-plan et un <code>task_id</code> est retourné{" "}
          <strong>immédiatement</strong>. Le client interroge le serveur régulièrement
          jusqu'à obtenir le résultat.
        </p>
      </div>

      <div className="panel-body">
        {/* Sélecteur de modèle + nouvelle conversation */}
        <div className="model-select-row">
          <label htmlFor="polling-model">Modèle :</label>
          <select
            id="polling-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
          >
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button className="clear-btn" onClick={() => { clearMessages(DB_KEY).catch(() => {}); setMessages([]); setStatus(null); }} disabled={loading || messages.length === 0}>
            Nouvelle conversation
          </button>
        </div>

        {/* Indicateur de statut polling */}
        {status && isActive && (
          <div className="metrics">
            <span className={`status-badge ${status}`}>
              <span className="loader" style={{ width: 10, height: 10, borderWidth: 2 }} />
              {STATUS_LABELS[status]}
            </span>
            {pollCount > 0 && (
              <span className="metric-badge polls">Requêtes : {pollCount}</span>
            )}
            {taskId && (
              <span className="task-info">Task : {taskId.slice(0, 18)}…</span>
            )}
          </div>
        )}

        {error && <div className="error-banner">Erreur : {error}</div>}

        {/* Liste de messages */}
        <MessageList messages={
          loading
            ? [...messages, { role: "assistant", content: STATUS_LABELS[status] ?? "…" }]
            : messages
        } />

        {/* Barre de saisie */}
        <div className="chat-input-bar">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Entrez votre message…"
            disabled={loading}
            rows={2}
          />
          <button
            className="send-btn polling"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            {loading ? <span className="loader" /> : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
