import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { PrismaClient } from '@prisma/client';

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

interface TypingUsers {
  [roomId: string]: {
    [socketId: string]: {
      username: string;
      timeout: NodeJS.Timeout;
    };
  };
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Adjust this in production
      methods: ["GET", "POST"],
    },
    transports: ['websocket', 'polling'],
  });

  const typingUsers: TypingUsers = {};

  io.on("connection", (socket) => {
    console.log("✅ New client connected:", socket.id);

    socket.on('join-room', async (data) => {
      try {
        const { roomId, username, userId } = data;
        
        console.log(`User ${username} (${userId}) joining room ${roomId} via socket`);
        
        if (!roomId || !username || !userId) {
          socket.emit('error', 'Missing required data for joining room');
          return;
        }

        // Check if user is already in the room via socket
        const socketRooms = Array.from(socket.rooms);
        if (socketRooms.includes(roomId)) {
          console.log(`User ${username} already in socket room ${roomId}`);
          return;
        }

        // Verify user is actually a member of the room in database
        const roomUser = await prisma.roomUser.findFirst({
          where: { roomId, userId }
        });

        if (!roomUser) {
          socket.emit('error', 'You are not a member of this room');
          return;
        }
        
        // Join socket room
        await socket.join(roomId);
        
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
            room: {
              ...room,
              users: room.users.map(user => ({
                ...user,
                isOwner: user.userId === room.ownerId,
              })),
            },
            users: room.users.map(user => ({
              ...user,
              isOwner: user.userId === room.ownerId,
            })),
            messages: room.messages,
          });
          
          console.log(`User ${username} successfully joined room ${roomId} via socket`);
          
          // Notify others in the room
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
        } else {
          socket.emit('error', 'Room not found');
        }
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', 'Failed to join room');
      }
    });

    socket.on('send-message', async (data) => {
      try {
        const { roomId, message, username, userId } = data;
        
        console.log('Sending message:', { roomId, message, username, userId });
        
        if (!roomId || !message || !username || !userId) {
          socket.emit('error', 'Missing required data for sending message');
          return;
        }

        // Verify user is in the room
        const roomUser = await prisma.roomUser.findFirst({
          where: { roomId, userId }
        });

        if (!roomUser) {
          socket.emit('error', 'You are not a member of this room');
          return;
        }
        
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
          content: savedMessage.content, // Include both for compatibility
          username: savedMessage.username,
          userId: savedMessage.userId,
          roomId: savedMessage.roomId,
          timestamp: savedMessage.createdAt,
          createdAt: savedMessage.createdAt, // Include both for compatibility  
          type: savedMessage.type,
        };
        
        // Broadcast to all users in room (including sender)
        io.to(roomId).emit('receive-message', messageData);
        console.log('Message broadcasted to room:', roomId, messageData);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    socket.on('user-typing', (data) => {
      try {
        const { roomId, username } = data;
        
        if (!roomId || !username) {
          return;
        }
        
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
      } catch (error) {
        console.error('Error handling typing:', error);
      }
    });

    socket.on('user-stop-typing', (data) => {
      try {
        const { roomId, username } = data;
        
        if (!roomId || !username) {
          return;
        }
        
        if (typingUsers[roomId]?.[socket.id]) {
          clearTimeout(typingUsers[roomId][socket.id].timeout);
          delete typingUsers[roomId][socket.id];
          socket.to(roomId).emit('user-stop-typing', { username });
        }
      } catch (error) {
        console.error('Error handling stop typing:', error);
      }
    });

    socket.on('remove-user', async (data) => {
      try {
        const { roomId, userIdToRemove, requesterId } = data;
        
        if (!roomId || !userIdToRemove || !requesterId) {
          socket.emit('error', 'Missing required data for removing user');
          return;
        }
        
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
        const systemMessage = await prisma.message.create({
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
        
        // Broadcast system message
        io.to(roomId).emit('receive-message', {
          id: systemMessage.id,
          message: systemMessage.content,
          content: systemMessage.content,
          username: systemMessage.username,
          userId: systemMessage.userId,
          roomId: systemMessage.roomId,
          timestamp: systemMessage.createdAt,
          createdAt: systemMessage.createdAt,
          type: systemMessage.type,
        });
        
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
        
        if (!roomId || !userId || !username) {
          return;
        }
        
        console.log(`User ${username} leaving room ${roomId}`);
        
        await socket.leave(roomId);
        
        // Remove from database
        await prisma.roomUser.deleteMany({
          where: { roomId, userId },
        });
        
        // Create leave message
        const leaveMessage = await prisma.message.create({
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
        
        let newOwnerId = room.ownerId;
        
        // Handle ownership transfer if needed
        if (room.ownerId === userId && room.users.length > 0) {
          const newOwner = room.users[0];
          newOwnerId = newOwner.userId;
          
          await prisma.room.update({
            where: { id: roomId },
            data: { ownerId: newOwner.userId },
          });
          
          const ownershipMessage = await prisma.message.create({
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
          
          // Broadcast ownership message
          io.to(roomId).emit('receive-message', {
            id: ownershipMessage.id,
            message: ownershipMessage.content,
            content: ownershipMessage.content,
            username: ownershipMessage.username,
            userId: ownershipMessage.userId,
            roomId: ownershipMessage.roomId,
            timestamp: ownershipMessage.createdAt,
            createdAt: ownershipMessage.createdAt,
            type: ownershipMessage.type,
          });
        }
        
        // Broadcast leave message
        socket.to(roomId).emit('receive-message', {
          id: leaveMessage.id,
          message: leaveMessage.content,
          content: leaveMessage.content,
          username: leaveMessage.username,
          userId: leaveMessage.userId,
          roomId: leaveMessage.roomId,
          timestamp: leaveMessage.createdAt,
          createdAt: leaveMessage.createdAt,
          type: leaveMessage.type,
        });
        
        // Notify room about user leaving
        socket.to(roomId).emit('user-left', { username, userId });
        
        // Send updated user list
        const updatedUsers = room.users.map(user => ({
          ...user,
          isOwner: user.userId === newOwnerId,
        }));
        io.to(roomId).emit('users-updated', updatedUsers);
        
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    socket.on("disconnect", async (reason) => {
      console.log("❌ Client disconnected:", socket.id, 'Reason:', reason);
      
      // Clean up typing indicators
      Object.keys(typingUsers).forEach(roomId => {
        if (typingUsers[roomId] && typingUsers[roomId][socket.id]) {
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
          // Notify others that user is offline
          socket.to(roomId).emit('user-disconnected', { username, userId });
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`🚀 Server ready at http://${hostname}:${port}`);
    console.log('✅ Socket.IO server initialized successfully');
  });
}).catch((err) => {
  console.error("❌ Error starting server:", err);
  process.exit(1);
});