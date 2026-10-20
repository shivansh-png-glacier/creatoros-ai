# CreatorOS AI — Build 01

A code-first starter for an AI-powered creator workspace. This MVP includes:
- Bold, responsive dashboard UI
- Campaign generator inputs for topic, platform, audience, tone and goal
- Real OpenAI API integration through a server-side endpoint
- Demo generation when no API key is configured
- Browser-local campaign saving, search, edit caption, copy and TXT export

## Requirements

- Node.js 20 or newer (Node 24 should work)
- npm
- Optional: an OpenAI API key and API billing/credits for real AI generation

## Run locally

1. Extract this folder.
2. Open it in VS Code.
3. Open the integrated terminal in the project folder.
4. Install dependencies:

   ```bash
   npm install
   ```

5. Create your environment file by copying `.env.example` to `.env`.
6. For actual AI, put your own API key in `.env`:

   ```env
   OPENAI_API_KEY=your_real_key_here
   OPENAI_MODEL=gpt-4o-mini
   PORT=8787
   ```

   Keep `.env` private. Do not commit it to Git or put the key in frontend code. If you don't add a key, the app still works in clearly labeled demo mode.

7. Start the frontend and backend:

   ```bash
   npm run dev
   ```

8. Open the Vite URL shown in your terminal, normally `http://localhost:5173`.

Health check: open `http://localhost:8787/api/health` to see whether real AI is configured.

## What is real vs. not yet built

**Working now:** campaign form, API endpoint, AI response parsing, demo fallback, campaign cards, local browser persistence, search, caption editing, clipboard actions, TXT export and responsive navigation.

**Not yet built:** user accounts, cloud sync, collaborative workspaces, image generation, publishing to social networks, payment processing, analytics from real platform APIs, production rate limiting and abuse protection.

Browser-local storage means campaigns live in the current browser/device only. It is not a cloud database or a production multi-user service.

## Project map

- `src/main.jsx` — React app, state, forms and campaign views
- `src/styles.css` — design system and responsive layouts
- `server/index.js` — API endpoint and server-side OpenAI integration
- `vite.config.js` — local API proxy
- `.env.example` — environment variable template

## Learning path

1. Run the app in demo mode and explore every control.
2. Read `Studio` in `src/main.jsx` and trace how the form state is passed to `generate()`.
3. Read `/api/generate` in `server/index.js` to understand input validation and AI calls.
4. Add your API key privately and test a few topics.
5. Improve output quality based on real creator feedback before adding more features.

## Portfolio case-study advice

Do not claim user growth or business results until measured. Document the problem, your assumptions, 3–5 user interviews, the first prototype, feedback, iteration and the technical tradeoffs. A working demo is a starting point, not proof of product-market fit.
