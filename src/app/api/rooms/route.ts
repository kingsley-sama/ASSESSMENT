import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { name, ownerId, username } = await request.json();
    
    const room = await prisma.room.create({
      data: {
        name,
        ownerId,
        users: {
          create: {
            userId: ownerId,
            username,
          },
        },
      },
      include: {
        users: true,
        messages: true,
      },
    });
    
    return NextResponse.json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    const rooms = await prisma.room.findMany({
      where: {
        users: {
          some: {
            userId,
          },
        },
      },
      include: {
        users: true,
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 50,
        },
      },
    });
    
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}
