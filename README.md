# 🩺 MedTranslate

Understand your medical reports in plain, simple words — in any language.

## Quick Setup

### 1. Add your Groq API key
Open `src/App.jsx` and find line 7:
```js
const GROQ_API_KEY = "gsk_your_groq_api_key_here";
```
Replace the placeholder with your real key from https://console.groq.com

### 2. Install and run
```bash
npm install
npm run dev
```
Open http://localhost:5173/medtranslate/

### 3. Deploy to GitHub Pages
```bash
npm run deploy
```
Then go to your repo → Settings → Pages → Source: gh-pages branch.

## Features
- 📑 Upload PDF or image reports
- 🌍 18 languages with live translation
- 🤖 AI chat — understands Tenglish & Hinglish
- ♿ High contrast mode, adjustable font size
- 🔒 Your data is never stored
