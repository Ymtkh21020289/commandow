const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// プレイヤー待機列
let waitingPlayer = null;

// ★追加: 現在の接続人数
let connectedCount = 0;

io.on('connection', (socket) => {
    // 1. 接続時にカウントを増やして全員に通知
    connectedCount++;
    io.emit('update_count', connectedCount);
    console.log(`User connected. Total: ${connectedCount}`);

    // マッチング処理（参加リクエスト）
    socket.on('join_game', (charId) => {
        if (waitingPlayer) {
            // マッチング成立
            const roomName = `room-${waitingPlayer.id}-${socket.id}`;
            const opponentSocket = waitingPlayer;
            
            // 部屋に参加
            socket.join(roomName);
            opponentSocket.join(roomName);

            // ゲーム開始通知
            io.to(roomName).emit('game_start', {
                role: 'p1', // 待っていた人がp1 (便宜上)
                opponentChar: charId
            });
            // 相手側には逆の情報を送るため、個別送信が必要ですが
            // 簡易実装として、相手のsocketIDを使って個別に送ります
            socket.emit('game_start', { role: 'p2', opponentChar: waitingPlayer.charId });
            opponentSocket.emit('game_start', { role: 'p1', opponentChar: charId });

            // 部屋情報を保存（切断時の判定用などに使うが今回は省略）
            waitingPlayer = null;
        } else {
            // 待機列へ
            waitingPlayer = socket;
            waitingPlayer.charId = charId;
            socket.emit('waiting', '対戦相手を探しています...');
        }
    });

    // カード提出処理
    socket.on('submit_card', (data) => {
        // 自分が属している部屋の相手に転送する
        // ※本来は部屋IDを管理すべきですが、簡易的に「自分以外の部屋メンバー」に送ります
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        if (rooms.length > 0) {
            socket.to(rooms[0]).emit('opponent_move', data);
        }
    });

    // 切断処理
    socket.on('disconnect', () => {
        // 2. 切断時にカウントを減らして全員に通知
        connectedCount--;
        io.emit('update_count', connectedCount);
        console.log(`User disconnected. Total: ${connectedCount}`);

        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        // 対戦中の切断通知
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        if (rooms.length > 0) {
            socket.to(rooms[0]).emit('opponent_left');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
