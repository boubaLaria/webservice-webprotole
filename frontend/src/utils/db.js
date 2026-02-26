/**
 * Couche IndexedDB — persistance de l'historique des conversations.
 *
 * Base   : "ai-chatbot"
 * Store  : "conversations"
 * Clés   : "sync" | "polling" | "sse" | "websocket"
 * Valeur : tableau de messages [{ role, content, metrics? }]
 */

const DB_NAME    = "ai-chatbot";
const DB_VERSION = 1;
const STORE      = "conversations";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE);
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = ()  => reject(req.error);
  });
}

/** Charge les messages d'une conversation. Retourne [] si inexistante. */
export async function loadMessages(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

/** Sauvegarde le tableau de messages pour une clé donnée. */
export async function saveMessages(key, messages) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(messages, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** Supprime l'historique d'une conversation. */
export async function clearMessages(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
