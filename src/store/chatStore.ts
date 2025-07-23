import { create } from 'zustand';
import { Socket, io } from 'socket.io-client';

export interface Message {
  id: string;
  content: string;
  userId: string;
  username: string;
  roomId: string;
  type: 'user' | 'system';
  createdAt: Date;
}

export interface User {
  id: string;
  userId: string;
  username: string;
  joinedAt: Date;
  isOwner?: boolean;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  users: User[];
  messages: Message[];
  unreadCount: number;
  isTyping: string[];
}

interface ChatState {
  socket: Socket | null;
  currentRoom: Room | null;
  rooms: Room[];
  user: { id: string; username: string } | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initializeSocket: () => void;
  disconnectSocket: () => void;
  setUser: (user: { id: string; username: string }) => void;
  joinRoom: (roomId: string, username: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  createRoom: (name: string, username: string) => Promise<string>;
  sendMessage: (content: string, roomId: string) => void;
  setCurrentRoom: (roomId: string) => void;
  loadUserRooms: () => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  socket: null,
  currentRoom: null,
  rooms: [],
  user: null,
  isConnected: false,
  isLoading: false,
  error: null,

  initializeSocket: () => {
    const socket = io();
    
    socket.on('connect', () => {
      console.log('Connected to server');
      set({ socket, isConnected: true, error: null });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      set({ isConnected: false });
    });

    socket.on('message', (message: Message) => {
      set((state) => {
        const updatedRooms = state.rooms.map(room => {
          if (room.id === message.roomId) {
            const isCurrentRoom = state.currentRoom?.id === room.id;
            return {
              ...room,
              messages: [...room.messages, message],
              unreadCount: isCurrentRoom ? room.unreadCount : room.unreadCount + 1,
            };
          }
          return room;
        });

        const updatedCurrentRoom = state.currentRoom?.id === message.roomId
          ? { ...state.currentRoom, messages: [...state.currentRoom.messages, message] }
          : state.currentRoom;

        return { 
          rooms: updatedRooms,
          currentRoom: updatedCurrentRoom 
        };
      });
    });

    socket.on('userJoined', ({ user, roomId }: { user: User; roomId: string }) => {
      set((state) => {
        const updatedRooms = state.rooms.map(room => {
          if (room.id === roomId) {
            return {
              ...room,
              users: [...room.users.filter(u => u.userId !== user.userId), user],
            };
          }
          return room;
        });

        const updatedCurrentRoom = state.currentRoom?.id === roomId
          ? { ...state.currentRoom, users: [...state.currentRoom.users.filter(u => u.userId !== user.userId), user] }
          : state.currentRoom;

        return { 
          rooms: updatedRooms,
          currentRoom: updatedCurrentRoom 
        };
      });
    });

    socket.on('userLeft', ({ userId, roomId }: { userId: string; roomId: string }) => {
      set((state) => {
        const updatedRooms = state.rooms.map(room => {
          if (room.id === roomId) {
            return {
              ...room,
              users: room.users.filter(u => u.userId !== userId),
            };
          }
          return room;
        });

        const updatedCurrentRoom = state.currentRoom?.id === roomId
          ? { ...state.currentRoom, users: state.currentRoom.users.filter(u => u.userId !== userId) }
          : state.currentRoom;

        return { 
          rooms: updatedRooms,
          currentRoom: updatedCurrentRoom 
        };
      });
    });

    socket.on('typing', ({ userId, username, roomId }: { userId: string; username: string; roomId: string }) => {
      set((state) => {
        if (state.user?.id === userId) return state; // Don't show own typing

        const updatedRooms = state.rooms.map(room => {
          if (room.id === roomId) {
            const typingUsers = room.isTyping || [];
            if (!typingUsers.includes(username)) {
              return { ...room, isTyping: [...typingUsers, username] };
            }
          }
          return room;
        });

        const updatedCurrentRoom = state.currentRoom?.id === roomId && state.user?.id !== userId
          ? (() => {
              const typingUsers = state.currentRoom.isTyping || [];
              return !typingUsers.includes(username)
                ? { ...state.currentRoom, isTyping: [...typingUsers, username] }
                : state.currentRoom;
            })()
          : state.currentRoom;

        return { 
          rooms: updatedRooms,
          currentRoom: updatedCurrentRoom 
        };
      });

      // Clear typing after 3 seconds
      setTimeout(() => {
        set((state) => {
          const updatedRooms = state.rooms.map(room => {
            if (room.id === roomId) {
              return { ...room, isTyping: (room.isTyping || []).filter(u => u !== username) };
            }
            return room;
          });

          const updatedCurrentRoom = state.currentRoom?.id === roomId
            ? { ...state.currentRoom, isTyping: (state.currentRoom.isTyping || []).filter(u => u !== username) }
            : state.currentRoom;

          return { 
            rooms: updatedRooms,
            currentRoom: updatedCurrentRoom 
          };
        });
      }, 3000);
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  setUser: (user) => {
    set({ user });
  },

  joinRoom: async (roomId: string, username: string) => {
    const { user, socket } = get();
    if (!user || !socket) return;

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join room');
      }

      const room: Room = await response.json();
      
      // Add room to rooms if not already there
      set((state) => {
        const existingRoomIndex = state.rooms.findIndex(r => r.id === room.id);
        const updatedRooms = existingRoomIndex >= 0 
          ? state.rooms.map((r, i) => i === existingRoomIndex ? { ...room, unreadCount: 0, isTyping: [] } : r)
          : [...state.rooms, { ...room, unreadCount: 0, isTyping: [] }];

        return {
          rooms: updatedRooms,
          currentRoom: { ...room, unreadCount: 0, isTyping: [] },
          isLoading: false,
          error: null
        };
      });

      // Join socket room
      socket.emit('joinRoom', { roomId, userId: user.id, username });

    } catch (error) {
      console.error('Error joining room:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to join room',
        isLoading: false 
      });
      throw error;
    }
  },

  leaveRoom: async (roomId: string) => {
    const { user, socket } = get();
    if (!user || !socket) return;

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/rooms/${roomId}?userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to leave room');
      }

      const result = await response.json();

      set((state) => {
        const updatedRooms = state.rooms.filter(room => room.id !== roomId);
        const updatedCurrentRoom = state.currentRoom?.id === roomId ? null : state.currentRoom;

        return {
          rooms: updatedRooms,
          currentRoom: updatedCurrentRoom,
          isLoading: false,
          error: null
        };
      });

      // Leave socket room
      socket.emit('leaveRoom', { roomId, userId: user.id });

    } catch (error) {
      console.error('Error leaving room:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to leave room',
        isLoading: false 
      });
    }
  },

  createRoom: async (name: string, username: string) => {
    const { user } = get();
    if (!user) throw new Error('User not set');

    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ownerId: user.id, username }),
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const room: Room = await response.json();
      
      set((state) => ({
        rooms: [...state.rooms, { ...room, unreadCount: 0, isTyping: [] }],
        isLoading: false,
        error: null
      }));

      return room.id;
    } catch (error) {
      console.error('Error creating room:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create room',
        isLoading: false 
      });
      throw error;
    }
  },

  sendMessage: (content: string, roomId: string) => {
    const { socket, user } = get();
    if (!socket || !user) return;

    socket.emit('message', {
      content,
      roomId,
      userId: user.id,
      username: user.username,
    });
  },

  setCurrentRoom: (roomId: string) => {
    set((state) => {
      const room = state.rooms.find(r => r.id === roomId);
      if (room) {
        // Reset unread count for current room
        const updatedRooms = state.rooms.map(r => 
          r.id === roomId ? { ...r, unreadCount: 0 } : r
        );
        return {
          currentRoom: { ...room, unreadCount: 0 },
          rooms: updatedRooms
        };
      }
      return state;
    });
  },

  loadUserRooms: async () => {
    const { user } = get();
    if (!user) return;

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/rooms?userId=${user.id}`);
      if (!response.ok) {
        throw new Error('Failed to load rooms');
      }

      const rooms: Room[] = await response.json();
      set({ 
        rooms: rooms.map(room => ({ ...room, unreadCount: 0, isTyping: [] })),
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('Error loading rooms:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load rooms',
        isLoading: false 
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
