<div align="center">
  <h1>🩺 MedTranslate AI</h1>
  <p>
    <strong>Translating complex clinical jargon into plain, accessible English.</strong>
  </p>
  <p>
    <a href="https://medtranslateai.vercel.app"><b>Live Demo</b></a> •
    <a href="#-getting-started"><b>Getting Started</b></a> •
    <a href="#-tech-stack"><b>Tech Stack</b></a>
  </p>
</div>

<br />

**MedTranslate AI** is a fast, responsive web application designed to bridge the gap between complex medical reports and patient comprehension. By leveraging high-speed LLM inference, it empowers users to independently understand their health data by transforming dense, clinical terminology into clear, everyday language.

---

## ✨ Key Features

- ⚡ **Instant Translation:** Parses medical reports (PDF/Image) and translates them into simple, easy-to-understand explanations instantly.
- 🔒 **Privacy-Conscious:** Implements client-side extraction where possible to minimize sensitive data transfer.
- 🚀 **Lightning Fast Inference:** Powered by the **Groq API** to deliver near-instantaneous AI processing without the typical LLM wait times.
- 📱 **Responsive UI/UX:** A clean, minimal, and fully responsive interface optimized for all devices.

## 🛠️ Tech Stack

| Category | Technology |
| --- | --- |
| **Frontend** | React 18, Vite |
| **Document Parsing** | PDF.js (Client-side) |
| **AI / LLM** | Groq API |
| **Deployment** | Vercel |

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- A [Groq API Key](https://console.groq.com/keys)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Techie03/medtranslate.git
   cd medtranslate
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your Groq API key:
   ```env
   VITE_GROQ_API_KEY=your_api_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## 🏗️ Technical Decisions & Architecture

- **Vite Setup:** Chosen over CRA to ensure drastically faster Hot Module Replacement (HMR) and optimized, lightweight production builds.
- **Groq API Integration:** Selected over standard OpenAI endpoints to minimize latency. This architectural choice guarantees real-time translations, enhancing the UX for anxious patients seeking immediate answers.
- **Vercel CI/CD:** Utilized for seamless automated deployments, global edge caching, and secure management of environment variables.

---

<div align="center">
  <i>Designed and built to make healthcare information accessible to everyone.</i>
</div>
