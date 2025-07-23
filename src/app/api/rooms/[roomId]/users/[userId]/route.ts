import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string; userId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');
    
    if (!requesterId) {
      return NextResponse.json({ error: 'Requester ID required' }, { status: 400 });
    }
    
    // Check if requester is room owner
    const room = await prisma.room.findUnique({
      where: { id: params.roomId },
      include: { users: true },
    });
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    
    if (room.ownerId !== requesterId) {
      return NextResponse.json({ error: 'Only room owner can remove users' }, { status: 403 });
    }
    
    // Find user to remove
    const userToRemove = room.users.find(user => user.userId === params.userId);
    if (!userToRemove) {
      return NextResponse.json({ error: 'User not in room' }, { status: 404 });
    }
    
    // Remove user
    await prisma.roomUser.deleteMany({
      where: {
        roomId: params.roomId,
        userId: params.userId,
      },
    });
    
    // Create removal message
    await prisma.message.create({
      data: {
        roomId: params.roomId,
        content: `${userToRemove.username} was removed from the room`,
        username: 'System',
        userId: 'system',
        type: 'SYSTEM',
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing user:', error);
    return NextResponse.json(
      { error: 'Failed to remove user' },
      { status: 500 }
    );
  }
}
