# Frontend 
    first page will have a input text field for the user to input the common interests, press enter to display the result. and a button for "start chatting"
    when "start chatting" button is pressed, it will queue the user with the common interests to the chat system. when queue it has a "cancel" button to cancel the queue.
    when the user cancel the queue, remove queue from the queue room in websocket.
 



# websocket
    build a pages/api/socket.ts and a server.js
    create a websocket connection with unique id for each user
    send message to websocket
    receive message from websocket
    create queue room for search for a user and connect with them in a room. if they have common interests, they will be connected. if the common interest queue only last 1min, if not, the queue will be deleted.
    check if the user is online or offline inside the room, when the user leave the room or disconnect the websocket, both users should be notified "you are disconnected from the room"


# chat system
    when typing a message, the user should see a "you are typing" message
    when the other user send a message, the user should see the message
    
# file structure
OTOCHAT/
├── node_modules/
├── requirements/
│   └── frontend_requirements.txt
├── src/
│   └── app/
│       └── fonts/
│           ├── GeistMonoVF.woff
│           └── GeistVF.woff
├── favicon.ico
├── globals.css
├── layout.tsx
├── page.tsx
├── .eslintrc.json
├── .gitignore
├── next-env.d.ts
├── next.config.mjs
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
└── tsconfig.json