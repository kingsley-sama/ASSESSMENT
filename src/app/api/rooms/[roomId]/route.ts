import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
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
  const roomId = params.roomId;
  try {
    const { userId, username } = await request.json();
    
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { users: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const existingUserByUsername = room.users.find(user => user.username === username);
    
    if (existingUserByUsername) {
      console.log(`User with username "${username}" already exists in room, joining as existing user`);
      
      const updatedRoom = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          users: true,
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });
      
      return NextResponse.json({
        ...updatedRoom,
        joinedAsExistingUser: true,
        existingUserId: existingUserByUsername.userId
      });
    }

    const existingUserById = room.users.find(user => user.userId === userId);
    if (existingUserById) {
      await prisma.roomUser.update({
        where: { id: existingUserById.id },
        data: { username },
      });

      const updatedRoom = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          users: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      
      return NextResponse.json(updatedRoom);
    }

    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        users: {
          create: { userId, username },
        },
      },
      include: {
        users: true,
        messages: {
          orderBy: { createdAt: 'asc' },
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
  const roomId = params.roomId;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    await prisma.roomUser.deleteMany({
      where: { roomId, userId },
    });

    const remainingUsers = await prisma.roomUser.count({
      where: { roomId },
    });

    if (remainingUsers === 0) {
      await prisma.room.delete({ where: { id: roomId } });
      return NextResponse.json({ deleted: true });
    }

    const updatedRoom = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        users: true,
        messages: {
          orderBy: { createdAt: 'asc' },
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
