/**
 * Mode 3 — Server-Sent Events (SSE)
 *
 * Flux :
 *   POST /api/sse/chat → connexion HTTP longue durée
 *   Le serveur pousse les tokens via le format text/event-stream.
 *   On lit le flux avec fetch + ReadableStream (compatible POST).
 */
import { useState, useRef } from "react";

const MODELS = [
  { id: "llama-3.1-8b-instant",   label: "LLaMA 3.1 8B (Rapide)" },
  { id: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B (Qualité)" },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B (Équilibré)" },
];

export default function SSEChat() {
  const [message,        setMessage]        = useState("");
  const [response,       setResponse]       = useState("");
  const [loading,        setLoading]        = useState(false);
  const [latency,        setLatency]        = useState(null);
  const [firstTokenTime, setFirstTokenTime] = useState(null);
  const [model,          setModel]          = useState(MODELS[0].id);
  const [error,          setError]          = useState(null);

  const startRef      = useRef(null);
  const firstTokenRef = useRef(true);
  const abortRef      = useRef(null);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    // Annuler un streaming précédent si toujours en cours
    if (abortRef.current) abortRef.current.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setResponse("");
    setLatency(null);
    setFirstTokenTime(null);
    setError(null);
    firstTokenRef.current = true;
    startRef.current = Date.now();

    try {
      const res = await fetch("/api/sse/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model }),
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // garder la ligne incomplète

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              setLatency(Date.now() - startRef.current);
            } else if (data.token) {
              if (firstTokenRef.current) {
                setFirstTokenTime(Date.now() - startRef.current);
                firstTokenRef.current = false;
              }
              setResponse((prev) => prev + data.token);
            }
          } catch {
            // Ligne SSE malformée — on ignore
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
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
        {/* Sélecteur de modèle */}
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
            className="send-btn sse"
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
              Les tokens apparaîtront ici en temps réel au fil du streaming SSE…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
