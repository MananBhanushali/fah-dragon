import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET - Fetch leaderboard
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameMode = searchParams.get("mode") || "classic";
    const limit = Math.min(parseInt(searchParams.get("limit")) || 100, 100);

    const scores = await prisma.score.findMany({
      where: { gameMode },
      orderBy: { score: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    const leaderboard = scores.map((score, index) => ({
      rank: index + 1,
      id: score.id,
      score: score.score,
      playerName: score.user?.displayName || score.user?.username || score.guestName || "Anonymous",
      userId: score.userId,
      isGuest: !score.userId,
      createdAt: score.createdAt,
    }));

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}

// POST - Submit a score
export async function POST(request) {
  try {
    const { score, gameMode = "classic", guestName } = await request.json();

    if (typeof score !== "number" || score < 0) {
      return NextResponse.json(
        { error: "Invalid score" },
        { status: 400 }
      );
    }

    const userId = await getCurrentUser();

    // Create score entry
    const newScore = await prisma.score.create({
      data: {
        score,
        gameMode,
        userId: userId || null,
        guestName: userId ? null : (guestName || "Guest"),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });
    // Update user's bestScore if applicable
    let bestScore = null;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const currentBest = user?.bestScore ?? 0;
      if (newScore.score > currentBest) {
        await prisma.user.update({ where: { id: userId }, data: { bestScore: newScore.score } });
        bestScore = newScore.score;
      } else {
        bestScore = currentBest;
      }
    }

    // Get the rank of this score
    const rank = await prisma.score.count({
      where: {
        gameMode,
        score: { gt: newScore.score },
      },
    }) + 1;

    return NextResponse.json({
      score: {
        id: newScore.id,
        score: newScore.score,
        rank,
        playerName: newScore.user?.displayName || newScore.user?.username || newScore.guestName,
        isGuest: !newScore.userId,
        bestScore,
      },
    });
  } catch (error) {
    console.error("Score submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit score" },
      { status: 500 }
    );
  }
}
