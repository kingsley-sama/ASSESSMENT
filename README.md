# JoyRoom - Real-time Chat Application

A modern, feature-rich real-time chat application built with Next.js, Socket.IO, Prisma, and MongoDB. This application supports multiple rooms, real-time messaging, typing indicators, user management, and much more.

## ✨ Features

### Core Features
- **Real-time messaging** with Socket.IO
- **Create and join chat rooms** with unique room IDs
- **Multiple room support** - join multiple rooms simultaneously
- **User typing indicators** - see when someone is typing
- **User join/leave notifications** - system messages for user activity
- **Message persistence** with MongoDB and Prisma

### User Management
- **Room ownership** - creators become room owners
- **Remove users** - room owners can remove other users
- **User list display** - modal showing all room participants
- **Ownership transfer** - automatic transfer when owner leaves
- **Room lifecycle management** - rooms are deleted when empty

### UI/UX Features
- **Dark mode support** with next-themes
- **Emoji picker** - add emojis to messages
- **Random avatar colors** - unique colors for each user
- **Responsive design** - works on desktop and mobile
- **Real-time connection status** - see when users are online/offline
- **Copy room ID** - easy sharing of room links
- **Toast notifications** - user-friendly feedback
- **Typing animations** - visual typing indicators

### Technical Features
- **End-to-end testing** with Playwright
- **TypeScript** - fully typed codebase
- **Error handling** - comprehensive error management
- **Optimistic updates** - smooth user experience
- **Performance optimized** - efficient re-renders and state management

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun
- MongoDB database (local or cloud)
- npm, yarn, or bun package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kingsley-sama/ASSESSMENT
   cd ASSESSMENT
   ```

2. **Install dependencies**
   ```bash
   # install dependencies
   npm install  --legacy-peer-deps
   ```
   
3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="mongodb://localhost:27017/joyroom"
   # or for MongoDB Atlas:
   # DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/joyroom"
   
   # Socket.IO (optional - defaults to localhost:3001)
   NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Push database schema (for development)
   npx prisma db push
   
   # Or run migrations (for production)
   npx prisma migrate deploy
   ```

5. **Run the development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3001)

### Testing

Run the end-to-end tests with Playwright:

```bash
npx playwright install --legacy-peer-deps
# Run tests
npm run test:e2e
# or
npx playwright test

# Run tests with UI
npx playwright test --ui
```

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── socket.ts      # Socket.IO server
│   │   └── rooms/         # Room management APIs
│   ├── chat/[roomId]/     # Chat room pages
│   ├── layout.tsx         # Root layout with theme provider
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── ChatClient.tsx    # Main chat interface
│   ├── HomeClient.tsx    # Home page component
│   ├── EmojiPicker.tsx   # Emoji selection component
│   └── ThemeToggle.tsx   # Dark/light mode toggle
├── lib/                  # Utilities
│   ├── socket.ts         # Socket.IO client setup
│   └── utils.ts          # Utility functions
├── store/                # State management
│   └── chatStore.ts      # Zustand store for chat state
└── hooks/                # Custom React hooks
    └── use-toast.ts      # Toast notification hook

prisma/
└── schema.prisma         # Database schema

tests/
└── chat.spec.ts          # Playwright E2E tests
```

## 🔧 Configuration

### Database Schema

The application uses the following MongoDB collections:

- **rooms** - Chat room information
- **room_users** - User membership in rooms
- **messages** - Chat messages with metadata

### Socket.IO Events

**Client → Server:**
- `join-room` - Join a chat room
- `send-message` - Send a message
- `user-typing` - Indicate typing status
- `user-stop-typing` - Stop typing indication
- `leave-room` - Leave a room
- `remove-user` - Remove user (owner only)

**Server → Client:**
- `room-joined` - Room join confirmation
- `receive-message` - New message received
- `user-joined` - User joined notification
- `user-left` - User left notification
- `user-typing` - Someone is typing
- `user-stop-typing` - Someone stopped typing
- `users-updated` - User list updated
- `ownership-transferred` - Room ownership changed
- `removed-from-room` - User was removed

## 🎨 Customization

### Themes
The application supports light and dark themes using next-themes. You can customize the color scheme by modifying the CSS variables in `globals.css`.

### Emoji Categories
Add or modify emoji categories in `components/EmojiPicker.tsx` to customize the emoji picker.

### Avatar Colors
The avatar color generation algorithm is in `components/ChatClient.tsx`. You can modify the `generateColor` function to change how user colors are assigned.

## 🧪 Testing Strategy

The test suite covers:

1. **Room Creation & Joining**
   - Creating new rooms
   - Joining existing rooms
   - Error handling for invalid room IDs

2. **Real-time Messaging**
   - Sending and receiving messages
   - Message persistence
   - Multiple user conversations

3. **User Interactions**
   - Typing indicators
   - User join/leave notifications
   - User list management

4. **Room Management**
   - User removal by owners
   - Ownership transfer
   - Room lifecycle (creation/deletion)

5. **UI Features**
   - Copy room ID functionality
   - Theme switching
   - Error state handling

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Manual Deployment
1. Build the application:
   ```bash
   npm run build
   ```
2. Set up MongoDB production database
3. Configure environment variables
4. Deploy to your hosting platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new features
5. Submit a pull request

## 📝 Design Decisions

### State Management
- **Zustand** for client-side state management
- **Real-time synchronization** between client state and server
- **Optimistic updates** for better user experience

### Database Design
- **MongoDB** for flexible document storage
- **Prisma** for type-safe database operations
- **Normalized schema** for efficient queries

### Real-time Communication
- **Socket.IO** for reliable real-time communication
- **Room-based messaging** for scalability
- **Event-driven architecture** for clean separation of concerns

### UI/UX Principles
- **Responsive design** for all device sizes
- **Accessible** with proper ARIA labels and keyboard navigation
- **Consistent design system** using shadcn/ui
- **Performance optimized** with React best practices

## 🔮 Future Enhancements

- **File sharing** - Upload and share images/documents
- **Message reactions** - React to messages with emojis
- **Voice/video calls** - WebRTC integration
- **Message search** - Search through message history
- **User profiles** - Customizable user profiles
- **Room categories** - Organize rooms by topics
- **Moderation tools** - Advanced moderation features
- **Mobile app** - React Native mobile application

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

1. **Socket connection fails**
   - Check if the server is running on the correct port
   - Verify CORS settings in socket configuration

2. **Database connection errors**
   - Ensure MongoDB is running
   - Check DATABASE_URL format
   - Verify database permissions

3. **Build errors**
   - Clear node_modules and reinstall dependencies
   - Check TypeScript errors
   - Verify all environment variables are set

4. **Tests failing**
   - Ensure the development server is running
   - Check if Playwright browsers are installed
   - Verify test database is accessible

### Getting Help

- Check the issues section for known problems
- Review the documentation for configuration options
- Test with the provided examples
- Check browser console for error messages

---

Built with ❤️ using Next.js, Socket.IO, Prisma, and MongoDB.
