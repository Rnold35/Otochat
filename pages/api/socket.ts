import { Server } from 'socket.io';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as NetServer } from 'http';
import { Socket as NetSocket } from 'net';

interface SocketServer extends NetServer {
  io?: Server;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

// Queue and interest storage
const queue: { id: string, interest: string }[] = [];
const activeRooms = new Map<string, Set<string>>();

function checkForMatch(io: Server) {
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      if (queue[i].interest === queue[j].interest) {
        const user1 = queue[i];
        const user2 = queue[j];

        // Remove matched users from the queue
        queue.splice(j, 1);
        queue.splice(i, 1);

        const room = `room-${user1.id}-${user2.id}`;

        io.to(user1.id).socketsJoin(room);
        io.to(user2.id).socketsJoin(room);

        io.to(user1.id).emit('matched', room);
        io.to(user2.id).emit('matched', room);

        io.to(user1.id).emit('queuing', false);
        io.to(user2.id).emit('queuing', false);

        console.log(`Users ${user1.id} and ${user2.id} matched in room ${room} with interest: ${user1.interest}`);
        return; // Exit after successful match
      }
    }
  }
}



export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket) return;

  const socket = res.socket as SocketWithIO;

  if (!socket.server.io) {
    console.log('Initializing Socket.IO server...');
    const io = new Server(socket.server);
    socket.server.io = io;

    const disconnectUsersInRoom = (io: Server, room: string) => {
      const users = activeRooms.get(room);
      if (users) {
        users.forEach(userId => {
          const userSocket = io.sockets.sockets.get(userId);
          if (userSocket) {
            userSocket.leave(room);
            userSocket.emit('chat ended');
          }
        });
        activeRooms.delete(room);
        console.log(`Room ${room} closed and users disconnected`);
      }
    }

    io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      socket.on('start chatting', (interest: string) => {
        const existingUser = queue.find(user => user.id === socket.id);
        if (!existingUser) {
          console.log('User added to the queue:', socket.id, 'with interest:', interest);
          queue.push({ id: socket.id, interest });
          socket.emit('queuing', true);
          checkForMatch(io);
        } else {
          console.log('User already in queue:', socket.id);
          socket.emit('already queuing');
        }
      });

      socket.on('chat message', ({ room, message }) => {
        socket.to(room).emit('chat message', {
          sender: socket.id,
          message,
        });
      });

      socket.on('leave room', (room) => {
        console.log(`User ${socket.id} leaving room: ${room}`);
        socket.leave(room);
        disconnectUsersInRoom(io, room);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // Remove user from the queue
        const index = queue.findIndex(user => user.id === socket.id);
        if (index > -1) {
          queue.splice(index, 1);
          console.log('User removed from the queue:', socket.id);
        }

        // Find and leave all rooms the user was in
        activeRooms.forEach((users, room) => {
          if (users.has(socket.id)) {
            disconnectUsersInRoom(io, room);
          }
        });

        // Optionally, you can emit an event to inform other parts of your application
        io.emit('user offline', socket.id);
      });

      // New event handler for when a user is matched
      socket.on('matched', (room: string) => {
        if (!activeRooms.has(room)) {
          activeRooms.set(room, new Set());
        }
        activeRooms.get(room)!.add(socket.id);
      });

      socket.on('disconnect partner', (room) => {
        disconnectUsersInRoom(io, room);
      });

      socket.on('confirm leave', (room) => {
        console.log(`User ${socket.id} confirming leave from room: ${room}`);
        
        const socketsInRoom = io.sockets.adapter.rooms.get(room);
        
        if (socketsInRoom) {
          const otherUserId = Array.from(socketsInRoom).find(id => id !== socket.id);
          
          if (otherUserId) {
            console.log(`Other user in room ${room}: ${otherUserId}`);
            
            io.to(socket.id).emit('force leave');
            io.to(otherUserId).emit('force leave');
            
            socket.leave(room);
            io.sockets.sockets.get(otherUserId)?.leave(room);
            
            console.log(`Both users forced to leave room: ${room}`);
          } else {
            console.log(`No other user found in room: ${room}`);
            io.to(socket.id).emit('force leave');
            socket.leave(room);
          }
        } else {
          console.log(`Room not found: ${room}`);
          io.to(socket.id).emit('force leave');
        }
        
        activeRooms.delete(room);
        console.log(`Room ${room} removed from activeRooms`);
      });

      // New event handlers for typing and stop typing
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

    });
  } else {
    console.log('Socket.IO server is already running.');
  }
  res.end();
}


// Function to check for matches and pair users
