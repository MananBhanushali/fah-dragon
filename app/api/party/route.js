import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Generate a random 6-character party code
function generatePartyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing characters
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET - List user's parties
export async function GET() {
  try {
    const userId = await getCurrentUser();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Login required to view parties" },
        { status: 401 }
      );
    }

    const parties = await prisma.party.findMany({
      where: {
        OR: [
          { hostId: userId },
          { members: { some: { userId } } },
        ],
        status: { not: "finished" },
      },
      include: {
        host: {
          select: { id: true, username: true, displayName: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ parties });
  } catch (error) {
    console.error("Party list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch parties" },
      { status: 500 }
    );
  }
}

// POST - Create a new party
export async function POST(request) {
  try {
    const userId = await getCurrentUser();
    const { gameMode = "classic", maxPlayers = 4, guestName } = await request.json();

    // Generate unique party code
    let code;
    let attempts = 0;
    do {
      code = generatePartyCode();
      const existing = await prisma.party.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Failed to generate party code" },
        { status: 500 }
      );
    }

    // If user is logged in, use their ID; otherwise, create party without host userId
    if (!userId && !guestName) {
      return NextResponse.json(
        { error: "Guest name required for non-logged in users" },
        { status: 400 }
      );
    }

    // For guests, we'll create a temporary approach
    // In a real app, you might want a different solution
    if (!userId) {
      // Create party with a placeholder, guests can join but can't truly "host"
      return NextResponse.json(
        { error: "Please login to create a party" },
        { status: 401 }
      );
    }

    const party = await prisma.party.create({
      data: {
        code,
        hostId: userId,
        gameMode,
        maxPlayers: Math.min(Math.max(maxPlayers, 2), 8),
        members: {
          create: {
            userId,
            isReady: true, // Host is always ready
          },
        },
      },
      include: {
        host: {
          select: { id: true, username: true, displayName: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ party });
  } catch (error) {
    console.error("Party create error:", error);
    return NextResponse.json(
      { error: "Failed to create party" },
      { status: 500 }
    );
  }
}
