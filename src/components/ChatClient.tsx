'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useChatStore } from '@/store/chatStore';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Send, Copy, Plus, MessageSquare, Users, Crown, UserX, Smile } from 'lucide-react';
import { EmojiPicker } from '@/components/EmojiPicker';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const {
    socket,
    currentRoom,
    rooms,
    user,
    isConnected,
    isLoading,
    error,
    initializeSocket,
    joinRoom,
    leaveRoom,
    sendMessage: sendSocketMessage,
    setCurrentRoom,
    loadUserRooms,
    clearError,
  } = useChatStore();

  // Handle async params resolution
  useEffect(() => {
    if (params?.roomId) {
    setRoomId(params.roomId as string);

  }
  }, [params]);

  // Initialize socket
  useEffect(() => {
    if (!socket || !socket.connected) {
      initializeSocket();
    }
  }, [socket, initializeSocket]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      clearError();
    }
  }, [error, clearError, toast]);

  // Join room when roomId is available and socket is connected
  useEffect(() => {
    if (roomId && user && isConnected) {
      // Check if we're already in this room
      if (currentRoom?.id !== roomId) {
        joinRoom(roomId, user.username).catch((error) => {
          console.error('Failed to join room:', error);
          toast({
            title: "Error",
            description: "Failed to join room. Redirecting to home.",
            variant: "destructive",
          });
          router.push('/');
        });
      } else {
        setCurrentRoom(roomId);
      }
    }
  }, [roomId, user, isConnected, currentRoom?.id, joinRoom, setCurrentRoom, router, toast]);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [currentRoom?.messages, scrollToBottom]);

  // Socket event listeners for room-specific events
  useEffect(() => {
    if (!socket || !roomId) return;

    const handleUserJoined = ({ username, userId, joinedAt }: { username: string; userId: string; joinedAt: string }) => {
      toast({
        title: "User joined",
        description: `${username} joined the room`,
      });
    };

    const handleUserLeft = ({ userId, username }: { userId: string; username: string }) => {
      toast({
        title: "User left",
        description: `${username} left the room`,
      });
    };

    const handleUserRemoved = ({ userId, username }: { userId: string; username: string }) => {
      if (userId === user?.id) {
        toast({
          title: "Removed from room",
          description: "You have been removed from this room",
          variant: "destructive",
        });
        router.push('/');
      } else {
        toast({
          title: "User removed",
          description: `${username} was removed from the room`,
        });
      }
    };

    const handleRemovedFromRoom = ({ roomId: removedRoomId }: { roomId: string }) => {
      if (removedRoomId === roomId) {
        toast({
          title: "Removed from room",
          description: "You have been removed from this room",
          variant: "destructive",
        });
        router.push('/');
      }
    };

    const handleOwnershipTransferred = ({ newOwnerId, newOwnerUsername }: { newOwnerId: string; newOwnerUsername: string }) => {
      toast({
        title: "New room owner",
        description: `${newOwnerUsername} is now the room owner`,
      });
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('user-removed', handleUserRemoved);
    socket.on('removed-from-room', handleRemovedFromRoom);
    socket.on('ownership-transferred', handleOwnershipTransferred);

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('user-removed', handleUserRemoved);
      socket.off('removed-from-room', handleRemovedFromRoom);
      socket.off('ownership-transferred', handleOwnershipTransferred);
    };
  }, [socket, roomId, user?.id, toast, router]);
  

  const handleSendMessage = () => {
    if (!message.trim() || !roomId || !isConnected) {
      if (!isConnected) {
        toast({
          title: "Connection Error",
          description: "Not connected to server. Please refresh the page.",
          variant: "destructive",
        });
      }
      return;
    }
    
    stopTyping();
    sendSocketMessage(message.trim(), roomId);
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Only trigger typing if we have a value and are connected
    if (value.trim() && isConnected) {
      handleTyping();
    } else {
      stopTyping();
    }
  };

  const handleTyping = () => {
    if (!isTyping && isConnected && socket && user && roomId) {
      setIsTyping(true);
      socket.emit('typing', { roomId, userId: user.id, username: user.username });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  };

  const stopTyping = () => {
    if (isTyping && socket && user && roomId) {
      setIsTyping(false);
      socket.emit('stop-typing', { roomId, userId: user.id, username: user.username });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleLeaveRoom = async () => {
    if (roomId) {
      try {
        await leaveRoom(roomId);
        router.push('/');
      } catch (error) {
        console.error('Error leaving room:', error);
        // Still redirect even if there's an error
        router.push('/');
      }
    }
  };

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      toast({
        title: 'Room ID copied!',
        description: 'Share this with others to join the chat.',
      });
    }
  };

  const removeUser = (userIdToRemove: string) => {
    if (!isOwner || !socket || !user) return;
    
    socket.emit('remove-user', {
      roomId,
      userIdToRemove,
      requesterId: user.id,
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


  // Show loading state
  if (!roomId || isLoading || !user) {
    {
      console.log('roomid: ' + roomId, "isloading: ", isLoading, "user: ", user);
    }
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading room...</p>
          {!isConnected && (
            <p className="mt-2 text-sm text-muted-foreground">
              Connecting to server...
            </p>
          )}
        </div>
      </div>
    );
  }

  const currentUser = currentRoom.users.find(u => u.userId === user?.id);
  const isOwner = currentUser?.isOwner || false;

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
                    variant={room.id === currentRoom.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start mb-1 h-auto p-3"
                    onClick={() => {
                      if (room.id !== currentRoom.id) {
                        setCurrentRoom(room.id);
                        router.push(`/chat/${room.id}`);
                      }
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
                <AvatarFallback style={{ backgroundColor: generateColor(user?.username || '') }}>
                  {user?.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <p className="text-xs text-muted-foreground">
                  {isConnected ? 'Online' : 'Offline'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLeaveRoom}>
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
                  {currentRoom.name || 'Chat Room'}
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
                    {currentRoom.users.length} users
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Room Users</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    {currentRoom.users.map((roomUser) => (
                      <div key={roomUser.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback style={{ backgroundColor: generateColor(roomUser.username) }}>
                              {roomUser.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium flex items-center">
                              {roomUser.username}
                              {roomUser.isOwner && <Crown className="h-4 w-4 ml-1 text-yellow-500" />}
                              {roomUser.userId === user?.id && <span className="ml-1 text-xs text-muted-foreground">(You)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {formatTime(roomUser.joinedAt)}
                            </p>
                          </div>
                        </div>
                        {isOwner && roomUser.userId !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUserToRemove(roomUser.userId);
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
              {currentRoom.messages.map((msg, idx) => (
                <div key={msg.id || idx}>
                  {msg.type === 'system' ? (
                    <div className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {msg.content}
                      </Badge>
                    </div>
                  ) : (
                    <div
                      className={`flex flex-col ${
                        msg.userId === user?.id ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.userId === user?.id
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
                            {msg.userId === user?.id ? 'You' : msg.username}
                          </p>
                          <span className="text-xs opacity-70">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Typing indicator */}
              {currentRoom.isTyping && currentRoom.isTyping.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>
                    {currentRoom.isTyping.length === 1 
                      ? `${currentRoom.isTyping[0]} is typing...`
                      : `${currentRoom.isTyping.length} people are typing...`
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
                placeholder={isConnected ? "Type your message..." : "Connecting..."}
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
                onClick={handleSendMessage} 
                disabled={!message.trim() || !isConnected}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
            {!isConnected && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Reconnecting to server...
              </p>
            )}
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