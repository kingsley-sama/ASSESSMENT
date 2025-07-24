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
    const { socket: existingSocket } = get();
    
    // Don't create a new socket if one already exists and is connected
    if (existingSocket?.connected) {
      console.log('Socket already connected');
      return;
    }

    // Disconnect existing socket if it exists
    if (existingSocket) {
      existingSocket.disconnect();
    }
    

    console.log('Initializing socket connection...');
    localStorage.debug = 'socket.io-client:socket';

    // Updated: Remove the API path since we're now using standalone server
    const socket = io('ws://localhost:3000', {
      timeout: 30000,
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
    socket.connect();
    
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      set({ socket, isConnected: true, error: null });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      set({ isConnected: false });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      set({ 
        error: 'Failed to connect to server',
        isConnected: false 
      });
    });

    // Socket event handlers
    socket.on('receive-message', (messageData: any) => {
      console.log('Received message:', messageData);
      const message: Message = {
        id: messageData.id,
        content: messageData.message || messageData.content, // Handle both formats
        userId: messageData.userId,
        username: messageData.username,
        roomId: messageData.roomId || '',
        type: messageData.type === 'SYSTEM' ? 'system' : 'user',
        createdAt: new Date(messageData.timestamp || messageData.createdAt),
      };

      set((state) => {
        // Only add message if it doesn't already exist (prevent duplicates)
        const updatedRooms = state.rooms.map(room => {
          if (room.id === messageData.roomId) {
            const messageExists = room.messages.some(msg => msg.id === message.id);
            if (messageExists) {
              return room;
            }
            
            const isCurrentRoom = state.currentRoom?.id === room.id;
            return {
              ...room,
              messages: [...room.messages, message],
              unreadCount: isCurrentRoom ? room.unreadCount : room.unreadCount + 1,
            };
          }
          return room;
        });

        const updatedCurrentRoom = state.currentRoom && state.currentRoom.id === messageData.roomId
          ? (() => {
              const messageExists = state.currentRoom.messages.some(msg => msg.id === message.id);
              if (messageExists) {
                return state.currentRoom;
              }
              return { ...state.currentRoom, messages: [...state.currentRoom.messages, message] };
            })()
          : state.currentRoom;

        return { 
          rooms: updatedRooms,
          currentRoom: updatedCurrentRoom 
        };
      });
    });

    socket.on('room-joined', ({ room, users, messages }: { room: any; users: any[]; messages?: any[] }) => {
      console.log('Room joined:', room, 'with', messages?.length || 0, 'messages');
      set((state) => {
        // Format messages to match the expected Message interface
        const formattedMessages = (messages || []).map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          userId: msg.userId,
          username: msg.username,
          roomId: msg.roomId,
          type: msg.type === 'SYSTEM' ? 'system' as const : 'user' as const,
          createdAt: new Date(msg.createdAt)
        }));

        const roomWithTyping = {
          ...room,
          unreadCount: 0,
          isTyping: [],
          users: users,
          messages: formattedMessages
        };

        const existingRoomIndex = state.rooms.findIndex(r => r.id === room.id);
        const updatedRooms = existingRoomIndex >= 0 
          ? state.rooms.map((r, i) => i === existingRoomIndex ? roomWithTyping : r)
          : [...state.rooms, roomWithTyping];

        return {
          rooms: updatedRooms,
          currentRoom: roomWithTyping,
          isLoading: false,
          error: null
        };
      });
    });

    socket.on('users-updated', (users: any[]) => {
      set((state) => {
        if (!state.currentRoom) return state;

        const updatedCurrentRoom = {
          ...state.currentRoom,
          users: users
        };

        const updatedRooms = state.rooms.map(room => 
          room.id === state.currentRoom?.id 
            ? { ...room, users: users }
            : room
        );

        return {
          currentRoom: updatedCurrentRoom,
          rooms: updatedRooms
        };
      });
    });

    socket.on('user-typing', ({ username }: { username: string }) => {
      const { user, currentRoom } = get();
      if (user?.username === username || !currentRoom) return;

      set((state) => {
        const updatedCurrentRoom = state.currentRoom ? {
          ...state.currentRoom,
          isTyping: [...(state.currentRoom.isTyping || []).filter(u => u !== username), username]
        } : null;

        return { currentRoom: updatedCurrentRoom };
      });

      // Clear typing after 3 seconds
      setTimeout(() => {
        set((state) => {
          const updatedCurrentRoom = state.currentRoom ? {
            ...state.currentRoom,
            isTyping: (state.currentRoom.isTyping || []).filter(u => u !== username)
          } : null;

          return { currentRoom: updatedCurrentRoom };
        });
      }, 3000);
    });

    socket.on('user-stop-typing', ({ username }: { username: string }) => {
      set((state) => {
        const updatedCurrentRoom = state.currentRoom ? {
          ...state.currentRoom,
          isTyping: (state.currentRoom.isTyping || []).filter(u => u !== username)
        } : null;

        return { currentRoom: updatedCurrentRoom };
      });
    });

    socket.on('removed-from-room', ({ roomId }: { roomId: string }) => {
      set((state) => ({
        rooms: state.rooms.filter(room => room.id !== roomId),
        currentRoom: state.currentRoom?.id === roomId ? null : state.currentRoom,
        error: 'You have been removed from the room'
      }));
    });

    socket.on('error', (error: string) => {
       const currentSocket = get().socket;
      if (currentSocket) return;
      console.error('Socket error:', error);
      set({ error });
    });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      console.log('Disconnecting socket...');
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  setUser: (user) => {
    console.log('Setting user:', user);
    set({ user });
    // Store user in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
  },

  joinRoom: async (roomId: string, username: string) => {
    const { user, socket } = get();
    if (!user) {
      throw new Error('User not set');
    }

    console.log('Joining room:', roomId, 'as', username);
    set({ isLoading: true, error: null });

    try {
      // First, try to join via API
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join room');
      }

      const roomData = await response.json();
      console.log('Successfully joined room via API:', roomData);
      
      // If user joined as existing user, update the user in the store
      if (roomData.joinedAsExistingUser && roomData.existingUserId) {
        console.log('Joined as existing user, updating user ID:', roomData.existingUserId);
        const updatedUser = { ...user, id: roomData.existingUserId };
        set({ user: updatedUser });
        // Update localStorage as well
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }

      // Clean the room data (remove the extra properties we added)
      const { joinedAsExistingUser, existingUserId, ...room } = roomData;
      
      // Format messages to match the expected Message interface
      const formattedMessages = (room.messages || []).map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        userId: msg.userId,
        username: msg.username,
        roomId: msg.roomId,
        type: msg.type === 'SYSTEM' ? 'system' as const : 'user' as const,
        createdAt: new Date(msg.createdAt)
      }));

      // Update the room object with formatted messages
      const roomWithFormattedMessages = {
        ...room,
        messages: formattedMessages
      };
      
      // Join socket room if socket is connected
      const currentUserId = roomData.joinedAsExistingUser ? roomData.existingUserId : user.id;
      if (socket?.connected) {
        console.log('Joining socket room...');
        socket.emit('join-room', { roomId, userId: currentUserId, username });
      } else {
        console.warn('Socket not connected, will join room when socket connects');
      }

      // Update state
      set((state) => {
        const existingRoomIndex = state.rooms.findIndex(r => r.id === roomWithFormattedMessages.id);
        const updatedRooms = existingRoomIndex >= 0 
          ? state.rooms.map((r, i) => i === existingRoomIndex ? { ...roomWithFormattedMessages, unreadCount: 0, isTyping: [] } : r)
          : [...state.rooms, { ...roomWithFormattedMessages, unreadCount: 0, isTyping: [] }];

        return {
          rooms: updatedRooms,
          currentRoom: { ...roomWithFormattedMessages, unreadCount: 0, isTyping: [] },
          isLoading: false,
          error: null
        };
      });

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
    if (!user) return;

    console.log('Leaving room:', roomId);
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/rooms/${roomId}?userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to leave room');
      }

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
      if (socket?.connected) {
        socket.emit('leave-room', { roomId, userId: user.id, username: user.username });
      }

    } catch (error) {
      console.error('Error leaving room:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to leave room',
        isLoading: false 
      });
    }
  },

  createRoom: async (name: string, username: string) => {
    const { user, socket } = get();
    if (!user) throw new Error('User not set');

    console.log('Creating room:', name, 'for user:', username);
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ownerId: user.id, username }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create room');
      }

      const room: Room = await response.json();
      console.log('Room created successfully:', room);
      
      // Format messages to match the expected Message interface
      const formattedMessages = (room.messages || []).map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        userId: msg.userId,
        username: msg.username,
        roomId: msg.roomId,
        type: msg.type === 'SYSTEM' ? 'system' as const : 'user' as const,
        createdAt: new Date(msg.createdAt)
      }));

      const roomWithFormattedMessages = {
        ...room,
        messages: formattedMessages,
        unreadCount: 0,
        isTyping: []
      };
      
      // Join socket room if socket is connected
      if (socket?.connected) {
        console.log('Joining socket room after creation...');
        socket.emit('join-room', { roomId: room.id, userId: user.id, username });
      } else {
        console.warn('Socket not connected, will join room when socket connects');
      }
      
      set((state) => ({
        rooms: [...state.rooms, roomWithFormattedMessages],
        currentRoom: roomWithFormattedMessages,
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
    if (!socket?.connected || !user) {
      console.warn('Cannot send message: socket not connected or user not set');
      set({ error: 'Unable to send message. Please check your connection.' });
      return;
    }

    console.log('Sending message:', content, 'to room:', roomId, 'from user:', user.username);
    socket.emit('send-message', {
      roomId,
      message: content,
      userId: user.id,
      username: user.username,
    });
    
    // Clear any errors
    set({ error: null });
  },

  setCurrentRoom: (roomId: string) => {
    console.log('Setting current room:', roomId);
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

    console.log('Loading user rooms for:', user.id);
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/rooms?userId=${user.id}`);
      if (!response.ok) {
        throw new Error('Failed to load rooms');
      }

      const rooms: Room[] = await response.json();
      console.log('Loaded rooms:', rooms);
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