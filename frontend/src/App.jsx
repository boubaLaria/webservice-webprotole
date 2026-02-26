import { useState } from "react";
import SyncChat from "./components/SyncChat";
import PollingChat from "./components/PollingChat";
import SSEChat from "./components/SSEChat";
import WebSocketChat from "./components/WebSocketChat";

const TABS = [
  {
    id: "sync",
    label: "1. REST Synchrone",
    colorClass: "sync",
    component: SyncChat,
    badge: "POST → Réponse complète",
  },
  {
    id: "polling",
    label: "2. REST + Polling",
    colorClass: "polling",
    component: PollingChat,
    badge: "POST → task_id → GET status",
  },
  {
    id: "sse",
    label: "3. SSE Streaming",
    colorClass: "sse",
    component: SSEChat,
    badge: "POST → EventStream",
  },
  {
    id: "ws",
    label: "4. WebSocket",
    colorClass: "ws",
    component: WebSocketChat,
    badge: "WS → Bidirectionnel",
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("sync");

  const active = TABS.find((t) => t.id === activeTab);
  const ActiveComponent = active?.component;

  return (
    <div className="app">
      <header>
        <h1>AI Chatbot — Architectures Webservices</h1>
        <p>
          Atelier 2 &middot; Comparaison de 4 modes de communication avec{" "}
          <strong>Groq</strong>
        </p>
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? `active ${tab.colorClass}` : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-label">{tab.label}</span>
            <span className="tab-badge">{tab.badge}</span>
          </button>
        ))}
      </nav>

      <main>{ActiveComponent && <ActiveComponent />}</main>

      <footer>
        Propulsé par{" "}
        <span style={{ color: "var(--color-sse)" }}>Groq</span> ·{" "}
        <span style={{ color: "var(--color-sync)" }}>FastAPI</span> ·{" "}
        <span style={{ color: "var(--color-ws)" }}>React</span>
      </footer>
    </div>
  );
}
