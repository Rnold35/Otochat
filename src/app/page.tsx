'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';


export default function Home() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{ sender: string, text: string }[]>([]);
  const [room, setRoom] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [disconnected, setDisconnected] = useState(true);
  const socketRef = useRef<typeof Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reloadConfirmation, setReloadConfirmation] = useState(false);
  const [interest, setInterest] = useState('');
  const [savedInterest, setSavedInterest] = useState('');
  const [buttonEnabled, setButtonEnabled] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const router = useRouter();
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  useEffect(() => {
    if (!socketRef.current) {
      const socketInitializer = async () => {
        await fetch('/api/socket');
        socketRef.current = io();
        setupSocketListeners(socketRef.current);
      };

      socketInitializer();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const setupSocketListeners = (socket: typeof Socket) => {
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      setSocketConnected(true);
    });

    socket.on('matched', (room: string) => {
      console.log(`Matched in room: ${room}`);
      setRoom(room);
      setWaiting(false);
      setDisconnected(false);
    });

    socket.on('queuing', (isQueuing: boolean) => {
      console.log('Queuing status:', isQueuing);
      setWaiting(isQueuing);
    });

    socket.on('disconnect', (reason: string) => {
      console.log('Disconnected from server:', reason);
      if (reason === 'io server disconnect') {
        // The disconnection was initiated by the server, you need to reconnect manually
        socket.connect();
      } else {
        // The disconnection was initiated by the client
        handleDisconnect();
      }
    });

    socket.on('partnerDisconnected', () => {
      console.log('Your chat partner has disconnected.');
      handlePartnerDisconnect();
    });

    socket.on('chat message', ({ sender, message }: { sender: string, message: string }) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender, text: message }
      ]);
    });

    socket.on('user typing', (typingUserId: string) => {
      console.log(`User ${typingUserId} is typing`);
      if (typingUserId !== socketRef.current?.id) {
        setPartnerTyping(true);
      }
    });

    socket.on('user stopped typing', (typingUserId: string) => {
      console.log(`User ${typingUserId} stopped typing`);
      if (typingUserId !== socketRef.current?.id) {
        setPartnerTyping(false);
      }
    });

    socket.on('user disconnected', () => {
      setDisconnected(true);
      setRoom(null);
      setMessages([]);
      console.log('Your chat partner has disconnected');
    });

    socket.on('force leave', () => {
      console.log('Forced to leave the room');
      handleForcedLeave();
    });

    // Add event listener for when a user leaves the room
    socket.on('userLeft', (userId: string) => {
      console.log(`User ${userId} left the room`);
      window.location.reload();
    });

  };

  const sendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (message.trim() && socketRef.current && room) {
      socketRef.current.emit('chat message', { room, message });
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: 'You', text: message }
      ]);
      setMessage('');
    }
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    if (newMessage.trim() !== '') {
      if (!isTyping) {
        setIsTyping(true);
        socketRef.current?.emit('typing', { room });
        console.log('Emitted typing event');
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        socketRef.current?.emit('stopped typing', { room });
        console.log('Emitted stopped typing event');
      }, 2000);
    } else {
      setIsTyping(false);
      socketRef.current?.emit('stopped typing', { room });
      console.log('Emitted stopped typing event');
    }
  };

  const handleInterestSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && interest.trim()) {
      setSavedInterest(interest.trim());
      setInterest('');
    }
  };

  const startChatting = useCallback(() => {
    if (buttonEnabled && socketConnected) {
      console.log('Starting chat with interest:', savedInterest || interest);
      // Disconnect the existing socket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Create a new socket connection
      socketRef.current = io();

      // Set up listeners for the new socket
      setupSocketListeners(socketRef.current);

      // Emit the start chatting event with the interest
      socketRef.current.emit('start chatting', savedInterest || interest);
      console.log('Emitted start chatting event');

      setWaiting(true);
      setDisconnected(false);
      setMessages([]);
      setButtonEnabled(false);
      setTimeout(() => setButtonEnabled(true), 3000);
    }
  }, [buttonEnabled, socketConnected, savedInterest, interest]);

  const handleReloadClick = () => {
    if (reloadConfirmation) {
      if (socketRef.current && room) {
        socketRef.current.emit('confirm leave', room);
      }
      setMessages([]);
      setWaiting(false);
      setDisconnected(true);
      setReloadConfirmation(false);
      setRoom(null);
    } else {
      setReloadConfirmation(true);
      setTimeout(() => setReloadConfirmation(false), 2000);
    }
  };

  const stopQueuing = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      setWaiting(false);
      
      setTimeout(() => {
        socketRef.current = io();
        setupSocketListeners(socketRef.current);
      }, 1000);
    }
  };

  const handleDisconnect = () => {
    setRoom(null);
    setMessages([]);
    setWaiting(false);
    setDisconnected(true);
    setReloadConfirmation(false);
    router.push('/'); // Redirect to home page or reconnection page
  };

  const handlePartnerDisconnect = () => {
    setDisconnected(true);
    setRoom(null);
    setMessages([]);
    console.log('Your chat partner has disconnected');
  };

  const handleForcedLeave = () => {
    setDisconnected(true);
    setRoom(null);
    setMessages([]);
    setWaiting(false);
    setReloadConfirmation(false);
    
    // Optionally, you can show a message to the user that their partner has left
    alert("Your chat partner has left the room.");
  };



  useEffect(() => {
    console.log('Partner typing state changed:', partnerTyping);
  }, [partnerTyping]);

  return (
    <div className="container">
      <div className="chat-header">
        <h1 className="title">Otochat</h1>
        {room && (
          <button onClick={handleReloadClick} className="reload-button">
            {reloadConfirmation ? "Are you sure?" : "Stop Chatting"}
          </button>
        )}
      </div>

      <div className="chat-body">
        {disconnected ? (
          <div className="disconnected-message">
          
            <div className="interest-input">
              <input
                type="text"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                onKeyPress={handleInterestSubmit}
                placeholder="Enter your interest..."
                className="interest-field"
              />
              {savedInterest && (
                <p className="saved-interest">Saved interest: {savedInterest}</p>
              )}
              <button 
                onClick={startChatting} 
                className={`start-button ${(!buttonEnabled || !socketConnected) ? 'disabled' : ''}`} 
                disabled={!buttonEnabled || !socketConnected}
              >
                Start Chatting
              </button>
            </div>
          </div>
        ) : !room ? (
          <>
            {!waiting ? (
              <div className="interest-input">
                <input
                  type="text"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  onKeyPress={handleInterestSubmit}
                  placeholder="Enter your interest..."
                  className="interest-field"
                />
                {savedInterest && (
                  <p className="saved-interest">Saved interest: {savedInterest}</p>
                )}
                <button 
                  onClick={startChatting} 
                  className={`start-button ${(!buttonEnabled || !socketConnected) ? 'disabled' : ''}`} 
                  disabled={!buttonEnabled || !socketConnected}
                >
                  Start Chatting
                </button>
              </div>
            ) : (
              <div className="waiting-animation">
                <div className="spinner"></div>
                <p>Looking for someone to chat with...</p>
                <button onClick={stopQueuing} className="stop-button">
                  Stop Queuing
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="chat-body">
            <ul className="message-list">
              {messages.map((msg, index) => (
                <li key={index} className={`message-item ${msg.sender === 'You' ? 'message-sent' : 'message-received'}`}>
                  {msg.text}
                </li>
              ))}
            </ul>
            {partnerTyping && (
              <div className="typing-indicator typing-indicator-partner">User is typing...</div>
            )}
          </div>
        )}
      </div>

      {room && (
        <div className="chat-footer">
          <form onSubmit={sendMessage} className="chat-form">
            <input
              type="text"
              value={message}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="message-input"
            />
            <button type="submit" className="send-button">
              Send
            </button>
          </form>
        </div>
      )}

      <style jsx>{`
        .container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background-color: #f3f4f6;
          font-family: 'Poppins', sans-serif;
        }

        .chat-header {
          padding: 20px;
          background-color: #8c52ff;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .title {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 0;
        }

        .chat-body {
          flex-grow: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }

        .message-list {
          list-style: none;
          color: black;
          padding: 0;
          margin: 0;
        }

        .message-item {
          max-width: 70%;
          padding: 10px 15px;
          border-radius: 18px;
          margin-bottom: 10px;
          font-size: 1rem;
          line-height: 1.4;
        }

        .message-sent {
          align-self: flex-end;
          background-color: #ccb3ff;
          margin-left: auto;
        }

        .message-received {
          align-self: flex-start;
          background-color: #fff;
        }

        .chat-footer {
          padding: 10px;
          background-color: #fff;
          border-top: 1px solid #e5e5e5;
        }

        .chat-form {
          display: flex;
          align-items: center;
        }

        .message-input {
          flex-grow: 1;
          padding: 10px;
          font-size: 1rem;
          border: 1px solid #ccc;
          border-radius: 20px;
          margin-right: 10px;
          color: black;
        }

        .send-button {
          background-color: #8c52ff;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 1rem;
        }

        .reload-button {
          background-color: ${reloadConfirmation ? '#e74c3c' : 'transparent'};
          color: white;
          padding: 8px 16px;
          font-size: 1rem;
          border: 1px solid white;
          border-radius: 20px;
          cursor: pointer;
        }

        .typing-notification {
          font-size: 0.9rem;
          color: #999;
          margin-bottom: 5px;
        }

        .start-button {
          background-color: #a478ff;
          color: white;
          padding: 12px 24px;
          font-size: 1.2rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
          transition: background-color 0.3s ease;
        }

        .start-button:hover {
          background-color: #8c52ff;
        }

        .start-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .waiting-animation {
          text-align: center;
          color: gray;
        }

        .spinner {
          margin: 0 auto 10px;
          width: 40px;
          height: 40px;
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          border-top-color: #4a90e2;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .disconnected-message {
          text-align: center;
          font-size: 1.2rem;
          color: #e74c3c;
        }

        .stop-button {
          background-color: #e74c3c;
          color: white;
          padding: 10px 20px;
          font-size: 1rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          margin-top: 10px;
          transition: background-color 0.3s ease;
        }

        .stop-button:hover {
          background-color: #c0392b;
        }

        .sender-you {
          color: green;
        }
        .sender-stranger {
          color: red;
        }

        .interest-input {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
        }
        .interest-field {
          width: 100%;
          max-width: 300px;
          padding: 10px;
          margin-bottom: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 1rem;
        }
        .saved-interest {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 0.9rem;
          color: #666;
        }

        .typing-indicator {
          padding: 10px;
          background-color: #f0f0f0;
          color: #666;
          font-style: italic;
          border-radius: 18px;
          margin-bottom: 10px;
        }

        .typing-indicator-self {
          align-self: flex-end;
          background-color: #e6f7ff;
        }

        .typing-indicator-partner {
          align-self: flex-start;
          background-color: #f0f0f0;
        }
      `}</style>
    </div>
  );
}

