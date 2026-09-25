# Make the coding assistant interactive

Hi there,

Thank you for completing your interview with Maya. We'd like to invite you to
the next step in our hiring process: a practical coding assignment.
This GitHub take-home is separate from the Maya interview. You will extend the
AI agent in this starter codebase; you are not changing the Maya interview.

**Already provided:** a TypeScript editor, voice connection, and an agent that can
read the code and discuss it. **You build:** the three actions below.
Everything you build runs on your laptop. No deployment, app authentication, database, or LiveKit Cloud account is required.

[Local setup](#run-the-starter) · [API keys](#add-api-access) · [Submission](#submit)

## What you need to build

| You build | Example user request | What should happen |
| --- | --- | --- |
| **Highlight while speaking** | “Explain these loops.” | Highlight the actual code being discussed while the related explanation is spoken. Move the highlight as the explanation moves. Resolve lines from the current code, including after edits. |
| **Edit code directly** | “Replace these two loops with a different implementation.” | The agent removes and replaces the relevant block in the editor, then explains the confirmed change. Support inserting, deleting, and replacing code, including whole blocks or functions. |
| **Run and explain** | “Run the updated code.” | Execute the current code and show running, success, errors, timeouts, and output. The agent discusses the actual result for that version. |

The user's spoken or typed edit request should change the editor directly. A chat
snippet or suggested diff alone is not enough; a separate preview/Apply step is
not required. All three actions must work through a real voice conversation.

**Keep the conversation and editor in sync.** If the user types while the agent
responds, an old highlight or edit must not target unrelated new code. Refresh or
resolve changed targets before acting; do not overwrite newer work with a stale
replacement. After an edit, use the updated code for the next explanation and run.
The agent must wait for action results before claiming an edit or run succeeded.

Handle late or duplicate actions, overlapping runs, speech interruptions, and
connection failures. Old run results must remain associated with the code they ran.
Run editor code in an isolated environment with time and resource limits, outside the web or agent process.

Supporting TypeScript/JavaScript is enough; solving the sample two sum problem is not the assignment.
You may restructure the starter. Explain your choices.

## Show this in your local demo

1. Put a two-loop implementation in the editor and ask the agent to explain it.
   The relevant lines should be highlighted as it speaks.
2. Add lines above the loops and ask again. The highlight must follow the code,
   not fixed line numbers.
3. Ask it to replace both loops with a different implementation. Show the code
   changing directly, then ask it to explain and highlight the new code.
4. Ask it to run the updated code and discuss the output. Also show what happens
   when the user edits during a response or run, or interrupts the agent.

Use these as behavior checks, not a hardcoded demo. The actions should work on
other TypeScript/JavaScript code in the editor too.

## How the starter works

The browser holds the code. When the user finishes speaking, the agent asks for a
fresh copy before replying. Typed questions work the same way. LiveKit carries
the audio and messages between them. A captured copy does not track later edits;
you build the action handling and keep it in sync. The app runs locally; voice
providers need internet access.

![Architecture: the browser, LiveKit server, and Node.js agent run locally. The agent uses Deepgram, OpenAI, and ElevenLabs online for voice.](docs/images/architecture.svg)

## Run the starter

![Candidate steps: accept your private invitation, run the starter locally, build the three features, check them locally, and open a pull request.](docs/images/candidate-flow.svg)

If your application portal offers a starter pack, connect GitHub, activate it,
and download the ZIP. Accept your private repository invitation, extract the ZIP,
and follow `START-HERE.txt`. It includes your personal access key and a setup script.

Use Node.js 22, Git, and [LiveKit Server](https://docs.livekit.io/transport/self-hosting/local/)
(`brew install livekit` on macOS). Without the setup pack, clone your assigned
repository and run these commands in its folder:

```sh
npm ci
npm run setup
```

Before changing the code, create your branch: `git switch -c solution`.

Open three terminals in the repository folder. Keep these commands running:

| Terminal | Command |
| --- | --- |
| LiveKit server | `livekit-server --dev` |
| Web app | `npm run dev` |
| Agent | `npm run agent` |

**Check that setup worked:** open **http://127.0.0.1:3000**, click **Connect agent**,
and wait for **Connected**.

1. Add `// setup check` as the first line in the editor.
2. Send `Read my code`. The reply should include `First line: // setup check`.
3. Change the comment to `// updated` and ask again. The reply should include `// updated`.

This is **mock mode**: it checks the connection without API keys, AI, or audio.
The three actions in the table will work only after you implement them.
If the connection fails, run `npm run doctor` and check that all three terminals are running.

## Add API access

Your [application portal](https://sviam.in/apply/ai-intern/application) is where
you activate and download access once the team invites you. The starter pack
provides **one personal key with US$10 each for OpenAI, Deepgram, and ElevenLabs
(US$30 total), valid for five days after activation**.
Your local agent uses that key through SViam's gateway for OpenAI, Deepgram,
and ElevenLabs. Each service has its own balance and stops at its US$10 limit.
Credits cannot move between services.
You do not need provider accounts or a payment method.
These are SViam-metered allowances for the supplied models and voice, not balances
deposited into personal provider accounts. The pack lists the usage rates and limits.

After checking mock mode, change this one line in the pack's `.env.local`:

```dotenv
AGENT_MODE=voice
```

Keep the supplied key, gateway URL, and voice ID unchanged. Restart the web app and agent,
reconnect, and click **Enable microphone**. Check your balance and deadline in
the portal. The pack explains the usage rates. Downloading again does not reset
credits or time. Paid access stops at the limit or expiry; mock mode remains available.
After replacing a key, copy the new pack's `SVIAM_ASSIGNMENT_KEY`,
`SVIAM_GATEWAY_URL`, and `ELEVEN_VOICE_ID` into your existing `.env.local`, then restart both processes.

Never commit `.env.local` or share your pack. If activation is unavailable,
[contact the hiring team](mailto:vikas.kumar@sviam.in) and use mock mode meanwhile. Using your own provider
keys is optional; the variable names are in `.env.example`.

## Submit

Demo the three features locally with voice, then run:

```sh
npm run check
npm run build
```

- [ ] Speech-aligned highlighting, direct code replacement, and code execution work in a local voice demo.
- [ ] The PR explains your architecture, tests, failure cases, limitations, and how you checked code generated by AI.
- [ ] A `solution` → `main` PR is ready for review in **your assigned private repo**, with local demo steps.

Keep `main` unchanged. No portal upload or merge is needed. Other candidates have
no access; the owner and authorized reviewers can see your work. Use the deadline shown in your application portal or invitation.

## How we review it

We assess the three features, speech/action coordination, state handling,
execution isolation, and your ability to explain the architecture. AI coding tools
are fully allowed. We do not score the
default model's intelligence or factual accuracy, your choice of coding assistant,
provider speech/transcription quality or latency outside your control, or visual
polish beyond usability. We do assess how your app handles provider outputs and errors.

Optional: [code map and starter limitations](docs/implementation-notes.md).
