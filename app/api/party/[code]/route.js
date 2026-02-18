import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET - Get party details by code
export async function GET(request, { params }) {
  try {
    const { code } = await params;

    const party = await prisma.party.findUnique({
      where: { code: code.toUpperCase() },
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
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!party) {
      return NextResponse.json(
        { error: "Party not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ party });
  } catch (error) {
    console.error("Party fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch party" },
      { status: 500 }
    );
  }
}

// POST - Join a party
export async function POST(request, { params }) {
  try {
    const { code } = await params;
    const { guestName } = await request.json();
    const userId = await getCurrentUser();

    const party = await prisma.party.findUnique({
      where: { code: code.toUpperCase() },
      include: { members: true },
    });

    if (!party) {
      return NextResponse.json(
        { error: "Party not found" },
        { status: 404 }
      );
    }

    if (party.status !== "waiting") {
      return NextResponse.json(
        { error: "Party is not accepting new members" },
        { status: 400 }
      );
    }

    if (party.members.length >= party.maxPlayers) {
      return NextResponse.json(
        { error: "Party is full" },
        { status: 400 }
      );
    }

    // Check if already a member
    if (userId) {
      const existingMember = party.members.find(m => m.userId === userId);
      if (existingMember) {
        return NextResponse.json(
          { error: "You are already in this party" },
          { status: 400 }
        );
      }
    }

    // Add member
    const member = await prisma.partyMember.create({
      data: {
        partyId: party.id,
        userId: userId || null,
        guestName: userId ? null : (guestName || "Guest"),
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });

    // Return updated party
    const updatedParty = await prisma.party.findUnique({
      where: { id: party.id },
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
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    return NextResponse.json({ party: updatedParty, member });
  } catch (error) {
    console.error("Party join error:", error);
    return NextResponse.json(
      { error: "Failed to join party" },
      { status: 500 }
    );
  }
}

// PATCH - Update party (ready status, start game, etc.)
export async function PATCH(request, { params }) {
  try {
    const { code } = await params;
    const { action, isReady, memberId } = await request.json();
    const userId = await getCurrentUser();

    const party = await prisma.party.findUnique({
      where: { code: code.toUpperCase() },
      include: { members: true },
    });

    if (!party) {
      return NextResponse.json(
        { error: "Party not found" },
        { status: 404 }
      );
    }

    // Update ready status
    if (action === "ready" && typeof isReady === "boolean") {
      const memberToUpdate = party.members.find(m => 
        (userId && m.userId === userId) || (!userId && m.id === memberId)
      );

      if (!memberToUpdate) {
        return NextResponse.json(
          { error: "You are not in this party" },
          { status: 400 }
        );
      }

      await prisma.partyMember.update({
        where: { id: memberToUpdate.id },
        data: { isReady },
      });
    }

    // Start game (host only)
    if (action === "start") {
      if (party.hostId !== userId) {
        return NextResponse.json(
          { error: "Only the host can start the game" },
          { status: 403 }
        );
      }

      // Check if all members are ready
      const notReady = party.members.filter(m => !m.isReady);
      if (notReady.length > 0) {
        return NextResponse.json(
          { error: "Not all players are ready" },
          { status: 400 }
        );
      }

      await prisma.party.update({
        where: { id: party.id },
        data: { status: "playing" },
      });
    }

    // End game (host only)
    if (action === "end") {
      if (party.hostId !== userId) {
        return NextResponse.json(
          { error: "Only the host can end the game" },
          { status: 403 }
        );
      }

      await prisma.party.update({
        where: { id: party.id },
        data: { status: "finished" },
      });
    }

    // Return updated party
    const updatedParty = await prisma.party.findUnique({
      where: { id: party.id },
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
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    return NextResponse.json({ party: updatedParty });
  } catch (error) {
    console.error("Party update error:", error);
    return NextResponse.json(
      { error: "Failed to update party" },
      { status: 500 }
    );
  }
}

// DELETE - Leave party
export async function DELETE(request, { params }) {
  try {
    const { code } = await params;
    const { memberId } = await request.json();
    const userId = await getCurrentUser();

    const party = await prisma.party.findUnique({
      where: { code: code.toUpperCase() },
      include: { members: true },
    });

    if (!party) {
      return NextResponse.json(
        { error: "Party not found" },
        { status: 404 }
      );
    }

    const member = party.members.find(m => 
      (userId && m.userId === userId) || (!userId && m.id === memberId)
    );

    if (!member) {
      return NextResponse.json(
        { error: "You are not in this party" },
        { status: 400 }
      );
    }

    // If host leaves, delete the party
    if (party.hostId === userId) {
      await prisma.party.delete({
        where: { id: party.id },
      });
      return NextResponse.json({ message: "Party deleted" });
    }

    // Otherwise, just remove the member
    await prisma.partyMember.delete({
      where: { id: member.id },
    });

    return NextResponse.json({ message: "Left party successfully" });
  } catch (error) {
    console.error("Party leave error:", error);
    return NextResponse.json(
      { error: "Failed to leave party" },
      { status: 500 }
    );
  }
}
