# Comparaison des Architectures de Communication — Atelier 2

> **Instructions :** Remplissez ce document après avoir testé chaque architecture
> avec l'interface fournie sur `http://localhost:3000`.
> Utilisez vos mesures de latence, vos observations et la documentation Groq pour
> compléter les colonnes et justifier vos recommandations.

---

## 1. Tableau Comparatif Rapide

| Critère                       | REST Sync      | REST + Polling | SSE            | WebSocket      |
|-------------------------------|:--------------:|:--------------:|:--------------:|:--------------:|
| **Latence perçue (TTFB)**     | _(à mesurer)_  | _(à mesurer)_  | _(à mesurer)_  | _(à mesurer)_  |
| **Temps total moyen (ms)**    | _(à mesurer)_  | _(à mesurer)_  | _(à mesurer)_  | _(à mesurer)_  |
| **Complexité implémentation** | Faible         | Moyenne        | Moyenne        | Élevée         |
| **Complexité côté client**    | Faible         | Moyenne        | Faible         | Moyenne        |
| **Scalabilité horizontale**   | _(à évaluer)_  | _(à évaluer)_  | _(à évaluer)_  | _(à évaluer)_  |
| **Charge réseau**             | _(à évaluer)_  | _(à évaluer)_  | _(à évaluer)_  | _(à évaluer)_  |
| **Direction données**         | Bidirectionnel | Bidirectionnel | Srv → Client   | Bidirectionnel |
| **État connexion**            | Stateless      | Stateless      | Persistante    | Persistante    |
| **Reconnexion automatique**   | N/A            | Via polling    | Oui (native)   | Non (manuel)   |
| **Support navigateur**        | Universel      | Universel      | Large (≥IE11)  | Large (≥IE10)  |
| **Gestion des erreurs**       | Simple         | Complexe       | Moyenne        | Complexe       |

---

## 2. Analyse Détaillée des Performances

### 2.1 REST Synchrone

| Métrique                    | Valeur mesurée | Notes |
|-----------------------------|:--------------:|-------|
| Temps avant premier token   | _(à mesurer)_  |       |
| Temps de réponse total      | _(à mesurer)_  |       |
| Nombre de requêtes HTTP     | 1              | Fixe  |

**Observations :**
> _(Vos notes ici)_

---

### 2.2 REST + Polling

| Métrique                    | Valeur mesurée | Notes |
|-----------------------------|:--------------:|-------|
| Délai avant première réponse| _(à mesurer)_  |       |
| Nombre de requêtes (polling)| _(à mesurer)_  | Variable selon durée d'inférence |
| Overhead réseau estimé      | _(à mesurer)_  | N × poids d'une réponse polling |

**Observations :**
> _(Vos notes ici)_

---

### 2.3 SSE (Server-Sent Events)

| Métrique                     | Valeur mesurée | Notes |
|------------------------------|:--------------:|-------|
| Latence avant premier token  | _(à mesurer)_  | TTFB  |
| Temps de réponse total       | _(à mesurer)_  |       |
| Fluidité perçue du streaming | _(à évaluer)_  | /5    |

**Observations :**
> _(Vos notes ici)_

---

### 2.4 WebSocket

| Métrique                         | Valeur mesurée | Notes |
|----------------------------------|:--------------:|-------|
| Temps d'établissement connexion  | _(à mesurer)_  | Handshake WS |
| Latence avant premier token      | _(à mesurer)_  |       |
| Temps de réponse total           | _(à mesurer)_  |       |

**Observations :**
> _(Vos notes ici)_

---

## 3. Complexité d'Implémentation

| Aspect                  | REST Sync    | Polling      | SSE          | WebSocket    |
|-------------------------|:------------:|:------------:|:------------:|:------------:|
| Lignes de code backend  | _(à compter)_| _(à compter)_| _(à compter)_| _(à compter)_|
| Lignes de code frontend | _(à compter)_| _(à compter)_| _(à compter)_| _(à compter)_|
| Tests unitaires         | Facile       | Moyen        | Difficile    | Difficile    |
| Debug                   | Facile       | Moyen        | Moyen        | Difficile    |
| Gestion des erreurs     | Simple       | Complexe     | Moyenne      | Complexe     |
| Infra requise           | Standard     | Standard     | Standard*    | Standard*    |

> *Nginx : configuration spécifique nécessaire (`proxy_buffering off` pour SSE, headers `Upgrade` pour WS).

---

## 4. Scalabilité

| Scénario                        | REST Sync    | Polling      | SSE          | WebSocket    |
|---------------------------------|:------------:|:------------:|:------------:|:------------:|
| 10 utilisateurs simultanés      | _(à tester)_ | _(à tester)_ | _(à tester)_ | _(à tester)_ |
| 100 utilisateurs simultanés     | _(à tester)_ | _(à tester)_ | _(à tester)_ | _(à tester)_ |
| Connexions persistantes serveur | Non          | Non          | Oui          | Oui          |
| Mémoire serveur par session     | Faible       | Faible       | Moyenne      | Élevée       |
| Compatible load balancer HTTP   | Oui          | Oui          | Oui*         | Non**        |

> *SSE avec sticky sessions recommandé.
> **WebSocket nécessite du sticky routing ou un broker (Redis Pub/Sub, etc.).

---

## 5. Recommandations par Cas d'Usage

### 5.1 FAQ E-commerce
> **Contexte :** Questions/réponses simples sur des produits (prix, disponibilité,
> caractéristiques). Réponses attendues courtes (< 100 mots). Volume élevé.

**Architecture recommandée :**
> _(Votre choix ici)_

**Justification :**
> _(Vos arguments ici)_

---

### 5.2 Assistant Bancaire
> **Contexte :** Conseils financiers personnalisés, vérification de solde, analyse de relevés.
> Requiert sécurité, conformité et fiabilité. Réponses moyennes à longues.

**Architecture recommandée :**
> _(Votre choix ici)_

**Justification :**
> _(Vos arguments ici)_

---

### 5.3 Support Technique Temps Réel
> **Contexte :** Chat de support avec IA + escalade vers agent humain.
> Nécessite réactivité, conversation multi-tours, historique de session.

**Architecture recommandée :**
> _(Votre choix ici)_

**Justification :**
> _(Vos arguments ici)_

---

### 5.4 Génération de Contenu Long
> **Contexte :** Rédaction d'articles, rapports détaillés, documentation.
> Réponses très longues (> 5 minutes d'inférence possibles).

**Architecture recommandée :**
> _(Votre choix ici)_

**Justification :**
> _(Vos arguments ici)_

---

### 5.5 Application Mobile (données limitées)
> **Contexte :** Utilisateurs mobiles avec connexion instable (3G/4G) et quota de données limité.
> Priorité : économie de bande passante et robustesse aux coupures.

**Architecture recommandée :**
> _(Votre choix ici)_

**Justification :**
> _(Vos arguments ici)_

---

## 6. Notes et Observations Libres

> _(Espace pour vos observations personnelles pendant les tests.
> Comportements inattendus, différences entre les modèles, etc.)_

---

## 7. Conclusion

> _(Votre synthèse finale : dans quels contextes chaque architecture brille-t-elle ?
> Quelle est votre recommandation "par défaut" pour un nouveau projet chatbot ?)_

---

*Document généré dans le cadre de l'Atelier 2 — Architectures Webservices Chatbot IA*
