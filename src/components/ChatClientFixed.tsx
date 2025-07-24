"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useChatStore } from "@/store/chatStore"
import { useToast } from "@/hooks/use-toast"
import { LogOut, Send, Copy, MessageSquare, Users, Crown, Smile, Menu, X } from "lucide-react"
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

  // State
  const [roomId, setRoomId] = useState<string>("")
  const [message, setMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userInitialized, setUserInitialized] = useState(false)

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
    setUser,
  } = useChatStore()

  // Initialize params
  useEffect(() => {
    if (params?.roomId) {
      setRoomId(params.roomId as string)
    }
  }, [params])

  // Initialize user from localStorage
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
          setTimeout(() => router.push("/"), 1000)
        }
      } else {
        console.log("No user found in localStorage, redirecting to home")
        setTimeout(() => router.push("/"), 1000)
      }
    }
  }, [user, userInitialized, setUser, router])

  // Initialize socket
  useEffect(() => {
    if (!socket || !socket.connected) {
      initializeSocket()
    }
  }, [socket, initializeSocket])

  // Join room
  useEffect(() => {
    if (roomId && user && isConnected) {
      if (currentRoom?.id !== roomId) {
        console.log("Attempting to join room:", roomId, "with user:", user.username)
        joinRoom(roomId, user.username).catch((error) => {
          console.error("Failed to join room:", error)
          toast({
            title: "Error",
            description: "Failed to join room. Redirecting to home.",
            variant: "destructive",
          })
          router.push("/")
        })
      }
    }
  }, [roomId, user, isConnected, currentRoom?.id, joinRoom, router, toast])

  // Debug logging
  useEffect(() => {
    console.log('=== DEBUG INFO ===')
    console.log('Current room:', currentRoom)
    console.log('Messages count:', currentRoom?.messages?.length || 0)
    console.log('Messages:', currentRoom?.messages)
    console.log('Socket connected:', isConnected)
    console.log('User:', user)
    console.log('Room ID:', roomId)
    console.log('================')
  }, [currentRoom, isConnected, user, roomId])

  // Auto scroll to bottom
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

  // Message handlers
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

    console.log("Sending message:", message.trim(), "to room:", roomId)
    sendSocketMessage(message.trim(), roomId)
    setMessage("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value)
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

  // Loading states
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
          <p className="mt-4 text-lg">Loading room data...</p>
          {!isConnected && <p className="mt-2 text-sm text-muted-foreground">Connecting to server...</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Chat Room</h2>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleLeaveRoom} title="Leave Room">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {currentRoom.name}
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
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-hidden p-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Users className="h-4 w-4" />
            Users ({currentRoom.users?.length || 0})
          </h3>

          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-2">
              {currentRoom.users?.map((roomUser) => (
                <div key={roomUser.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      style={{ backgroundColor: generateColor(roomUser.username) }}
                      className="text-white text-xs font-medium"
                    >
                      {roomUser.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{roomUser.username}</span>
                      {roomUser.id === currentRoom.ownerId && <Crown className="h-3 w-3 text-yellow-500" />}
                      {roomUser.id === user?.id && (
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          You
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{currentRoom.name}</h1>
              <p className="text-sm text-muted-foreground">{currentRoom.users?.length || 0} members</p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="h-full p-4">
            <div className="space-y-4">
              {!currentRoom.messages || currentRoom.messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                  <p className="text-xs mt-2">
                    Debug: Room has {currentRoom.messages?.length || 0} messages
                  </p>
                  <p className="text-xs">Room ID: {currentRoom.id}</p>
                  <p className="text-xs">User ID: {user?.id}</p>
                </div>
              ) : (
                currentRoom.messages.map((msg, index) => {
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
                              {msg.username?.slice(0, 2).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-8 w-8" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div
                        className={`flex-1 max-w-[70%] ${isCurrentUser ? "text-right" : "text-left"}`}
                      >
                        {showAvatar && (
                          <div
                            className={`flex items-center gap-2 mb-1 ${isCurrentUser ? "justify-end" : "justify-start"}`}
                          >
                            <span className="text-sm font-medium">{msg.username || 'Unknown User'}</span>
                            <span className="text-xs text-muted-foreground">
                              {msg.createdAt ? formatTime(msg.createdAt) : 'Unknown time'}
                            </span>
                          </div>
                        )}

                        <div
                          className={`inline-block p-3 rounded-lg max-w-full break-words ${
                            isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content || 'Empty message'}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
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
    </div>
  )
}
