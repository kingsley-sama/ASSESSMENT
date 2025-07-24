'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChatStore } from '@/store/chatStore';
import { toast } from 'sonner';
import { Loader2, MessageCircle, Plus, Users } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export default function HomeClient() {
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const { setUser, createRoom, joinRoom, initializeSocket, isLoading, error, clearError } = useChatStore();
  const router = useRouter();

  useEffect(() => {
    initializeSocket();
  }, [initializeSocket]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsCreating(true);
    try {
      // Set user first
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setUser({ id: userId, username: username.trim() });
      
      // Create room
      const newRoomId = await createRoom(roomName.trim(), username.trim());
      
      toast.success('Room created successfully!');
      router.push(`/chat/${newRoomId}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsJoining(true);
    try {
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setUser({ id: userId, username: username.trim() });
      
  
      await joinRoom(roomId.trim(), username.trim());
      
      toast.success('Joined room successfully!');
      router.push(`/chat/${roomId.trim()}`);
    } catch (error) {
      console.error('Error joining room:', error);
      toast.error('Failed to join room. Please check the room ID and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            JoyRoom
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
                        Welcome to JoyRoom
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Get Started</CardTitle>
            <CardDescription className="text-center">
              Create a new room or join an existing one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create
                </TabsTrigger>
                <TabsTrigger value="join" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Join
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-4">
                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-username">Your Name</Label>
                    <Input
                      id="create-username"
                      type="text"
                      placeholder="Enter your name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isCreating || isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-name">Room Name</Label>
                    <Input
                      id="room-name"
                      type="text"
                      placeholder="Enter room name"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      disabled={isCreating || isLoading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isCreating || isLoading}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Room...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Room
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join" className="space-y-4">
                <form onSubmit={handleJoinRoom} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="join-username">Your Name</Label>
                    <Input
                      id="join-username"
                      type="text"
                      placeholder="Enter your name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isJoining || isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room-id">Room ID</Label>
                    <Input
                      id="room-id"
                      type="text"
                      placeholder="Enter room ID"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      disabled={isJoining || isLoading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isJoining || isLoading}
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining Room...
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 mr-2" />
                        Join Room
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Property of Javat 365</p>
        </div>
      </div>
    </div>
  );
}
