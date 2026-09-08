SunniAI
Live at: sunniai.vercel.app

SunniAI is an AI assistant that browses the web, manages files, runs code, and executes tasks through natural language conversation. You tell it what to do, and it handles the rest.

Features
Web browsing – Navigates sites, extracts data, and scrapes content

File management – Upload, read, edit, and organize files

Search – Finds relevant information across the web

Code execution – Generates and runs Python scripts

API integration – Connects with external services

Shell commands – Executes terminal commands in a secure environment

Tech Stack
Frontend: [Next.js / React]

Hosting: Vercel

AI: [OpenAI GPT-4 / Claude / Gemini]

Backend: [FastAPI / Node.js]

Database: [Supabase / PostgreSQL]

Isolation: Docker

Run Locally
bash
git clone https://github.com/[your-username]/sunniai.git
cd sunniai
npm install
cp .env.example .env
# Add your API keys to .env
npm run dev
Open http://localhost:3000

Environment Variables
text
LLM_API_KEY=your_key_here
DATABASE_URL=your_database_url
NEXT_PUBLIC_API_URL=http://localhost:8000
Usage Examples
"Scrape the latest posts from this blog and save as CSV"

"Summarize this PDF"

"Find competitors for this product"

"Clean this dataset and remove duplicates"

Contributing
Fork the repository

Create a branch: git checkout -b feature/your-feature

Commit: git commit -m 'Add feature'

Push: git push origin feature/your-feature

Open a pull request

License
Apache 2.0. See LICENSE for details.

Contact
App: sunniai.vercel.app

Author: q04ti
