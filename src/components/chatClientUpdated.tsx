"use client"

import type React from "react"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useChatStore } from "@/store/chatStore"
import { useToast } from "@/hooks/use-toast"
import { LogOut, Send, Copy, MessageSquare, Users, Crown, UserX, Smile, Menu, X } from "lucide-react"
import { EmojiPicker } from "@/components/EmojiPicker"
import { ThemeToggle } from "@/components/ThemeToggle"

const generateColor = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 60%)`
}

const formatTime = (timestamp: string | Date) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function ChatClient() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Handle async params
  const [roomId, setRoomId] = useState<string>("")
  const [message, setMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [userToRemove, setUserToRemove] = useState<string | null>(null)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userInitialized, setUserInitialized] = useState(false) // Track if we've tried to initialize user

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
    setUser, // Add setUser to the destructured properties
  } = useChatStore()

  // Handle async params resolution
  useEffect(() => {
    if (params?.roomId) {
      setRoomId(params.roomId as string)
    }
  }, [params])

  // Initialize user from localStorage if not already set
  useEffect(() => {
    if (!user && !userInitialized) {
      setUserInitialized(true)
      const storedUser = localStorage.getItem("user")
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser)
          setUser(userData)
          console.log("User restored from localStorage:", userData)
        } catch (error) {
          console.error("Error parsing stored user data:", error)
          localStorage.removeItem("user")
          // Redirect to home to set up user if localStorage is corrupted
          setTimeout(() => router.push("/"), 1000)
        }
      } else {
        console.log("No user found in localStorage, redirecting to home")
        // No user data found, redirect to setup after a short delay
        setTimeout(() => router.push("/"), 1000)
      }
    }
  }, [user, userInitialized, setUser, router])

  // Initialize socket once
  useEffect(() => {
    if (!socket) {
      initializeSocket()
    }
  }, [socket])

  // Load user rooms when user is available (only once)
  useEffect(() => {
    if (user && rooms.length === 0) {
      loadUserRooms()
    }
  }, [user])

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
      clearError()
    }
  }, [error, toast])

  // Join room when roomId is available and socket is connected
  useEffect(() => {
    if (roomId && user && isConnected) {
      // Check if we're already in this room
      if (currentRoom?.id !== roomId) {
        joinRoom(roomId, user.username).catch((error) => {
          console.error("Failed to join room:", error)
          toast({
            title: "Error",
            description: "Failed to join room. Redirecting to home.",
            variant: "destructive",
          })
          setTimeout(() => router.push("/"), 2000)
        })
      } else {
        setCurrentRoom(roomId)
      }
    }
  }, [roomId, user, isConnected, currentRoom?.id, router, toast])

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [currentRoom?.messages, scrollToBottom])

  useEffect(() => {
    if (!socket || !roomId) return

    const handleUserJoined = ({
      username,
      userId,
      joinedAt,
    }: { username: string; userId: string; joinedAt: string }) => {
      toast({
        title: "User joined",
        description: `${username} joined the room`,
      })
    }

    const handleUserLeft = ({ userId, username }: { userId: string; username: string }) => {
      toast({
        title: "User left",
        description: `${username} left the room`,
      })
    }

    const handleUserRemoved = ({ userId, username }: { userId: string; username: string }) => {
      if (userId === user?.id) {
        toast({
          title: "Removed from room",
          description: "You have been removed from this room",
          variant: "destructive",
        })
        router.push("/")
      } else {
        toast({
          title: "User removed",
          description: `${username} was removed from the room`,
        })
      }
    }

    const handleRemovedFromRoom = ({ roomId: removedRoomId }: { roomId: string }) => {
      if (removedRoomId === roomId) {
        toast({
          title: "Removed from room",
          description: "You have been removed from this room",
          variant: "destructive",
        })
        router.push("/")
      }
    }

    const handleOwnershipTransferred = ({
      newOwnerId,
      newOwnerUsername,
    }: { newOwnerId: string; newOwnerUsername: string }) => {
      toast({
        title: "New room owner",
        description: `${newOwnerUsername} is now the room owner`,
      })
    }

    socket.on("user-joined", handleUserJoined)
    socket.on("user-left", handleUserLeft)
    socket.on("user-removed", handleUserRemoved)
    socket.on("removed-from-room", handleRemovedFromRoom)
    socket.on("ownership-transferred", handleOwnershipTransferred)

    // Handle socket errors
    const handleSocketError = (error: string) => {
      console.error("Socket error:", error)
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive",
      })
    }

    socket.on("error", handleSocketError)

    return () => {
      socket.off("user-joined", handleUserJoined)
      socket.off("user-left", handleUserLeft)
      socket.off("user-removed", handleUserRemoved)
      socket.off("removed-from-room", handleRemovedFromRoom)
      socket.off("ownership-transferred", handleOwnershipTransferred)
      socket.off("error", handleSocketError)
    }
  }, [socket, roomId, user?.id, toast, router])

  // Add debug logging for messages
  useEffect(() => {
    console.log("Current room messages:", currentRoom?.messages?.length || 0)
    console.log("Socket connected:", isConnected)
    console.log("Current room ID:", currentRoom?.id)
    console.log("Target room ID:", roomId)
  }, [currentRoom?.messages, isConnected, currentRoom?.id, roomId])

  const handleTyping = () => {
    if (!isTyping && isConnected && socket && user && roomId) {
      setIsTyping(true)
      socket.emit("typing", { roomId, userId: user.id, username: user.username })
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping()
    }, 1000)
  }

  const stopTyping = () => {
    if (isTyping && socket && user && roomId) {
      setIsTyping(false)
      socket.emit("stop-typing", { roomId, userId: user.id, username: user.username })
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }
  

  const handleSendMessage = () => {
    if (!message.trim() || !roomId || !isConnected) {
      if (!isConnected) {
        toast({
          title: "Connection Error",
          description: "Not connected to server. Please refresh the page.",
          variant: "destructive",
        })
      }
      return
    }

    stopTyping()
    sendSocketMessage(message.trim(), roomId)
    setCurrentRoom(roomId)
    setMessage("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessage(value)

    // Only trigger typing if we have a value and are connected
    if (value.trim() && isConnected) {
      handleTyping()
    } else {
      stopTyping()
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji)
    setShowEmojiPicker(false)
    inputRef.current?.focus()
  }

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId)
      toast({
        title: "Copied!",
        description: "Room ID copied to clipboard",
      })
    }
  }

  const handleLeaveRoom = () => {
    if (roomId) {
      leaveRoom(roomId)
      router.push("/")
    }
  }

  const removeUser = (userIdToRemove: string) => {
    if (!socket || !user) return
    
    // Call API to remove user
    fetch(`/api/rooms/${roomId}/users/${userIdToRemove}?requesterId=${user.id}`, {
      method: 'DELETE',
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to remove user');
      }
      return response.json();
    })
    .then(() => {
      toast({
        title: "User removed",
        description: "User has been removed from the room",
      });
    })
    .catch(error => {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user",
        variant: "destructive",
      });
    });
    
    // Also emit socket event for real-time updates
    socket.emit('remove-user', {
      roomId,
      userIdToRemove,
      requesterId: user.id,
    });
    
    setShowRemoveDialog(false);
    setUserToRemove(null);
  }


  // Show loading state - improved conditions
  if (!roomId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading room...</p>
        </div>
      </div>
    )
  }

  if (!user && userInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">No user session found</p>
          <p className="mt-2 text-sm text-muted-foreground">Redirecting to home page...</p>
        </div>
      </div>
    )
  }

  if (!user && !userInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Setting up user session...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Joining room...</p>
          {!isConnected && <p className="mt-2 text-sm text-muted-foreground">Connecting to server...</p>}
        </div>
      </div>
    )
  }

  if (!currentRoom) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading room...</p>
          {!isConnected && <p className="mt-2 text-sm text-muted-foreground">Connecting to server...</p>}
        </div>
      </div>
    )
  }

  const currentUser = currentRoom.users.find(u => u.userId === user?.id)
  const isOwner = currentUser?.isOwner || false

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        w-80 lg:w-80 md:w-16 lg:translate-x-0 transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        border-r bg-card flex flex-col
      `}
      >
        {/* Header */}
        <div className="p-4 lg:p-4 md:p-2 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold lg:block md:hidden">Chat Rooms</h2>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLeaveRoom}
                title="Leave Room"
                className="lg:inline-flex md:inline-flex"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              {/* Mobile close button */}
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="lg:hidden">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2 lg:block md:hidden">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {currentRoom.name || `Room ${roomId.slice(-6)}`}
              </Badge>
              <Button variant="ghost" size="icon" onClick={copyRoomId} className="h-6 w-6" title="Copy Room ID">
                <Copy className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
              {isConnected ? "Connected" : "Disconnected"}
            </div>
          </div>

          {/* Mobile-only connection indicator */}
          <div className="lg:hidden md:block hidden">
            <div className={`w-3 h-3 rounded-full mx-auto ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          </div>
        </div>

        {/* Rooms List */}
        <div className="border-b lg:block md:hidden">
          <div className="p-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Your Rooms ({rooms.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {rooms.map((room) => (
                <Button
                  key={room.id}
                  variant={room.id === currentRoom.id ? "secondary" : "ghost"}
                  className="w-full justify-start text-left h-auto p-2"
                  onClick={() => {
                    if (room.id !== currentRoom.id) {
                      router.push(`/chat/${room.id}`)
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-xs">
                      {room.name || `Room ${room.id.slice(-6)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {room.users.length} {room.users.length === 1 ? "member" : "members"}
                    </div>
                  </div>
                  {room.unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 text-xs">
                      {room.unreadCount}
                    </Badge>
                  )}
                </Button>
              ))}
              {rooms.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No rooms yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Rooms List */}
        <div className="border-b lg:hidden md:block hidden">
          <div className="p-2">
            <div className="flex flex-col items-center space-y-2">
              <MessageSquare className="h-4 w-4" />
              <div className="text-xs text-center font-medium">{rooms.length}</div>
            </div>
            <div className="space-y-1 mt-2">
              {rooms.slice(0, 3).map((room) => (
                <Button
                  key={room.id}
                  variant={room.id === currentRoom.id ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full p-1"
                  onClick={() => {
                    if (room.id !== currentRoom.id) {
                      router.push(`/chat/${room.id}`)
                    }
                  }}
                  title={room.name || `Room ${room.id.slice(-6)}`}
                >
                  <div className="w-2 h-2 rounded-full bg-primary mx-auto"></div>
                  {room.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full text-[8px] flex items-center justify-center text-white">
                      {room.unreadCount > 9 ? '9+' : room.unreadCount}
                    </div>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-hidden">
          <div className="p-4 lg:p-4 md:p-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium flex items-center gap-2 lg:flex md:hidden">
                <Users className="h-4 w-4" />
                Users ({currentRoom.users?.length || 0})
              </h3>
              {/* Mobile users icon only */}
              <div className="lg:hidden md:block hidden">
                <Users className="h-4 w-4 mx-auto" />
              </div>
            </div>

            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-2">
                {currentRoom.users?.map((roomUser) => (
                  <div
                    key={roomUser.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors lg:flex md:justify-center"
                  >
                    <Avatar className="h-8 w-8 lg:h-8 lg:w-8 md:h-6 md:w-6">
                      <AvatarFallback
                        style={{ backgroundColor: generateColor(roomUser.username) }}
                        className="text-white text-xs font-medium"
                      >
                        {roomUser.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 lg:block md:hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{roomUser.username}</span>
                        {roomUser.isOwner && <Crown className="h-3 w-3 text-yellow-500" />}
                        {roomUser.userId === user?.id && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            You
                          </Badge>
                        )}
                      </div>
                      {isOwner && roomUser.userId !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUserToRemove(roomUser.userId)
                            setShowRemoveDialog(true)
                          }}
                          className="mt-1 h-6 text-xs"
                        >
                          <UserX className="h-3 w-3 text-destructive mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Join New Room Button */}
        <div className="p-4 border-t mt-auto lg:block md:hidden">
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => router.push('/')}
            size="sm"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Join New Room
          </Button>
        </div>

        {/* Mobile Join Button */}
        <div className="p-2 border-t mt-auto lg:hidden md:block hidden">
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => router.push('/')}
            size="sm"
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col lg:ml-0 md:ml-16">
        {/* Chat Header */}
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="lg:hidden">
                <Menu className="h-4 w-4" />
              </Button>

              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  {currentRoom.name || `Room ${roomId.slice(-6)}`}
                  {isOwner && <Crown className="h-5 w-5 text-yellow-500" />}
                </h1>
                <p className="text-sm text-muted-foreground">{currentRoom.users?.length || 0} members</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="h-full p-4">
            <div className="space-y-4">
              {currentRoom.messages?.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                currentRoom.messages?.map((msg, index) => {
                  const isCurrentUser = msg.userId === user?.id
                  const showAvatar = index === 0 || currentRoom.messages[index - 1]?.userId !== msg.userId

                  return (
                    <div
                      key={msg.id || index}
                      className={`flex gap-3 ${isCurrentUser ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {showAvatar ? (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback
                              style={{ backgroundColor: generateColor(msg.username) }}
                              className="text-white text-xs font-medium"
                            >
                              {msg.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-8 w-8" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div
                        className={`flex-1 max-w-[70%] sm:max-w-[85%] ${isCurrentUser ? "text-right" : "text-left"}`}
                      >
                        {showAvatar && (
                          <div
                            className={`flex items-center gap-2 mb-1 ${isCurrentUser ? "justify-end" : "justify-start"}`}
                          >
                            <span className="text-sm font-medium">{msg.username}</span>
                            <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
                          </div>
                        )}

                        <div
                          className={`inline-block p-3 rounded-lg max-w-full break-words ${
                            isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              {/* Typing indicator */}
              {currentRoom.isTyping && currentRoom.isTyping.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span>
                    {currentRoom.isTyping.length === 1
                      ? `${currentRoom.isTyping[0]} is typing...`
                      : `${currentRoom.isTyping.length} people are typing...`}
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Message Input */}
        <div className="p-4 border-t bg-card">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={message}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="pr-12"
                disabled={!isConnected}
              />

              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    type="button"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleSendMessage} disabled={!message.trim() || !isConnected} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {!isConnected && (
            <p className="text-xs text-destructive mt-2">Disconnected from server. Please refresh the page.</p>
          )}
        </div>
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
  )
}