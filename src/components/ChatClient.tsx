'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { socket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useChatStore } from '@/store/chatStore';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Send, Copy, Plus, MessageSquare, Users, Crown, UserX, Settings, Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmojiPicker } from '@/components/EmojiPicker';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { Room, User, Message } from '@/store/chatStore';

const generateUserId = () => Math.random().toString(36).substring(2, 15);
const generateColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

export default function ChatClient() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Handle async params
  const [roomId, setRoomId] = useState<string>('');
  
  const {
    username,
    userId,
    rooms,
    activeRoomId,
    isConnected,
    setUserId,
    addRoom,
    setActiveRoom,
    addMessage,
    setMessages,
    updateRoomUsers,
    transferOwnership,
    addTypingUser,
    removeTypingUser,
    clearTypingUsers,
    getActiveRoom,
    setConnected,
  } = useChatStore();

  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const activeRoom = getActiveRoom();
  const currentUser = activeRoom?.users.find(u => u.id === userId);
  const isOwner = currentUser?.isOwner || false;

  // Handle async params resolution
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      const resolvedRoomId = resolvedParams.roomId as string;
      setRoomId(resolvedRoomId);
    };
    
    resolveParams();
  }, [params]);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Initialize user ID if not set
  useEffect(() => {
    if (!userId) {
      setUserId(generateUserId());
    }
  }, [userId, setUserId]);

  // Socket connection and room joining
  useEffect(() => {
    if (!roomId || !username || !userId) {
      if (roomId) { // Only redirect if we have roomId but missing other params
        router.push('/');
      }
      return;
    }

    socket.connect();
    setConnected(true);

    // Join room
    socket.emit('join-room', { roomId, username, userId });
    setActiveRoom(roomId);

    // Socket event listeners
    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected to server');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from server');
    });

    socket.on('room-joined', (data) => {
      const { room, users } = data;
      const roomData: Room = {
        id: room.id,
        name: room.name,
        ownerId: room.ownerId,
        users: users.map((user: any) => ({
          id: user.userId,
          username: user.username,
          joinedAt: new Date(user.joinedAt),
          isOwner: user.isOwner,
        })),
        messages: room.messages.map((msg: any) => ({
          id: msg.id,
          message: msg.content,
          username: msg.username,
          userId: msg.userId,
          timestamp: new Date(msg.createdAt),
          type: msg.type,
        })),
        unreadCount: 0,
        isTyping: [],
      };
      addRoom(roomData);
    });

    socket.on('receive-message', (msg) => {
      const messageData: Message = {
        id: msg.id,
        message: msg.message,
        username: msg.username,
        userId: msg.userId,
        timestamp: new Date(msg.timestamp),
        type: msg.type,
      };
      addMessage(roomId, messageData);
      setTimeout(scrollToBottom, 100);
    });

    socket.on('user-joined', (data) => {
      toast({
        title: "User joined",
        description: `${data.username} joined the room`,
      });
    });

    socket.on('user-left', (data) => {
      toast({
        title: "User left",
        description: `${data.username} left the room`,
      });
    });

    socket.on('users-updated', (users) => {
      updateRoomUsers(roomId, users.map((user: any) => ({
        id: user.userId,
        username: user.username,
        joinedAt: new Date(user.joinedAt),
        isOwner: user.isOwner,
      })));
    });

    socket.on('user-typing', (data) => {
      addTypingUser(roomId, data.username);
    });

    socket.on('user-stop-typing', (data) => {
      removeTypingUser(roomId, data.username);
    });

    socket.on('user-removed', (data) => {
      toast({
        title: "User removed",
        description: `${data.username} was removed from the room`,
        variant: "destructive",
      });
    });

    socket.on('removed-from-room', () => {
      toast({
        title: "Removed from room",
        description: "You have been removed from this room",
        variant: "destructive",
      });
      router.push('/');
    });

    socket.on('ownership-transferred', (data) => {
      transferOwnership(roomId, data.newOwnerId);
      toast({
        title: "Ownership transferred",
        description: `${data.newOwnerUsername} is now the room owner`,
      });
    });

    socket.on('error', (error) => {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      socket.emit('leave-room', { roomId, userId, username });
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room-joined');
      socket.off('receive-message');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('user-removed');
      socket.off('removed-from-room');
      socket.off('ownership-transferred');
      socket.off('error');
      socket.disconnect();
    };
  }, [roomId, username, router, addRoom, setActiveRoom, addMessage, setMessages, updateRoomUsers, transferOwnership, addTypingUser, removeTypingUser, clearTypingUsers, toast, scrollToBottom, isConnected, userId, setConnected]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [activeRoom?.messages, scrollToBottom]);

  const sendMessage = () => {
    if (!message.trim() || !activeRoomId || !isConnected) return;
    
    stopTyping();
    socket.emit('send-message', { roomId: activeRoomId, message: message.trim(), username, userId });
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    handleTyping();
  };

  const handleTyping = () => {
    if (!isTyping && isConnected) {
      setIsTyping(true);
      socket.emit('user-typing', { roomId: activeRoomId, username });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const stopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      socket.emit('user-stop-typing', { roomId: activeRoomId, username });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const leaveRoom = () => {
    router.push('/');
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast({
      title: 'Room ID copied!',
      description: 'Share this with others to join the chat.',
    });
  };

  const removeUser = (userIdToRemove: string) => {
    if (!isOwner) return;
    
    socket.emit('remove-user', {
      roomId: activeRoomId,
      userIdToRemove,
      requesterId: userId,
    });
    setShowRemoveDialog(false);
    setUserToRemove(null);
  };

  const addEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Show loading state while resolving params
  if (!roomId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!activeRoom) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="grid grid-cols-12 h-full">
        {/* Sidebar */}
        <Card className="col-span-3 flex flex-col h-full rounded-none border-r">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg mb-4">Your Chats</h2>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => router.push('/')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Join New Room
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2">
              {rooms.map((room) => (
                <div key={room.id}>
                  <Button
                    variant={room.id === activeRoomId ? 'secondary' : 'ghost'}
                    className="w-full justify-start mb-1 h-auto p-3"
                    onClick={() => {
                      setActiveRoom(room.id);
                      router.push(`/chat/${room.id}`);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium truncate">{room.name || `Room ${room.id.slice(-6)}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {room.users.length} {room.users.length === 1 ? 'user' : 'users'}
                      </div>
                    </div>
                    {room.unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {room.unreadCount}
                      </Badge>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <Separator />
          
          <div className="p-4">
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback style={{ backgroundColor: generateColor(username) }}>
                  {username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{username}</p>
                <p className="text-xs text-muted-foreground">
                  {isConnected ? 'Online' : 'Offline'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={leaveRoom}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Main Chat Area */}
        <Card className="col-span-9 flex flex-col h-full rounded-none">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center">
                  {activeRoom.name || 'Chat Room'}
                  {isOwner && <Crown className="h-5 w-5 ml-2 text-yellow-500" />}
                </h2>
                <div className="flex items-center space-x-2">
                  <code className="text-sm text-muted-foreground">
                    {roomId}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyRoomId}
                    className="h-8 w-8"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    {activeRoom.users.length} users
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Room Users</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    {activeRoom.users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback style={{ backgroundColor: generateColor(user.username) }}>
                              {user.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium flex items-center">
                              {user.username}
                              {user.isOwner && <Crown className="h-4 w-4 ml-1 text-yellow-500" />}
                              {user.id === userId && <span className="ml-1 text-xs text-muted-foreground">(You)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {formatTime(user.joinedAt)}
                            </p>
                          </div>
                        </div>
                        {isOwner && user.id !== userId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUserToRemove(user.id);
                              setShowRemoveDialog(true);
                            }}
                          >
                            <UserX className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
              <ThemeToggle />
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {activeRoom.messages.map((msg, idx) => (
                <div key={msg.id || idx}>
                  {msg.type === 'SYSTEM' ? (
                    <div className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {msg.message}
                      </Badge>
                    </div>
                  ) : (
                    <div
                      className={`flex flex-col ${
                        msg.username === username ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.username === username
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback 
                              style={{ backgroundColor: generateColor(msg.username) }}
                              className="text-xs"
                            >
                              {msg.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-semibold text-sm">
                            {msg.username === username ? 'You' : msg.username}
                          </p>
                          <span className="text-xs opacity-70">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Typing indicator */}
              {activeRoom.isTyping.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>
                    {activeRoom.isTyping.length === 1 
                      ? `${activeRoom.isTyping[0]} is typing...`
                      : `${activeRoom.isTyping.length} people are typing...`
                    }
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                ref={inputRef}
                value={message}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1"
                disabled={!isConnected}
              />
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" disabled={!isConnected}>
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-auto p-0">
                  <EmojiPicker onEmojiSelect={addEmoji} />
                </PopoverContent>
              </Popover>
              <Button 
                onClick={sendMessage} 
                disabled={!message.trim() || !isConnected}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Remove User Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user from the room? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToRemove(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToRemove && removeUser(userToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}