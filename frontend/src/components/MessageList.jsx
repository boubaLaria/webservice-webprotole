/**
 * Composant partagé — liste de messages style chat bubble
 *
 * Props :
 *   messages : [{role: "user"|"assistant"|"system", content: string, metrics?: object}]
 */
import { useEffect, useRef } from "react";

export default function MessageList({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <span className="response-placeholder">
          Commencez la conversation en envoyant un message…
        </span>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`message-bubble message-${msg.role}`}
        >
          <div className="message-content">{msg.content}</div>
          {msg.metrics && (
            <div className="message-meta">
              {msg.metrics.firstToken !== undefined && (
                <span className="metric-badge first">
                  ⚡ Premier token : {msg.metrics.firstToken} ms
                </span>
              )}
              {msg.metrics.total !== undefined && (
                <span className="metric-badge total">
                  ⏱ Temps total : {msg.metrics.total} ms
                </span>
              )}
              {msg.metrics.polls !== undefined && (
                <span className="metric-badge polls">
                  Requêtes de polling : {msg.metrics.polls}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
