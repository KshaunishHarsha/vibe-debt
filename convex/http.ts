import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// These endpoints are the only surface Hermes (on the droplet) talks to.
// Both are guarded by a shared secret so random internet traffic can't
// claim jobs or inject fake analyses.
function authorized(req: Request): boolean {
  const secret = process.env.HERMES_SHARED_SECRET;
  if (!secret) return false;
  return req.headers.get("x-hermes-secret") === secret;
}

const http = httpRouter();

http.route({
  path: "/api/jobs/next",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return new Response("unauthorized", { status: 401 });
    const job = await ctx.runMutation(internal.analysisJobs.claimNext, {});
    if (!job) return new Response(null, { status: 204 });
    return Response.json(job);
  }),
});

http.route({
  path: "/api/jobs/result",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return new Response("unauthorized", { status: 401 });
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("invalid JSON", { status: 400 });
    }
    const { jobId, result, error } = body;
    if (!jobId) return new Response("missing jobId", { status: 400 });

    if (error) {
      await ctx.runMutation(internal.analysisJobs.failJob, { jobId });
      return Response.json({ ok: true, failed: true });
    }
    if (!result) return new Response("missing result", { status: 400 });

    const analysisId = await ctx.runMutation(internal.analysisJobs.completeJob, {
      jobId,
      result,
    });
    return Response.json({ ok: true, analysisId });
  }),
});

export default http;
