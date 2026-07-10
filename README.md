# Marginalia: Verified Academic Curation and Synthesis Workspace

Marginalia is an academic-grade curation, media synthesis, and visual concept-mapping workspace. Built for researchers, educators, and lifelong learners, it transforms dense educational video lectures, podcasts, and written resources into structured study guides, structured outlines, and interactive Leitner-system spaced repetition flashcards.

---

## 1. Core Architecture and Philosophy

Marginalia is engineered to serve as a private, high-fidelity laboratory. It leverages a modern full-stack single-page application (SPA) architecture combined with secure browser-side storage and optional third-party integrations:

*   **Zero-Telemetry Privacy**: Your data belongs to you. All configuration parameters, custom API credentials, and saved media curations are isolated strictly inside your browser's local cache. No central metrics, logs, or user-authored contents are sent to external developer servers.
*   **Bring Your Own Key (BYOK)**: To maintain permanent individual control over operational thresholds, users can configure their direct Google Gemini API keys or OpenRouter endpoints.
*   **Local Storage Encryption**: An option to securely mask local storage payloads, protecting sensitive API keys and curated academic material from other users of the same hardware device.
*   **Granular Integration Framework**: Rather than relying on simulated cloud databases, Marginalia establishes true OAuth handshakes to synchronize study records with Google Keep, Google Tasks, and Google Docs.

---

## 2. Key Modules and Capabilities

### 2.1 Video Curation & High-Fidelity Synthesis
Marginalia processes standard YouTube URLs, academic video links, and audio materials through advanced prompt chaining with the Google Gemini model series. The platform extracts:
*   **Concise Intent Analysis**: Strips clickbait titles and promotional narratives to yield clear, academic-grade conceptual titles.
*   **Structured Study Outlines**: Chronologically sequenced core themes accompanied by detailed annotations.
*   **Definitions & Glossary**: Rapid visual lookups of domain-specific terminology.
*   **Dynamic Assessments**: Generates adaptive quiz questions to test comprehension.

### 2.2 Topic Discovery Graph
An interactive, browser-optimized visualization map showing related concepts, knowledge dependencies, and thematic clusters. It allows learners to see the big picture and browse materials by clicking semantic connections.

### 2.3 Leitner Spaced Repetition Engine
An integrated Leitner system that organizes generated flashcards and review tasks into five progression boxes:
*   **Active Review Pools**: Newly added or missed cards start in Box 1.
*   **Adaptive Intervals**: Successful recalls advance cards through the boxes, extending the review window.
*   **Manual Override**: Reset or advance boxes manually to tailor study routines.

### 2.4 Google Workspace OAuth Synchronizer
*   **Google Keep**: Import and map existing scratchpads into video curations or export generated glossaries.
*   **Google Tasks**: Push generated quiz questions and reading schedules directly to your active Google Tasks list.
*   **Google Docs**: Export styled, high-fidelity Study Packets to your Google Drive for offline review, printing, or collaborative editing.

---

## 3. Generative AI Token & Cost Auditor

To support the BYOK operational model, Marginalia includes an advanced client-side telemetry auditor. It estimates character volume, calculates operational costs, and manages strict context safety thresholds:

*   **Real-time Payload Auditing**: Scans prompt configurations and API responses on every inference operation.
*   **Character-to-Token Calibration**: Uses a standard calibration ratio (~4 characters per token in standard English text) to estimate prompt and completion tokens.
*   **Multi-Model Micro-Billing**: Calculates active dollar liabilities based on real-time API pricing rates:
    *   **Gemini 2.5 Flash**: Prompt ($0.075 / 1M tokens), Response ($0.30 / 1M tokens)
    *   **Gemini 2.5 Pro**: Prompt ($1.25 / 1M tokens), Response ($5.00 / 1M tokens)
    *   **OpenRouter Blended fallback**: A standardized average of $0.50 per 1M blended tokens
*   **Custom Warning Safety Threshold**: Allows users to set a character limit (defaulting to 100,000 characters). When exceeded, the system displays an ambient, non-blocking notice on analysis pages warning the user to monitor API usage and key quotas.
*   **Persistent Operation Logs**: Maintains an audit trail of the past 200 operations displaying timestamps, action types, models, total character count, token totals, and exact micro-cents costs.

---

## 4. Secure Environment & CSP Configuration

Marginalia operates with a secure Content Security Policy (CSP) injected directly into the document head to prevent cross-site scripting (XSS) and unauthorized resource tracking. Only verified endpoints are permitted:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  connect-src 'self' https://accounts.google.com https://www.googleapis.com https://tasks.googleapis.com https://generativelanguage.googleapis.com https://openrouter.ai;
  img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://lh3.googleusercontent.com https://*.googleusercontent.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  frame-src 'self' https://accounts.google.com;
" />
```

---

## 5. Development and Installation

### Prerequisites
*   Node.js (v18.0.0 or higher)
*   npm or yarn

### Installation Steps

1.  Clone the repository:
    ```bash
    git clone <repository_url>
    cd marginalia
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure your environment variables:
    Create a `.env` file based on `.env.example`:
    ```bash
    cp .env.example .env
    ```

4.  Launch the local development server:
    ```bash
    npm run dev
    ```
    The server will boot on `http://localhost:3000`.

5.  Compile for production deployment:
    ```bash
    npm run build
    ```
    The static bundle will be built in the `/dist` directory.

---

## 6. Project Architecture

The workspace directory structure is modular and organized:

```text
/
├── .env.example             # Template for local environment variables
├── index.html               # SPA Entry point containing the CSP security policy
├── metadata.json            # App capabilities and permissions declaration
├── package.json             # Build commands and dependency catalog
├── src/
│   ├── App.tsx              # Primary application shell, layout, and OAuth controller
│   ├── main.tsx             # DOM mounting entry point
│   ├── types.ts             # Static type parameters and data structures
│   ├── index.css            # Tailind utility configurations and display font pairing
│   ├── components/          # Modular view components
│   │   ├── VideoForm.tsx        # Video submit controls & token threshold indicator
│   │   ├── VideoCard.tsx        # Grid display card for processed academic materials
│   │   ├── VideoDetailModal.tsx # Full-screen tabbed dashboard for outlines, quizzes, and glossary
│   │   ├── TopicDiscoveryGraph. # Graphic conceptual mapping workspace
│   │   ├── LeitnerStudyPanel.ts # Spaced repetition active-box review board
│   │   ├── KeepPanel.tsx        # Side-by-side Google Keep notebook controller
│   │   ├── TasksPanel.tsx       # Live status synchronizer for Google Tasks
│   │   ├── SettingsModal.tsx    # Password protection, local storage encryption, and Token Auditor
│   │   └── GuidedTour.tsx       # Onboarding roadmap
│   └── lib/                 # Core logic libraries
│       ├── auth.ts              # Google API, G-Tasks, G-Keep and G-Docs OAuth controllers
│       ├── gemini.ts            # Client and Server API gateway for LLM synthesis
│       ├── presets.ts           # Demo fallback datasets for cold-starts
│       └── tokenTracker.ts      # State controller, log store, and cost calculator for the auditor
```
