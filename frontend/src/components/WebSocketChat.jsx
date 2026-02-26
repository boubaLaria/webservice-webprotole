/**
 * Mode 4 — WebSocket
 *
 * Flux :
 *   WS /ws/chat  → connexion persistante bidirectionnelle
 *   Client envoie : { "messages": [...], "model": "..." }
 *   Serveur répond : { "type": "start"|"token"|"done"|"error", "data": "..." }
 * Supporte l'historique multi-tours.
 */
import { useState, useRef, useEffect } from "react";
import MessageList from "./MessageList";
import { loadMessages, saveMessages, clearMessages } from "../utils/db";

const DB_KEY = "websocket";

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
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [model,    setModel]    = useState(MODELS[0].id);
  const [error,    setError]    = useState(null);

  const wsRef         = useRef(null);
  const startRef      = useRef(null);
  const firstTokenRef = useRef(true);
  const assistantIdxRef = useRef(null);

  // Chargement initial depuis IndexedDB
  useEffect(() => {
    loadMessages(DB_KEY).then(setMessages).catch(() => {});
  }, []);

  // Sauvegarde automatique à chaque changement de messages
  useEffect(() => {
    if (messages.length > 0) saveMessages(DB_KEY, messages).catch(() => {});
  }, [messages]);

  // Nettoyage à la destruction du composant
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || loading) return;

    // Fermer une connexion existante
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    const userMsg = { role: "user", content: text };

    setMessages((prev) => {
      const history = [...prev, userMsg, { role: "assistant", content: "" }];
      assistantIdxRef.current = history.length - 1;
      return history;
    });
    setInput("");
    setLoading(true);
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
      // Capture l'historique courant pour l'envoi
      setMessages((prev) => {
        const history = prev.slice(0, assistantIdxRef.current); // sans le placeholder assistant
        ws.send(JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          model,
        }));
        return prev;
      });
    };

    let firstTokenTime = null;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "token") {
          if (firstTokenRef.current) {
            firstTokenTime = Date.now() - startRef.current;
            firstTokenRef.current = false;
          }
          setMessages((prev) => {
            const updated = [...prev];
            const idx = assistantIdxRef.current;
            updated[idx] = { ...updated[idx], content: updated[idx].content + data.data };
            return updated;
          });
        } else if (data.type === "done") {
          const total = Date.now() - startRef.current;
          setMessages((prev) => {
            const updated = [...prev];
            const idx = assistantIdxRef.current;
            updated[idx] = {
              ...updated[idx],
              metrics: { firstToken: firstTokenTime, total },
            };
            return updated;
          });
          setLoading(false);
          ws.close();
        } else if (data.type === "error") {
          setError(data.data ?? "Erreur serveur");
          // Retirer le placeholder vide
          setMessages((prev) => prev.filter((_, i) => i !== assistantIdxRef.current));
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
      setMessages((prev) => prev.filter((_, i) => i !== assistantIdxRef.current));
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
        {/* Sélecteur de modèle + indicateur WS + nouvelle conversation */}
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
          <span className="ws-dot" style={{ background: color }} title={`WebSocket : ${label}`} />
          <span className="ws-status-label" style={{ color }}>{label}</span>
          <button className="clear-btn" onClick={() => { clearMessages(DB_KEY).catch(() => {}); setMessages([]); }} disabled={loading || messages.length === 0}>
            Nouvelle conversation
          </button>
        </div>

        {error && <div className="error-banner">Erreur : {error}</div>}

        {/* Liste de messages */}
        <MessageList messages={messages} />

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
            className="send-btn ws"
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
