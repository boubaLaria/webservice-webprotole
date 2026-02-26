/**
 * Mode 2 — REST Asynchrone + Polling
 *
 * Flux :
 *   1. POST /api/async/chat  → reçoit { task_id } immédiatement
 *   2. GET  /api/async/status/{task_id} toutes les 500 ms
 *   3. Arrêt du polling quand status === "completed" | "error"
 */
import { useState, useRef } from "react";

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
  const [message,   setMessage]   = useState("");
  const [response,  setResponse]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [status,    setStatus]    = useState(null);
  const [taskId,    setTaskId]    = useState(null);
  const [latency,   setLatency]   = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const [model,     setModel]     = useState(MODELS[0].id);
  const [error,     setError]     = useState(null);

  const intervalRef = useRef(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || loading) return;
    stopPolling();
    setLoading(true);
    setResponse("");
    setStatus(null);
    setTaskId(null);
    setLatency(null);
    setPollCount(0);
    setError(null);

    const start = Date.now();
    try {
      // ① Créer la tâche — retour immédiat
      const res = await fetch("/api/async/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model }),
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
            setLatency(Date.now() - start);
            setResponse(data.result ?? "");
            setLoading(false);
          } else if (data.status === "error") {
            stopPolling();
            setError(data.error ?? "Erreur inconnue");
            setLoading(false);
          }
        } catch (err) {
          stopPolling();
          setError(`Erreur polling : ${err.message}`);
          setLoading(false);
        }
      }, 500);
    } catch (err) {
      setError(err.message);
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
        {/* Sélecteur de modèle */}
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
        </div>

        {/* Zone de saisie */}
        <div className="input-row">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Entrez votre message…"
            disabled={loading}
          />
          <button
            className="send-btn polling"
            onClick={sendMessage}
            disabled={loading || !message.trim()}
          >
            {loading ? <span className="loader" /> : "Envoyer"}
          </button>
        </div>

        {/* État & métriques */}
        {status && (
          <div className="metrics" style={{ flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              <span className={`status-badge ${status}`}>
                {isActive && (
                  <span className="loader" style={{ width: 10, height: 10, borderWidth: 2 }} />
                )}
                {STATUS_LABELS[status]}
              </span>
              {pollCount > 0 && (
                <span className="metric-badge polls">
                  Requêtes de polling : {pollCount}
                </span>
              )}
              {latency !== null && (
                <span className="metric-badge total">⏱ Temps total : {latency} ms</span>
              )}
            </div>
            {taskId && (
              <p className="task-info">
                Task ID : {taskId.slice(0, 18)}…
              </p>
            )}
          </div>
        )}

        {/* Réponse */}
        <div className="response-area">
          {loading && !response ? (
            <div className="typing-indicator"><span /><span /><span /></div>
          ) : error ? (
            <span style={{ color: "#ef4444" }}>Erreur : {error}</span>
          ) : response ? (
            response
          ) : (
            <span className="response-placeholder">
              L'état de la tâche s'affichera pendant le polling, puis la réponse apparaîtra ici…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
