import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const room = await prisma.room.findUnique({
      where: { id: params.roomId },
      include: {
        users: true,
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { userId, username } = await request.json();
    
    // Check if room exists
    const room = await prisma.room.findUnique({
      where: { id: params.roomId },
      include: { users: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if user is already in the room
    const existingUser = room.users.find(user => user.userId === userId);
    if (existingUser) {
      // User already in room, just return the room data
      const updatedRoom = await prisma.room.findUnique({
        where: { id: params.roomId },
        include: {
          users: true,
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });
      return NextResponse.json(updatedRoom);
    }

    // Add user to room
    const updatedRoom = await prisma.room.update({
      where: { id: params.roomId },
      data: {
        users: {
          create: {
            userId,
            username,
          },
        },
      },
      include: {
        users: true,
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return NextResponse.json(updatedRoom);
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json(
      { error: 'Failed to join room' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Remove user from room
    await prisma.roomUser.deleteMany({
      where: {
        roomId: params.roomId,
        userId,
      },
    });

    // Check if room is empty
    const remainingUsers = await prisma.roomUser.count({
      where: { roomId: params.roomId },
    });

    if (remainingUsers === 0) {
      // Delete the room if empty
      await prisma.room.delete({
        where: { id: params.roomId },
      });
      return NextResponse.json({ deleted: true });
    }

    // Get updated room
    const updatedRoom = await prisma.room.findUnique({
      where: { id: params.roomId },
      include: {
        users: true,
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return NextResponse.json(updatedRoom);
  } catch (error) {
    console.error('Error leaving room:', error);
    return NextResponse.json(
      { error: 'Failed to leave room' },
      { status: 500 }
    );
  }
}