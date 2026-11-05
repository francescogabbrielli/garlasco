# Workflow delle ipotesi e pipeline di valutazione

Questo documento descrive un workflow **curato** per **Event**, **Hypothesis** e
i rispettivi collegamenti di evidenza (**HypothesisEvent** e **HypothesisObject**),
dove **solo l'Admin può pubblicare**.

La valutazione di una Hypothesis produce **giudizi separati per ogni giudice**
(es. `bot-1`, `bayes-1`). Non esiste (per ora) un singolo numero “universale”
che vince sugli altri.


## Workflow end-to-end (ruoli, approvazione, valutazione)

```mermaid
flowchart TD
  %% Attori
  Viewer([Member])
  Editor([Editor])
  Detective([Detective])
  Admin([Admin])

  %% Modelli
  Event[[Event]]
  Object[[Object]]
  Hypothesis[[Hypothesis]]
  HEv[[HypothesisEvent]]
  HObj[[HypothesisObject]]

  %% Valutazione
  Judge["judgeHypothesis query"]
  Judgement[[HypothesisJudgement]]
  View[[Vista giudizi per giudice]]

  %% Flusso
  Viewer -->|crea bozza| Event
  Editor -->|crea bozza| Event
  Editor -->|crea bozza| Object
  Detective -->|crea bozza| Hypothesis
  Detective -->|propone link| HEv
  Detective -->|propone link| HObj

  Event -->|invia| Admin
  Object -->|invia| Admin
  Hypothesis -->|invia| Admin
  HEv -->|invia| Admin
  HObj -->|invia| Admin

  Admin -->|approva/pubblica| Event
  Admin -->|approva/pubblica| Object
  Admin -->|approva/pubblica| Hypothesis
  Admin -->|approva/pubblica| HEv
  Admin -->|approva/pubblica| HObj

  Event -->|input approvato| Judge
  Object -->|input approvato| Judge
  Hypothesis -->|input approvato| Judge
  HEv -->|link approvati| Judge
  HObj -->|link approvati| Judge

  Judge -->|upsert per hypothesisId, judgeId| Judgement
  Judgement -->|mostra elenco| View
  View -->|mostra| Viewer

  classDef actor fill:#E8F0FE,stroke:#4A72B2,stroke-width:1px;
  class Viewer,Editor,Detective,Admin actor;
```

\* `judgeHypothesis` è mostrata come query (stateless). In pratica puoi anche
aggiungere una mutation tipo `applyJudgement` per persistere uno snapshot
"ufficiale", ma l'idea chiave è: **i bot non pubblicano; pubblica l'Admin**.

## Macchina a stati di approvazione

### Hypothesis

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Submitted: invia
  Submitted --> Approved: approva (Admin)
  Submitted --> Rejected: rifiuta (Admin)
  Approved --> Published: pubblica (Admin)
  Rejected --> Draft: revisione
  Published --> Draft: ripristina (Admin)
```

## Bozza modello dati (ER concettuale)

Questa è una vista concettuale delle entità e delle loro relazioni. Non impone
una specifica forma di schema Amplify (puoi comunque denormalizzare campi sui
modelli di join per ridurre le letture).

```mermaid
erDiagram
  USER ||--o{ EVENT : crea
  USER ||--o{ OBJECT : crea
  USER ||--o{ HYPOTHESIS : crea

  HYPOTHESIS ||--o{ HYPOTHESIS_EVENT : collega
  HYPOTHESIS ||--o{ HYPOTHESIS_OBJECT : collega

  EVENT ||--o{ HYPOTHESIS_EVENT : referenzia
  OBJECT ||--o{ HYPOTHESIS_OBJECT : referenzia

  HYPOTHESIS ||--o{ HYPOTHESIS_JUDGEMENT : giudizi

  USER {
    string id
    string role
  }
  EVENT {
    string id
    string workflowStatus
    int reliability
    int relevance
  }
  OBJECT {
    string id
    string workflowStatus
    int reliability
  }
  HYPOTHESIS {
    string id
    string workflowStatus
  }
  HYPOTHESIS_EVENT {
    string id
    string workflowStatus
    string hypothesisId
    string eventId
    string polarity
    int relevanceToHypothesis
    int matchStrength
    int reliabilityUsed
  }
  HYPOTHESIS_OBJECT {
    string id
    string workflowStatus
    string hypothesisId
    string objectId
    string polarity
    int relevanceToHypothesis
    int matchStrength
    int reliabilityUsed
  }
  HYPOTHESIS_JUDGEMENT {
    string hypothesisId
    string judgeId
    string inputHash
    int probability
    int confidence
    string summary
    string modelVersion
    string updatedAt
  }
```

## Processo di valutazione (judging, aggiornamento giudizi per giudice)

Questo diagramma mostra come una ipotesi approvata viene valutata usando link
`HypothesisEvent` / `HypothesisObject` approvati, con uno o più judge.

```mermaid
sequenceDiagram
  autonumber
  actor Admin
  participant UI as Admin UI
  participant API as Amplify Data API
  participant H as Hypothesis
  participant HE as HypothesisEvent
  participant HO as HypothesisObject
  participant E as Event
  participant O as Object
  participant J as judgeHypothesisEnsemble
  participant B1 as JudgeBot A
  participant B2 as JudgeBot B
  participant JUD as HypothesisJudgement

  Admin->>UI: Clicca "Valuta ipotesi"
  UI->>API: evaluateHypothesis(hypothesisId)

  %% Gate: solo ipotesi approvate vengono valutate per la pubblicazione
  API->>H: Carica Hypothesis (deve essere Approved)
  H-->>API: Hypothesis

  %% Recupera i link di evidenza approvati
  API->>HE: List HypothesisEvent dove hypothesisId
  API->>HO: List HypothesisObject dove hypothesisId
  HE-->>API: link Event approvati (polarity, relevanceToHypothesis, matchStrength, reliabilityUsed)
  HO-->>API: link Object approvati (polarity, relevanceToHypothesis, matchStrength, reliabilityUsed)

  %% Recupera le evidenze referenziate (campi denormalizzati possono ridurre le letture)
  API->>E: Batch get Event referenziati da HypothesisEvent
  API->>O: Batch get Object referenziati da HypothesisObject
  E-->>API: Event
  O-->>API: Object

  %% Esegue più giudici (ensemble opzionale)
  API->>J: judge( Hypothesis + link + evidenze )
  par Judge run A
    J->>B1: assess()
    B1-->>J: {p, confidence, evidenceRefs, missingInfo}
  and Judge run B
    J->>B2: assess()
    B2-->>J: {p, confidence, evidenceRefs, missingInfo}
  end

  %% Persistenza: 1 record per (hypothesisId, judgeId)
  J->>JUD: upsert(hypothesisId, judgeId, {p, confidence, summary, inputHash})
  JUD-->>J: ok

  %% Ritorna la lista dei giudizi (uno per giudice)
  API-->>UI: Mostra elenco giudizi per giudice

  Note over UI,Admin: Admin può accettare/pubblicare o richiedere modifiche
```

### Gestione del disaccordo (consigliata)

```mermaid
graph TD
  A[Inizio valutazione] --> B[Esegui due o più giudici]
  B --> C[Salva/aggiorna 1 giudizio per giudice]
  C --> D[Confronta giudizi e calcola disagreement]
  D --> E{Disagreement alto?}
  E -->|No| F[Mostra elenco giudizi coerenti]
  E -->|Sì| G[Mostra conflitti e richiedi revisione]
  G --> H[Opzionale: aggiungi un nuovo giudice]
  H --> B
```

