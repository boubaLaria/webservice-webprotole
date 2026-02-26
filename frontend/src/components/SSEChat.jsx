/**
 * Mode 3 — Server-Sent Events (SSE)
 *
 * Flux :
 *   POST /api/sse/chat → connexion HTTP longue durée
 *   Le serveur pousse les tokens via le format text/event-stream.
 *   On lit le flux avec fetch + ReadableStream (compatible POST).
 * Supporte l'historique multi-tours.
 */
import { useState, useRef } from "react";
import MessageList from "./MessageList";

const MODELS = [
  { id: "llama-3.1-8b-instant",   label: "LLaMA 3.1 8B (Rapide)" },
  { id: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B (Qualité)" },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B (Équilibré)" },
];

export default function SSEChat() {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [model,    setModel]    = useState(MODELS[0].id);
  const [error,    setError]    = useState(null);

  const abortRef      = useRef(null);
  const startRef      = useRef(null);
  const firstTokenRef = useRef(true);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Annuler un streaming précédent si toujours en cours
    if (abortRef.current) abortRef.current.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    // Placeholder pour la réponse de l'assistant
    const assistantIdx = history.length;
    const withPlaceholder = [...history, { role: "assistant", content: "" }];

    setMessages(withPlaceholder);
    setInput("");
    setLoading(true);
    setError(null);
    firstTokenRef.current = true;
    startRef.current = Date.now();

    try {
      const res = await fetch("/api/sse/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          model,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      // Lecture du flux SSE ligne par ligne
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let firstToken = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              const total = Date.now() - startRef.current;
              setMessages((prev) => {
                const updated = [...prev];
                updated[assistantIdx] = {
                  ...updated[assistantIdx],
                  metrics: { firstToken, total },
                };
                return updated;
              });
            } else if (data.token) {
              if (firstTokenRef.current) {
                firstToken = Date.now() - startRef.current;
                firstTokenRef.current = false;
              }
              setMessages((prev) => {
                const updated = [...prev];
                updated[assistantIdx] = {
                  ...updated[assistantIdx],
                  content: updated[assistantIdx].content + data.token,
                };
                return updated;
              });
            }
          } catch {
            // Ligne SSE malformée — on ignore
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
        // Retirer le placeholder vide
        setMessages((prev) => prev.filter((_, i) => i !== assistantIdx));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="chat-panel">
      <div className="panel-header sse">
        <h2>Server-Sent Events (SSE)</h2>
        <p className="description">
          Le serveur pousse les tokens au fil de l'inférence via une connexion HTTP persistante.
          Flux <strong>unidirectionnel</strong> (serveur → client) — latence perçue très faible
          grâce au premier token rapide.
        </p>
      </div>

      <div className="panel-body">
        {/* Sélecteur de modèle + nouvelle conversation */}
        <div className="model-select-row">
          <label htmlFor="sse-model">Modèle :</label>
          <select
            id="sse-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
          >
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button className="clear-btn" onClick={() => setMessages([])} disabled={loading || messages.length === 0}>
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
            className="send-btn sse"
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
