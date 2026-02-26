/**
 * Mode 1 — REST Synchrone
 *
 * Flux : POST /api/sync/chat → attend la réponse complète → affiche.
 * La connexion HTTP reste ouverte pendant toute la durée de l'inférence.
 * Supporte l'historique multi-tours.
 */
import { useState, useEffect } from "react";
import MessageList from "./MessageList";
import { loadMessages, saveMessages, clearMessages } from "../utils/db";

const DB_KEY = "sync";

const MODELS = [
  { id: "llama-3.1-8b-instant",   label: "LLaMA 3.1 8B (Rapide)" },
  { id: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B (Qualité)" },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B (Équilibré)" },
];

export default function SyncChat() {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [model,    setModel]    = useState(MODELS[0].id);
  const [error,    setError]    = useState(null);

  // Chargement initial depuis IndexedDB
  useEffect(() => {
    loadMessages(DB_KEY).then(setMessages).catch(() => {});
  }, []);

  // Sauvegarde automatique à chaque changement de messages
  useEffect(() => {
    if (messages.length > 0) saveMessages(DB_KEY, messages).catch(() => {});
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    setError(null);

    const start = Date.now();
    try {
      const res = await fetch("/api/sync/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          model,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const total = Date.now() - start;
      setMessages([
        ...history,
        { role: "assistant", content: data.response, metrics: { total } },
      ]);
    } catch (err) {
      setError(err.message);
      // Retirer le message utilisateur si erreur
      setMessages(messages);
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
        {/* Sélecteur de modèle + bouton nouvelle conversation */}
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
          <button className="clear-btn" onClick={() => { clearMessages(DB_KEY).catch(() => {}); setMessages([]); }} disabled={loading || messages.length === 0}>
            Nouvelle conversation
          </button>
        </div>

        {/* Liste de messages */}
        {error && <div className="error-banner">Erreur : {error}</div>}
        <MessageList messages={loading ? [...messages, { role: "assistant", content: "…" }] : messages} />

        {/* Barre de saisie */}
        <div className="chat-input-bar">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Entrez votre message… (Entrée pour envoyer, Shift+Entrée pour sauter une ligne)"
            disabled={loading}
            rows={2}
          />
          <button
            className="send-btn sync"
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
