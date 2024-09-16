const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});
console.log('Server initialized');
// Queue and interest storage
const queue = [];
const activeRooms = new Map();

const disconnectUsersInRoom = (io, room) => {
  const usersInRoom = io.sockets.adapter.rooms.get(room);
  if (usersInRoom) {
    for (const socketId of usersInRoom) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    }
  }
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

    // Combine room creation and joining
    socket.on('join or create room', (room) => {
      const roomId = room || generateUniqueRoomId();
      socket.join(roomId);
      socket.emit('room joined', roomId);
    });

    // Optimize chat message handling
    socket.on('chat message', ({ room, message }) => {
      io.to(room).emit('chat message', { sender: socket.id, message });
    });

    // Modify the 'start chatting' event handler
    socket.on('start chatting', (interest) => {
      if (!queue.has(socket.id)) {
        interests.set(socket.id, interest);
        queue.add(socket.id);
        socket.emit('queuing', true);
        checkForMatch();
      } else {
        socket.emit('already queuing');
      }
    });

    // Optimize stop queuing
    socket.on('stop queuing', () => {
      if (queue.delete(socket.id)) {
        socket.emit('removed from queue');
      }
    });

    // Optimize disconnect handling
    socket.on('disconnect', () => {
      console.log(`User ${socket.id} disconnected`);
      
      // Find all rooms this socket was in
      const rooms = [...socket.rooms];
      rooms.forEach(roomId => {
        if (roomId !== socket.id) {  // Ignore the room that's automatically created for each socket
          const room = io.sockets.adapter.rooms.get(roomId);
          if (room) {
            // Notify other users in the room
            room.forEach(clientId => {
              if (clientId !== socket.id) {
                io.to(clientId).emit('partner disconnected', {
                  message: 'Your chat partner has disconnected.'
                });
              }
            });
          }
        }
      });
      
      // Check if the user was in a room
      if (socket.room) {
        const room = io.sockets.adapter.rooms.get(socket.room);
        
        // If there's only one user left in the room after this disconnect
        if (room && room.size === 1) {
          // Disconnect all users in the room
          io.in(socket.room).disconnectSockets(true);
          
          console.log(`All users disconnected from room ${socket.room}`);
        }
      }
      
      // Check all rooms the user was in
      socket.rooms.forEach(roomId => {
        if (roomId !== socket.id) {
          checkRoom(roomId);
        }
      });
      
      handleDisconnect(socket);
    });

    // ... other event handlers ...

    // Optimize checkForMatch function
    function checkForMatch() {
      if (queue.size < 2) return;

      const users = Array.from(queue);
      for (let i = 0; i < users.length - 1; i++) {
        for (let j = i + 1; j < users.length; j++) {
          if (interests.get(users[i]) === interests.get(users[j])) {
            matchUsers(users[i], users[j]);
            return;
          }
        }
      }

      // If no interest match, match first two users
      matchUsers(users[0], users[1]);
    }

    function matchUsers(user1Id, user2Id) {
      const room = `room-${user1Id}-${user2Id}`;
      [user1Id, user2Id].forEach(userId => {
        const userSocket = io.sockets.sockets.get(userId);
        if (userSocket) {
          queue.delete(userId);
          userSocket.join(room);
          userSocket.room = room; // Store the room in the socket object
          userSocket.emit('matched', room);
          userSocket.emit('queuing', false);
        }
      });
      console.log(`Users ${user1Id} and ${user2Id} matched in room ${room}`);
    }

    // Add a new event handler for leaving a chat
    socket.on('leave chat', () => {
      if (socket.room) {
        socket.leave(socket.room);
        checkRoom(socket.room);
        socket.room = null; // Clear the room from the socket object
      }
    });

    // ... other helper functions ...

    function checkRoom(roomId) {
      const room = io.sockets.adapter.rooms.get(roomId);
      if (!room || room.size <= 1) {
        // Emit a 'reload page' event to all sockets in the room
        io.in(roomId).emit('reload page');
        console.log(`Emitted reload page event for room ${roomId}`);
      }
    }

    // Modify the 'leave room' event handler
    socket.on('leave room', (roomId) => {
      console.log(`User ${socket.id} is leaving room ${roomId}`);
      
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room) {
        // Get the other user in the room
        const otherUser = Array.from(room).find(id => id !== socket.id);
        
        // Notify the other user that this user is leaving
        if (otherUser) {
          io.to(otherUser).emit('partner left', { message: 'Your chat partner has left the room.' });
        }
        
        // Remove the user from the room
        socket.leave(roomId);
        
        // Check if the room is now empty
        if (room.size === 0) {
          console.log(`Room ${roomId} is now empty and will be deleted.`);
        } else if (room.size === 1) {
          console.log(`Only one user left in room ${roomId}.`);
        }
      }
      
      // Notify the leaving user that they've successfully left
      socket.emit('left room', { message: 'You have left the room.' });
      
      // ... any other leave room logic ...
    });

    // ... rest of the code ...

    // Add a new event handler for typing
    socket.on('typing', ({ room }) => {
      console.log(`User ${socket.id} is typing in room ${room}`);
      socket.to(room).emit('user typing', socket.id);
    });

    // ... other event handlers ...

    // Optimize checkForMatch function
    function checkForMatch() {
      if (queue.size < 2) return;

      const users = Array.from(queue);
      for (let i = 0; i < users.length - 1; i++) {
        for (let j = i + 1; j < users.length; j++) {
          if (interests.get(users[i]) === interests.get(users[j])) {
            matchUsers(users[i], users[j]);
            return;
          }
        }
      }

      // If no interest match, match first two users
      matchUsers(users[0], users[1]);
    }

    function matchUsers(user1Id, user2Id) {
      const room = `room-${user1Id}-${user2Id}`;
      [user1Id, user2Id].forEach(userId => {
        const userSocket = io.sockets.sockets.get(userId);
        if (userSocket) {
          queue.delete(userId);
          userSocket.join(room);
          userSocket.room = room; // Store the room in the socket object
          userSocket.emit('matched', room);
          userSocket.emit('queuing', false);
        }
      });
      console.log(`Users ${user1Id} and ${user2Id} matched in room ${room}`);
    }

    // Add a new event handler for leaving a chat
    socket.on('leave chat', () => {
      if (socket.room) {
        socket.leave(socket.room);
        checkRoom(socket.room);
        socket.room = null; // Clear the room from the socket object
      }
    });
  // When a user starts typing
  socket.on('typing', ({ room }) => {
    // Broadcast to everyone else in the room that this user is typing
    socket.to(room).emit('user typing');
  });

  // When a user stops typing
  socket.on('stopped typing', ({ room }) => {
    // Broadcast to everyone else in the room that this user stopped typing
    socket.to(room).emit('user stopped typing');
  });

    // ... other helper functions ...

    function checkRoom(roomId) {
      const room = io.sockets.adapter.rooms.get(roomId);
      if (!room || room.size <= 1) {
        // Emit a 'reload page' event to all sockets in the room
        io.in(roomId).emit('reload page');
        console.log(`Emitted reload page event for room ${roomId}`);
      }
    }

    // Modify the 'leave room' event handler
    socket.on('leave room', (roomId) => {
      console.log(`User ${socket.id} is leaving room ${roomId}`);
      
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room) {
        // Get the other user in the room
        const otherUser = Array.from(room).find(id => id !== socket.id);
        
        // Notify the other user that this user is leaving
        if (otherUser) {
          io.to(otherUser).emit('partner left', { message: 'Your chat partner has left the room.' });
        }
        
        // Remove the user from the room
        socket.leave(roomId);
        
        // Check if the room is now empty
        if (room.size === 0) {
          console.log(`Room ${roomId} is now empty and will be deleted.`);
        } else if (room.size === 1) {
          console.log(`Only one user left in room ${roomId}.`);
        }
      }
      
      // Notify the leaving user that they've successfully left
      socket.emit('left room', { message: 'You have left the room.' });
      
      // ... any other leave room logic ...
    });

    // ... rest of the code ...
  });

  function handleDisconnect(socket) {
    queue.delete(socket.id);
    interests.delete(socket.id);
    for (const [roomId, users] of rooms) {
      if (users.delete(socket.id)) {
        if (users.size === 1) {
          const [partnerId] = users;
          io.sockets.sockets.get(partnerId)?.disconnect(true);
        }
        if (users.size === 0) {
          rooms.delete(roomId);
        }
        break;
      }
    }
  }

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
