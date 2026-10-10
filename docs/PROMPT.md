# Handover: how to use this kit with another AI account

1. Copy the whole `metro-kit` folder into a NEW empty project folder at the start of the event, then `git init` and commit. The real repo should show the work done on the night.
2. Use an AI tool that can read your files (Claude Code, Cursor, Copilot agent, etc.). Do not paste the JSON into a chat window: the data is about 2 MB.
   If you only have a chat window, upload just these: `PROJECT_CONTEXT.md`, `docs/TRACKS.md`, `lib/metro.js`, `data/stations.json`, and then others only when needed.
3. Paste the prompt below as the first message and fill in the brackets.

---
You are my pair-programmer in a 2-hour solo hackathon (Metro Hacks) on a moving train, partly without network.
Read these files first: PROJECT_CONTEXT.md, docs/TRACKS.md, lib/metro.js (the helper API) and data/stations.json.

Challenge text (verbatim): [PASTE]
Track: [Operations | Public Transport | unsure]. Primary user: [WHO]. The ONE flow: [ONE SENTENCE].

Rules:
- Fully offline. No CDN, no runtime API calls, no external fonts or map tiles. Plain HTML/CSS/JS plus a service worker, no build step unless I say so.
- Use lib/metro.js and the files in /data. Do not invent data. Anything estimated or sample must be labelled in the UI.
- First reply: a 5-line plan, no code. Then build in small vertical slices; after each slice tell me how to test it in airplane mode.
- Mobile-first, big tap targets, readable in a moving train.
- Stop adding features 30 minutes before the end; then write the README (what works, real vs sample data, how to run), a demo script, and the one-line pitch.
---

Useful prompts later:
- "Add a service worker that precaches index.html, app.js, style.css, lib/ and the data files I use, and show an Offline-ready badge."
- "Write a 60-second demo script for judges that works in airplane mode."
- "Review the app against the checklist in docs/TRACKS.md and list what is missing."
