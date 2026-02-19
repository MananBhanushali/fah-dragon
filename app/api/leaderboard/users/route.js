import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 500);
    const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
    const q = (searchParams.get('q') || '').trim();
    const skip = (page - 1) * limit;

    const where = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { bestScore: 'desc' },
        select: { id: true, username: true, displayName: true, bestScore: true },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({ users, total, page, limit });
  } catch (err) {
    console.error('Failed to fetch leaderboard users', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
