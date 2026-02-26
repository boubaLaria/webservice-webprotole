/**
 * Mode 1 — REST Synchrone
 *
 * Flux : POST /api/sync/chat → attend la réponse complète → affiche.
 * La connexion HTTP reste ouverte pendant toute la durée de l'inférence.
 */
import { useState } from "react";

const MODELS = [
  { id: "llama-3.1-8b-instant",   label: "LLaMA 3.1 8B (Rapide)" },
  { id: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B (Qualité)" },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B (Équilibré)" },
];

export default function SyncChat() {
  const [message,  setMessage]  = useState("");
  const [response, setResponse] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [latency,  setLatency]  = useState(null);
  const [model,    setModel]    = useState(MODELS[0].id);
  const [error,    setError]    = useState(null);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    setResponse("");
    setLatency(null);
    setError(null);

    const start = Date.now();
    try {
      const res = await fetch("/api/sync/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLatency(Date.now() - start);
      setResponse(data.response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="chat-panel">
      <div className="panel-header sync">
        <h2>REST Synchrone</h2>
        <p className="description">
          La requête HTTP attend la <strong>réponse complète</strong> du LLM avant de retourner.
          Simple et prévisible, mais bloque la connexion pour les longues réponses.
        </p>
      </div>

      <div className="panel-body">
        {/* Sélecteur de modèle */}
        <div className="model-select-row">
          <label htmlFor="sync-model">Modèle :</label>
          <select
            id="sync-model"
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
            placeholder="Entrez votre message… (Entrée pour envoyer, Shift+Entrée pour sauter une ligne)"
            disabled={loading}
          />
          <button
            className="send-btn sync"
            onClick={sendMessage}
            disabled={loading || !message.trim()}
          >
            {loading ? <span className="loader" /> : "Envoyer"}
          </button>
        </div>

        {/* Métriques */}
        {latency !== null && (
          <div className="metrics">
            <span className="metric-badge total">⏱ Temps total : {latency} ms</span>
          </div>
        )}

        {/* Réponse */}
        <div className="response-area">
          {loading ? (
            <div className="typing-indicator"><span /><span /><span /></div>
          ) : error ? (
            <span style={{ color: "#ef4444" }}>Erreur : {error}</span>
          ) : response ? (
            response
          ) : (
            <span className="response-placeholder">
              La réponse complète apparaîtra ici après l'envoi…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
