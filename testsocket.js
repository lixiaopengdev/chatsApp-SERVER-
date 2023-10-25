const http = require('http');
const socketio = require('socket.io');

const server = http.createServer();
const io = socketio(server);

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('message', (data) => {
    console.log(`Received message: ${data}`);

    // Broadcast the received message to all connected clients
    io.emit('message', data);
    io.emit('sssssss',"fasdfasfsadfsadfs","oooooooooooo")
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const port = process.env.PORT || 3010;
server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
