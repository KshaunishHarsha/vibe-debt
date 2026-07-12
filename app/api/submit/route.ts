import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createHash } from "crypto";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL as string);

export async function POST(req: NextRequest) {
  let body: { repoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "invalid", message: "Bad request" }, { status: 400 });
  }
  if (!body.repoUrl || typeof body.repoUrl !== "string") {
    return NextResponse.json({ status: "invalid", message: "Missing repoUrl" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ipHash = createHash("sha256").update(`cooked:${ip}`).digest("hex");

  const result = await convex.action(api.analysisJobs.submit, {
    repoUrl: body.repoUrl,
    ipHash,
  });
  return NextResponse.json(result);
}
