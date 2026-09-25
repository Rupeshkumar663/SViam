# Assignment repository

Read README.md before changing code; it is the complete candidate brief. AI assistance is allowed.
This GitHub take-home is separate from the Maya interview. Its three features are
speech-aligned highlighting, direct code editing, and code execution. An edit request
changes the editor directly; a suggestion-only or preview/Apply workflow is not the requirement.
Do not implement features outside the assignment or change the review criteria.
Do not add credentials, personal data, or production source to commits.

This version of Next.js has breaking changes. Read the relevant guide in
node_modules/next/dist/docs/ before writing Next.js code. Heed deprecations.

The mock agent is a deterministic transport fixture, not a language model.
Distinguish mock checks from a real microphone-to-provider voice test.
Run npm run check and npm run build before marking a PR ready for review.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
