# CreatorOS AI

**One idea into a complete, ready-to-publish campaign — hooks, captions, CTA, and AI-generated thumbnails — in seconds.**

CreatorOS AI is a creator workspace for turning a single content idea into a structured campaign. Type an idea, choose the platform, audience and goal, and it generates a campaign you can review, edit and export as a PDF brief.

> **Demo video:** paste the link to the edited 2:08 demo cut here (unlisted YouTube / Drive) before submitting. The edited cut was made from your original 4:40 recording — overlays added, slow typing and thumbnail editing fast-forwarded.
> **Live demo:** paste the deployed PR #3 link here — use the production link, not a Vercel preview link.

![CreatorOS AI demo with overlay](screenshots/00-demo-overlay.png)

![CreatorOS AI home](screenshots/01-home.png)

## What it does

From one idea, CreatorOS AI generates:

- **Campaign snapshot** — title, platform, target audience, campaign goal and tone
- **3 hooks that stop the scroll**
- **Caption / post copy** — a full, structured caption, not just a one-liner
- **Content ideas / angles** to build the campaign around
- **A clear CTA**
- **A thumbnail** — generated image with editable headline text overlaid in the app
- **A PDF brief** — export the whole campaign to share or use offline

### Example from the demo

Input: **“Study Smarter, Not Harder”** — YouTube, for Students, goal: Build personal brand.

Output: **“Study Smarter, Not Harder: A Practical System for Busy Students”**, with hooks, a detailed caption built around a retrieve–space–apply study loop, content ideas, a CTA, and a thumbnail headed **“Stop Rereading. Start Remembering.”**

## How it works

1. **Idea Studio** — enter your content idea and set the platform, audience and goal.
2. **Generate** — the app creates the full campaign in one pass.
3. **Review** — read the hooks, caption, content ideas and CTA, and open any saved campaign from **My Campaigns**.
4. **Thumbnail** — generate a thumbnail image, then tune it in the app: image prompt, headline text, text colour, background overlay, font style, font size, alignment and weight.
5. **Export** — download the campaign as a **PDF brief**.

![Idea Studio](screenshots/02-idea-studio.png)

![Generated campaign](screenshots/03-campaign.png)

![Thumbnail editor](screenshots/04-thumbnail.png)

![PDF brief](screenshots/05-pdf-brief.png)

## Built during the hackathon

Built solo during the **Meta Global AI Developer Hackathon, 26 October – 4 November 2026**.

Work built during the event:

- Migration of campaign generation to Meta's **Muse Spark** model family
- Thumbnail image generation, with headline text overlaid in the app's own UI (not baked into the image)
- Thumbnail editing controls and PDF brief export for the generated campaign

## Tech stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express (`server/index.js`)
- **UI:** Custom CSS design system, Lucide icons
- **Images:** Sharp is included as a dependency for image handling

## Run locally

### Requirements

- Node.js 20 or newer
- npm
- An API key for real AI generation (see `.env.example`)

### Steps

```bash
npm install
```

Copy the environment template and add your own key — never commit `.env`:

```bash
cp .env.example .env
```

Start the frontend and backend together:

```bash
npm run dev
```

- Frontend: the Vite URL shown in your terminal (normally `http://localhost:5173`)
- Backend health check: `http://localhost:8787/api/health`

If no API key is configured, the app runs in a clearly labelled demo mode.

## Project map

```
src/main.jsx       # React app, state, forms and campaign views
src/styles.css     # Design system and responsive layouts
src/lib/           # Shared helpers
server/index.js    # API endpoints and server-side AI integration
vite.config.js     # Vite config and local API proxy
.env.example       # Environment variable template (no real keys)
```

## What is not yet built

- User accounts and cloud sync — campaigns are saved in the browser / current workspace
- Publishing directly to social networks
- Analytics from real platform APIs
- Production rate limiting and abuse protection

A working demo is a starting point, not proof of product-market fit. Do not claim user growth or business results until measured.

## Contributing

This is a solo hackathon project. Issues and suggestions are welcome, but there is no contribution process or release schedule yet.
