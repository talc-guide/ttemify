<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TALC World Assistant

An internal WPM reporting workspace for turning merged three-month notes into concise drafts across the Mind, Skills, and Demeanour domains.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and add your Gemini API key:
   `GEMINI_API_KEY=your_key_here`
3. Run the app:
   `npm run dev`

Local development calls Gemini directly from `http://localhost:3000`. For a Netlify deployment, set `GEMINI_API_KEY` in Netlify environment variables; the deployed app calls the secure Netlify Function instead. Review each draft before adding it to the WPM report.
