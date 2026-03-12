
# Glimpse

https://github.com/user-attachments/assets/acc58c49-73b9-46df-ac16-685a47b79586

Every second, millions of dollars of purchase intent just disappears... Let’s be real, how many times have you scrolled on Instagram, seen a cool jacket, but just scrolled past it because you weren’t bothered to leave the app? Glimpse solves this by building the proper infrastructure to go from 📱 scrolling -> 🛍️ shopping 

## 👀 How it works:
- Glimpse tracks your eye movements while your scrolling
- If you look at a product for 2+ seconds, Glimpse captures an image of the frame and sends it to backend
- Image is normalized by Cloudinary and sent to Gemini + SerpApi to identify product and retrieve relevant purchase links
- Links sent to frontend so users can shop directly in Instagram Reels 

🧠 Glimpse is also able to learn your preferences through Backboard.io. Each time a user likes a product, Backboard records attributes such as color, style, and brand. Over time, this data allows Glimpse to generate personalized product recommendations based on the user’s evolving tastes.

## Tech Stack

- **Backend**: Node.js, TypeScript, Fastify, Gemini AI, SerpApi, Cloudinary, Zod
- **Frontend Extension**: TypeScript, JavaScript, Firefox WebExtension APIs
- **Panel App**: React, Vite, Tailwind CSS, Framer Motion

---

## Getting Started

### Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm
- Firefox (for extension loading via `about:debugging`)

---

## 1. Backend Setup

Clone this repository and set up the backend:

```bash
cd itrack-backend
npm install
cp .env.example .env
# Edit .env and fill in required API keys (Gemini, Backboard, SerpApi, Cloudinary)
npm run dev
```

Check the backend is running:

```bash
curl http://127.0.0.1:8000/health
```

---

## 2. Extension Setup

Build the extension:

```bash
cd itrack-extension
npm install
npm run build
```

Load the extension in Firefox:
1. Open `about:debugging` in Firefox.
2. Click "This Firefox" > "Load Temporary Add-on..."
3. Select the `manifest.json` file in the `itrack-extension` folder.

---

## 3. Panel App (Optional: Dev Mode)

To develop the panel UI separately:

```bash
cd itrack-extension/panel-app
npm install
npm run dev
```

---

## Usage

- Browse Instagram with the extension loaded.
- When you dwell on a product, the extension captures a screenshot and sends it to the backend.
- The panel displays real-time recommendations based on your gaze and profile.

---

## Troubleshooting

- Ensure all required API keys are set in `.env` for the backend.
- The backend must be running before using the extension.
- For live product sourcing, set `PRODUCT_SOURCING_MODE=serpapi` in your `.env`.

---

## License

MIT
