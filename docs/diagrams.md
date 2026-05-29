# Diagramas de MainOperation

Este archivo contiene los diagramas Mermaid de la app, versionados en git para que se actualicen junto al código. GitHub los renderiza automáticamente al abrir este archivo en la web.

Para iterar visualmente:
1. Abre <https://excalidraw.com>
2. Menú **Insert → Mermaid to Excalidraw**
3. Pega el bloque correspondiente
4. Ajusta colores/posiciones a gusto, **Save to file** → `.excalidraw`

---

## 1. Antes vs. Ahora

Cómo era la operativa de pedidos de Hardware antes de la app, y cómo es ahora.

```mermaid
flowchart LR
    subgraph ANTES["❌ ANTES — operativa dispersa"]
        direction LR
        C1[Comercial]
        C1 --> GS[Google Sheets]
        C1 --> TF[Typeform]
        C1 --> EM[Email]
        C1 --> SL[Slack DM]
        GS --> HW1[Hardware]
        TF --> HW1
        EM --> HW1
        SL --> HW1
        PA["Pedidos perdidos<br/>Datos duplicados<br/>Sin estado claro<br/>Sin SLA"]
    end

    subgraph AHORA["✅ AHORA — una sola app"]
        direction LR
        C2[Comercial] --> MO[MainOperation]
        MO --> HW2[Hardware]
        PB["Única fuente de verdad<br/>Estado en tiempo real<br/>SLA por tipo<br/>Trazabilidad completa<br/>Avisos automáticos a Slack"]
    end

    ANTES -.->|transformación| AHORA
```

---

## 2. Ciclo de vida de un pedido

Estados que atraviesa un pedido desde su creación hasta la entrega, con las ramas excepcionales (falta info, bloqueado) y los puntos donde se dispara aviso a Slack.

```mermaid
flowchart LR
    A[Comercial<br/>crea pedido] --> B{Wizard 3 pasos:<br/>cliente · referencias · carrito}
    B --> C([NUEVO])
    C --> D[Hardware revisa]
    D --> E([PENDIENTE])
    E --> F[Hardware genera<br/>envío TIPSA]
    F --> G([ENVIADO])
    G --> H[Cliente recibe]
    H --> I([COMPLETADO])

    C -.-> J([FALTA<br/>INFORMACIÓN])
    E -.-> J
    J -.->|Comercial completa| C

    C -.-> K([BLOQUEADO])
    E -.-> K

    C -. Slack .-> S(((Canal<br/>Hardware)))
    E -. Slack .-> S
    G -. Slack .-> S
    I -. Slack .-> S
    J -. Slack .-> S

    style C fill:#dbeafe,stroke:#3b82f6
    style E fill:#fef3c7,stroke:#f59e0b
    style G fill:#e0f2fe,stroke:#0ea5e9
    style I fill:#dcfce7,stroke:#10b981
    style J fill:#fed7aa,stroke:#ea580c
    style K fill:#fecaca,stroke:#dc2626
    style S fill:#f3e8ff,stroke:#8b5cf6
```

---

## 3. Arquitectura técnica

Piezas que componen el sistema y cómo se comunican.

```mermaid
flowchart TB
    U([Usuario<br/>Comercial · Hardware · Manager · Admin])
    U -->|Google Workspace SSO| V[Next.js en Vercel<br/>App + Server Components + API routes]

    V -->|Datos + Auth + Storage| SP[(Supabase principal<br/>orders · order_items · order_payments<br/>user_profiles · status_history)]
    V -->|RPC service_role| SI[(Supabase inventario<br/>hw_staging.hw_inventory<br/>hw_staging.hw_articles)]
    V -->|SOAP WS| T[TIPSA<br/>etiquetas + tracking]
    V -->|Incoming Webhook| S[Slack<br/>#hardware]
    V -.->|Link salida| HS[HubSpot deals]

    TF[Typeform<br/>captación de leads] -->|Webhook entrante| V
```

---

## Versionado

Cualquier cambio relevante en flujos, estados o piezas de la arquitectura debería reflejarse en este archivo en el mismo PR. Si el cambio es solo cosmético (colores en Excalidraw), no hace falta — basta con actualizar el `.excalidraw` exportado si lo guardáis aparte.
