"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Generate an unhinged slang roast (text via Hermes; audio via ElevenLabs if
// the key file exists on the VPS — Hermes POSTs the mp3 back to our HTTP
// endpoint). Run: npx convex run roasts:generateSlang '{"analysisId": "..."}'
export const generateSlang = internalAction({
  args: { analysisId: v.id("analyses") },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const a: {
      repoUrl: string;
      cookedScore: number;
      tier: string;
      findingsJson: string;
    } | null = await ctx.runQuery(internal.roastsDb.getAnalysisById, {
      analysisId: args.analysisId,
    });
    if (!a) return "analysis not found";

    const shortName = a.repoUrl.replace("https://github.com/", "");
    const convexSiteUrl = process.env.CONVEX_SITE_URL;
    const secret = process.env.HERMES_SHARED_SECRET;

    const prompt = [
      `Repo: ${shortName} — cooked score ${a.cookedScore}/100 (${a.tier}).`,
      `Findings JSON: ${a.findingsJson}`,
      ``,
      `TASK 1 — Write an UNHINGED gen-z slang roast of this repo, 2-4 sentences,`,
      `max 350 chars. Use brainrot dev slang (cooked, npc behavior, skill issue,`,
      `down bad, no cap, ratio, rizz, "bro really said", crashout, etc). Reference`,
      `the ACTUAL findings (real file names/numbers from the JSON). Punch at the`,
      `code, not the person. Mild profanity ok, nothing worse than "ass"/"damn".`,
      `If the repo is clean (score < 21), make it unhinged PRAISE (aura, glazing,`,
      `"bro's repo has rizz", still cite real evidence).`,
      ``,
      `TASK 2 — Only if the file /root/cooked/.elevenlabs_key exists:`,
      `KEY=$(cat /root/cooked/.elevenlabs_key) and generate TTS audio of the roast:`,
      `curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128" \\`,
      `  -H "xi-api-key: $KEY" -H "Content-Type: application/json" \\`,
      `  -d "$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1], "model_id": "eleven_multilingual_v2"}))' "YOUR_ROAST_TEXT")" \\`,
      `  -o /tmp/roast.mp3`,
      `Then verify /tmp/roast.mp3 is >10KB and actually audio (not JSON error), and POST it:`,
      `curl -s -X POST "${convexSiteUrl}/api/audio?analysisId=${args.analysisId}" \\`,
      `  -H "x-hermes-secret: ${secret}" -H "Content-Type: audio/mpeg" \\`,
      `  --data-binary @/tmp/roast.mp3`,
      `If the key file does not exist, skip TASK 2 silently.`,
      ``,
      `Your FINAL message must be ONLY the roast text itself. No quotes, no JSON,`,
      `no commentary, no mention of audio.`,
    ].join("\n");

    const res = await fetch(process.env.HERMES_API_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HERMES_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "hermes-agent",
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok) return `hermes error ${res.status}`;
    const data = await res.json();
    const text: string = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!text || text.length > 600) return `unusable roast: ${text.slice(0, 100)}`;

    await ctx.runMutation(internal.roastsDb.setSlangRoast, {
      analysisId: args.analysisId,
      slangRoast: text,
    });
    return text;
  },
});

// Backfill: generate slang roasts for every analysis missing one.
export const generateAllMissing = internalAction({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx): Promise<string[]> => {
    const all = await ctx.runQuery(internal.roastsDb.listMissingSlang, {});
    const out: string[] = [];
    for (const id of all) {
      const r: string = await ctx.runAction(internal.roasts.generateSlang, {
        analysisId: id,
      });
      out.push(r.slice(0, 80));
    }
    return out;
  },
});

