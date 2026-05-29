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

## 4. Flujo de financiación

Cómo trabaja un pedido de financiación de principio a fin: 3 plazos auto-generados (cálculo de IVA según CP de envío), gestión de cobros desde la ficha del pedido, notificación a Slack en cada plazo marcado como pagado.

```mermaid
flowchart TB
    A([Comercial crea pedido]) -->|"purchase_type =<br/>hardware_financiacion"| B{Wizard step 3}
    B -->|"Selecciona pack:<br/>Pack Pro · Pack Premium · KDS Estándar"| C[App genera plan<br/>3 plazos calculados<br/>con IVA según CP envío<br/>Canarias 0% / Resto 21%]
    C --> D[(3 filas creadas en<br/>order_payments:<br/>Entrada · 2º plazo · 3º plazo<br/>status=pendiente)]

    D --> E{Hardware recibe<br/>justificante bancario}
    E -->|1ª transferencia| F[Marca plazo 1 = pagado<br/>+ URL justificante]
    F -. Slack notify .-> S(((Canal<br/>#hardware)))
    F --> G[Hardware genera<br/>envío TIPSA]
    G --> H([ENVIADO])

    H --> I{Hardware recibe<br/>2ª transferencia}
    I -->|justificante 2| J[Marca plazo 2 = pagado]
    J -. Slack notify .-> S

    J --> K{Hardware recibe<br/>3ª transferencia}
    K -->|justificante 3| L[Marca plazo 3 = pagado]
    L -. Slack notify .-> S
    L --> M([COMPLETADO])

    style C fill:#e0e7ff,stroke:#6366f1
    style D fill:#dbeafe,stroke:#3b82f6
    style F fill:#dcfce7,stroke:#10b981
    style J fill:#dcfce7,stroke:#10b981
    style L fill:#dcfce7,stroke:#10b981
    style H fill:#e0f2fe,stroke:#0ea5e9
    style M fill:#bbf7d0,stroke:#16a34a
    style S fill:#f3e8ff,stroke:#8b5cf6
```

---

## 5. El pain con Google Sheets

Concentra los problemas operativos que teníamos cuando toda la gestión (especialmente financiaciones) vivía en una hoja de Sheets compartida. Es el diagrama que mejor justifica el "porqué" del proyecto frente a un stakeholder no técnico.

```mermaid
flowchart TB
    HOJA["📊 Hoja 'Pedidos Financiación'<br/>una única Google Sheet<br/>compartida"]

    HOJA --> P1["💸 IVA Canarias calculado a mano<br/>0% vs 21% por CP<br/>→ errores fiscales recurrentes"]
    HOJA --> P2["⏰ Plazos sin alertas de vencimiento<br/>→ cobros olvidados<br/>→ impacto en cash flow"]
    HOJA --> P3["👀 Estado del cobro invisible<br/>para Comercial<br/>→ '¿cómo va mi pedido?'<br/>preguntas constantes"]
    HOJA --> P4["📂 Justificantes en carpeta Drive aparte<br/>links pegados a mano en celdas<br/>→ enlaces rotos, problemas auditoría"]
    HOJA --> P5["⚠️ 2 personas editando a la vez<br/>→ sobreescrituras<br/>→ datos perdidos"]
    HOJA --> P6["📜 Sin historial de cambios<br/>¿quién marcó este pago?<br/>¿cuándo? ¿por qué?"]
    HOJA --> P7["📈 Sin métricas agregadas<br/>(cobrado vs pendiente,<br/>plazos vencidos)<br/>→ decisiones a ciegas"]

    style HOJA fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#78350f
    style P1 fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    style P2 fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    style P3 fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    style P4 fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    style P5 fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    style P6 fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    style P7 fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
```

---

## Versionado

Cualquier cambio relevante en flujos, estados o piezas de la arquitectura debería reflejarse en este archivo en el mismo PR. Si el cambio es solo cosmético (colores en Excalidraw), no hace falta — basta con actualizar el `.excalidraw` exportado si lo guardáis aparte.
