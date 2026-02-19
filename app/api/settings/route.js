import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUser();
    if (!userId) {
      // return defaults for anonymous
      return NextResponse.json({ settings: { fahOnSpace: true, fahVolume: 50 } });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fahOnSpace: true, fahVolume: true },
    });

    if (!user) {
      return NextResponse.json({ settings: { fahOnSpace: true, fahVolume: 50 } });
    }

    return NextResponse.json({ settings: { fahOnSpace: user.fahOnSpace, fahVolume: user.fahVolume } });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const userId = await getCurrentUser();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const data = {};
    if (typeof body.fahOnSpace === "boolean") data.fahOnSpace = body.fahOnSpace;
    if (typeof body.fahVolume === "number") data.fahVolume = Math.max(0, Math.min(100, Math.round(body.fahVolume)));

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { fahOnSpace: true, fahVolume: true },
    });

    return NextResponse.json({ settings: { fahOnSpace: user.fahOnSpace, fahVolume: user.fahVolume } });
  } catch (error) {
    console.error("POST /api/settings error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
