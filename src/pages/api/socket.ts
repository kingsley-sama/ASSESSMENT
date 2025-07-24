import { NextApiRequest, NextApiResponse } from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';

interface SocketServer extends HTTPServer {
  io?: Server | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

const prisma = new PrismaClient();

interface TypingUsers {
  [roomId: string]: {
    [socketId: string]: {
      username: string;
      timeout: NodeJS.Timeout;
    };
  };
}

const SocketHandler = (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (res.socket?.server?.io) {
    return res.end();
  }

  const io = new Server(res.socket?.server, {
    path: '/api/socket',
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  res.socket.server.io = io;
  
  const typingUsers: TypingUsers = {};

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', async (data) => {
      try {
        const { roomId, username, userId } = data;
        
        // Join socket room
        socket.join(roomId);
        
        // Store user data in socket
        socket.data = { userId, username, roomId };
        
        // Get room data
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          include: {
            users: true,
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 50,
            },
          },
        });
        
        if (room) {
          // Send room data to user
          socket.emit('room-joined', {
            room,
            users: room.users.map(user => ({
              ...user,
              isOwner: user.userId === room.ownerId,
            })),
          });
          
          // Notify others
          socket.to(roomId).emit('user-joined', {
            username,
            userId,
            joinedAt: new Date(),
          });
          
          // Send updated user list to all in room
          const updatedUsers = room.users.map(user => ({
            ...user,
            isOwner: user.userId === room.ownerId,
          }));
          io.to(roomId).emit('users-updated', updatedUsers);
        }
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', 'Failed to join room');
      }
    });

    socket.on('send-message', async (data) => {
      try {
        const { roomId, message, username, userId } = data;
        
        // Save message to database
        const savedMessage = await prisma.message.create({
          data: {
            roomId,
            content: message,
            username,
            userId,
            type: 'MESSAGE',
          },
        });
        
        const messageData = {
          id: savedMessage.id,
          message: savedMessage.content,
          username: savedMessage.username,
          userId: savedMessage.userId,
          timestamp: savedMessage.createdAt,
          type: savedMessage.type,
        };
        
        // Broadcast to all users in room
        io.to(roomId).emit('receive-message', messageData);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    socket.on('user-typing', (data) => {
      const { roomId, username } = data;
      
      // Clear existing timeout for this user
      if (typingUsers[roomId]?.[socket.id]) {
        clearTimeout(typingUsers[roomId][socket.id].timeout);
      }
      
      // Initialize room if needed
      if (!typingUsers[roomId]) {
        typingUsers[roomId] = {};
      }
      
      // Set new timeout
      const timeout = setTimeout(() => {
        if (typingUsers[roomId]?.[socket.id]) {
          delete typingUsers[roomId][socket.id];
          socket.to(roomId).emit('user-stop-typing', { username });
        }
      }, 3000);
      
      typingUsers[roomId][socket.id] = { username, timeout };
      
      // Notify others that user is typing
      socket.to(roomId).emit('user-typing', { username });
    });

    socket.on('user-stop-typing', (data) => {
      const { roomId, username } = data;
      
      if (typingUsers[roomId]?.[socket.id]) {
        clearTimeout(typingUsers[roomId][socket.id].timeout);
        delete typingUsers[roomId][socket.id];
        socket.to(roomId).emit('user-stop-typing', { username });
      }
    });

    socket.on('remove-user', async (data) => {
      try {
        const { roomId, userIdToRemove, requesterId } = data;
        
        // Verify requester is room owner
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          include: { users: true },
        });
        
        if (!room || room.ownerId !== requesterId) {
          socket.emit('error', 'Only room owner can remove users');
          return;
        }
        
        const userToRemove = room.users.find(user => user.userId === userIdToRemove);
        if (!userToRemove) {
          socket.emit('error', 'User not found in room');
          return;
        }
        
        // Remove user from database
        await prisma.roomUser.deleteMany({
          where: {
            roomId,
            userId: userIdToRemove,
          },
        });
        
        // Create system message
        await prisma.message.create({
          data: {
            roomId,
            content: `${userToRemove.username} was removed from the room`,
            username: 'System',
            userId: 'system',
            type: 'SYSTEM',
          },
        });
        
        // Notify removed user
        const removedUserSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.data?.userId === userIdToRemove);
        
        if (removedUserSocket) {
          removedUserSocket.emit('removed-from-room', { roomId });
          removedUserSocket.leave(roomId);
        }
        
        // Notify room about user removal
        io.to(roomId).emit('user-removed', {
          userId: userIdToRemove,
          username: userToRemove.username,
        });
        
        // Send updated user list
        const updatedUsers = room.users
          .filter(user => user.userId !== userIdToRemove)
          .map(user => ({
            ...user,
            isOwner: user.userId === room.ownerId,
          }));
        io.to(roomId).emit('users-updated', updatedUsers);
        
      } catch (error) {
        console.error('Error removing user:', error);
        socket.emit('error', 'Failed to remove user');
      }
    });

    socket.on('leave-room', async (data) => {
      try {
        const { roomId, userId, username } = data;
        
        socket.leave(roomId);
        
        // Remove from database
        await prisma.roomUser.deleteMany({
          where: { roomId, userId },
        });
        
        // Create leave message
        await prisma.message.create({
          data: {
            roomId,
            content: `${username} left the room`,
            username: 'System',
            userId: 'system',
            type: 'SYSTEM',
          },
        });
        
        // Get updated room info
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          include: { users: true },
        });
        
        if (!room || room.users.length === 0) {
          // Delete empty room
          await prisma.room.delete({ where: { id: roomId } });
          return;
        }
        
        // Handle ownership transfer if needed
        if (room.ownerId === userId && room.users.length > 0) {
          const newOwner = room.users[0];
          await prisma.room.update({
            where: { id: roomId },
            data: { ownerId: newOwner.userId },
          });
          
          await prisma.message.create({
            data: {
              roomId,
              content: `${newOwner.username} is now the room owner`,
              username: 'System',
              userId: 'system',
              type: 'SYSTEM',
            },
          });
          
          io.to(roomId).emit('ownership-transferred', {
            newOwnerId: newOwner.userId,
            newOwnerUsername: newOwner.username,
          });
        }
        
        // Notify room about user leaving
        socket.to(roomId).emit('user-left', { username, userId });
        
        // Send updated user list
        const updatedUsers = room.users.map(user => ({
          ...user,
          isOwner: user.userId === (room.ownerId === userId ? room.users[0]?.userId : room.ownerId),
        }));
        io.to(roomId).emit('users-updated', updatedUsers);
        
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      
      // Clean up typing indicators
      Object.keys(typingUsers).forEach(roomId => {
        if (typingUsers[roomId][socket.id]) {
          const { username } = typingUsers[roomId][socket.id];
          clearTimeout(typingUsers[roomId][socket.id].timeout);
          delete typingUsers[roomId][socket.id];
          socket.to(roomId).emit('user-stop-typing', { username });
        }
      });
      
      // Handle user leaving rooms (if needed)
      if (socket.data?.roomId && socket.data?.userId) {
        const { roomId, userId, username } = socket.data;
        
        try {
          // You might want to handle graceful disconnect here
          // For now, we'll just notify others that user is offline
          socket.to(roomId).emit('user-disconnected', { username, userId });
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      }
    });
  });

  res.end();
  res.end();
};

export default SocketHandler;
