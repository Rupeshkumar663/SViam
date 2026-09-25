/** The portal key stays in the local Node agent, never in the browser bundle. */
export function voiceAccess(env: Record<string, string | undefined>) {
  const providers = providerAccess(env);
  if (!env.ELEVEN_VOICE_ID) throw new Error("Missing ELEVEN_VOICE_ID. Use the configuration from your starter pack.");
  return { ...providers, voiceId: env.ELEVEN_VOICE_ID };
}

export function providerAccess(env: Record<string, string | undefined>) {
  const key = env.SVIAM_ASSIGNMENT_KEY;
  if (key) {
    const base = new URL(env.SVIAM_GATEWAY_URL || "https://d11vppy3hk6xk2.cloudfront.net/hiring/starter/gateway");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (base.username || base.password || base.search || base.hash || (base.protocol !== "https:" && !(base.protocol === "http:" && loopback))) {
      throw new Error("Use the HTTPS gateway URL supplied in your starter pack.");
    }
    const url = base.toString().replace(/\/$/, "");
    return {
      openai: { apiKey: key, baseURL: `${url}/openai/v1` },
      deepgram: { apiKey: key, baseUrl: `${url.replace(/^http/, "ws")}/deepgram` },
      elevenlabs: { apiKey: key, baseURL: `${url}/elevenlabs/v1` },
    };
  }
  for (const name of ["OPENAI_API_KEY", "DEEPGRAM_API_KEY", "ELEVEN_API_KEY"]) {
    if (!env[name]) throw new Error(`Missing ${name}. Download your starter pack from the application portal, or configure your own provider keys.`);
  }
  return {
    openai: { apiKey: env.OPENAI_API_KEY },
    deepgram: { apiKey: env.DEEPGRAM_API_KEY },
    elevenlabs: { apiKey: env.ELEVEN_API_KEY },
  };
}
