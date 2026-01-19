const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// index.html を配信する（同じ階層にある場合）
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_game', (charId) => {
        socket.charId = charId;
        if (waitingPlayer) {
            const opponent = waitingPlayer;
            waitingPlayer = null;
            const roomId = 'room_' + socket.id + '#' + opponent.id;
            socket.join(roomId);
            opponent.join(roomId);
            io.to(opponent.id).emit('game_start', { role: 'p1', opponentChar: socket.charId });
            io.to(socket.id).emit('game_start', { role: 'p2', opponentChar: opponent.charId });
        } else {
            waitingPlayer = socket;
            socket.emit('waiting', '対戦相手を探しています...');
        }
    });

    socket.on('submit_card', (data) => {
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        if (rooms.length > 0) socket.to(rooms[0]).emit('opponent_move', data);
    });

    socket.on('disconnect', () => {
        if (waitingPlayer === socket) waitingPlayer = null;
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        if (rooms.length > 0) socket.to(rooms[0]).emit('opponent_left');
    });
});

// Renderの指定ポート、なければ3000で起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
