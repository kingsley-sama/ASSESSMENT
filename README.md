# JoyRoom - Real-time Chat Application

A modern, real-time chat application built with Next.js, Socket.IO, Prisma, and MongoDB.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB database (local or cloud)

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/kingsley-sama/ASSESSMENT
   cd ASSESSMENT
   npm i --legacy-peer-deps
   ```

2. **Database Setup**
   
   **Option A: Using Docker (Recommended)**
   ```bash
   # Run MongoDB with replica set
   docker run -d --name mongodb -p 27017:27017 mongo:latest --replSet rs0
   docker exec -it mongodb mongosh --eval "rs.initiate()"
   ```
   
   **Option B: Local MongoDB**
   If using local MongoDB, you must configure replica set in `/etc/mongod.conf`:
   ```yaml
   replication:
     replSetName: "rs0"
   ```
   Then restart MongoDB and initialize replica set:
   ```bash
   sudo systemctl restart mongod
   mongosh --eval "rs.initiate()"
   ```

3. **Environment Setup**
   Create `.env` file:
   ```env
   DATABASE_URL="mongodb://localhost:27017/joyroom"
   NEXT_PUBLIC_SOCKET_URL="http://localhost:3000"
   ```

4. **Database Schema**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the Application**
   ```bash
   npm run dev:socket
   ```
   
   Open [http://localhost:3000](http://localhost:3000)

## ⚠️ Important Notes

- **Installation**: Use `npm i --legacy-peer-deps` for dependency installation
- **MongoDB**: Prisma requires MongoDB replica set - use Docker or configure `/etc/mongod.conf`
- **Running**: Use `npm run dev:socket` to start the application with Socket.IO server

## 🧪 Testing

```bash
npx playwright install
npm run test:e2e
```

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
## ✨ Features

- Real-time messaging with Socket.IO
- Create and join chat rooms
- User typing indicators  
- Message persistence with MongoDB
- Dark mode support
- Emoji picker
- Room ownership and user management
- End-to-end testing with Playwright

## 📄 License

MIT License

---

Built with ❤️ using Next.js, Socket.IO, Prisma, and MongoDB.
