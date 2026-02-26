/**
 * Mode 4 — WebSocket
 *
 * Flux :
 *   WS /ws/chat  → connexion persistante bidirectionnelle
 *   Client envoie : { "message": "...", "model": "..." }
 *   Serveur répond : { "type": "start"|"token"|"done"|"error", "data": "..." }
 *
 * La connexion est fermée et rouverte à chaque envoi pour ce démo.
 * En production, on la maintiendrait ouverte pour des échanges multi-tours.
 */
import { useState, useRef, useEffect } from "react";

const MODELS = [
  { id: "llama-3.1-8b-instant",   label: "LLaMA 3.1 8B (Rapide)" },
  { id: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B (Qualité)" },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B (Équilibré)" },
];

const WS_STATUS = {
  disconnected: { color: "#64748b", label: "Déconnecté" },
  connecting:   { color: "#f59e0b", label: "Connexion…" },
  connected:    { color: "#10b981", label: "Connecté" },
  error:        { color: "#ef4444", label: "Erreur" },
};

export default function WebSocketChat() {
  const [message,        setMessage]        = useState("");
  const [response,       setResponse]       = useState("");
  const [loading,        setLoading]        = useState(false);
  const [latency,        setLatency]        = useState(null);
  const [firstTokenTime, setFirstTokenTime] = useState(null);
  const [wsStatus,       setWsStatus]       = useState("disconnected");
  const [model,          setModel]          = useState(MODELS[0].id);
  const [error,          setError]          = useState(null);

  const wsRef         = useRef(null);
  const startRef      = useRef(null);
  const firstTokenRef = useRef(true);

  // Nettoyage à la destruction du composant
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendMessage = () => {
    if (!message.trim() || loading) return;

    // Fermer une connexion existante
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    setLoading(true);
    setResponse("");
    setLatency(null);
    setFirstTokenTime(null);
    setError(null);
    firstTokenRef.current = true;
    startRef.current = Date.now();

    setWsStatus("connecting");

    // ws:// en HTTP, wss:// en HTTPS
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/chat`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      ws.send(JSON.stringify({ message, model }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "token") {
          if (firstTokenRef.current) {
            setFirstTokenTime(Date.now() - startRef.current);
            firstTokenRef.current = false;
          }
          setResponse((prev) => prev + data.data);
        } else if (data.type === "done") {
          setLatency(Date.now() - startRef.current);
          setLoading(false);
          ws.close();
        } else if (data.type === "error") {
          setError(data.data ?? "Erreur serveur");
          setLoading(false);
          ws.close();
        }
      } catch {
        // Message non-JSON — ignorer
      }
    };

    ws.onerror = () => {
      setWsStatus("error");
      setError("Impossible d'établir la connexion WebSocket.");
      setLoading(false);
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
    };
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const { color, label } = WS_STATUS[wsStatus];

  return (
    <div className="chat-panel">
      <div className="panel-header ws">
        <h2>WebSocket</h2>
        <p className="description">
          Connexion <strong>persistante et bidirectionnelle</strong>. Idéal pour les conversations
          multi-tours et les applications nécessitant une faible latence après l'établissement
          initial de la connexion.
        </p>
      </div>

      <div className="panel-body">
        {/* Sélecteur de modèle + indicateur WS */}
        <div className="model-select-row">
          <label htmlFor="ws-model">Modèle :</label>
          <select
            id="ws-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
          >
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>

          {/* Indicateur d'état WebSocket */}
          <span className="ws-dot" style={{ background: color }} title={`WebSocket : ${label}`} />
          <span className="ws-status-label" style={{ color }}>{label}</span>
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
            className="send-btn ws"
            onClick={sendMessage}
            disabled={loading || !message.trim()}
          >
            {loading ? <span className="loader" /> : "Envoyer"}
          </button>
        </div>

        {/* Métriques de latence */}
        {(firstTokenTime !== null || latency !== null) && (
          <div className="metrics">
            {firstTokenTime !== null && (
              <span className="metric-badge first">
                ⚡ Premier token : {firstTokenTime} ms
              </span>
            )}
            {latency !== null && (
              <span className="metric-badge total">⏱ Temps total : {latency} ms</span>
            )}
          </div>
        )}

        {/* Réponse en streaming */}
        <div className="response-area">
          {error ? (
            <span style={{ color: "#ef4444" }}>Erreur : {error}</span>
          ) : response ? (
            <>
              {response}
              {loading && <span className="streaming-cursor" />}
            </>
          ) : loading ? (
            <div className="typing-indicator"><span /><span /><span /></div>
          ) : (
            <span className="response-placeholder">
              Les tokens apparaîtront ici en temps réel via la connexion WebSocket…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
