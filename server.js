// Gerekli kütüphaneleri çağırıyoruz.
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');

// Sunucu kurulumunu yapıyoruz.
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Oyuncuların göreceği dosyaların 'public' klasöründe olduğunu belirtiyoruz.
app.use(express.static(path.join(__dirname, 'public')));

// Render, portu kendisi atayacaktır. Bu satır önemlidir.
const PORT = process.env.PORT || 3000;

// Sunucuyu dinlemeye başlıyoruz.
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışmaya başladı...`));

// Oyun odalarını ve durumlarını saklamak için bir nesne.
const games = {};

// Bir oyuncu sunucuya bağlandığında çalışacak olan ana fonksiyon.
io.on('connection', socket => {
    console.log('Yeni bir oyuncu bağlandı:', socket.id);

    // Oyuncu "Oyun Kur" butonuna tıkladığında...
    socket.on('createGame', (settings) => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        socket.join(roomCode);

        games[roomCode] = {
            players: [{ id: socket.id, score: 0 }],
            settings: settings,
            gameState: 'waiting',
            rematchVotes: []
        };

        socket.emit('gameCreated', { roomCode });
        console.log(`Oda [${roomCode}] kuruldu. Kurucu: ${socket.id}`);
    });

    // Oyuncu "Oyuna Katıl" butonuna tıkladığında...
    socket.on('joinGame', ({ roomCode }) => {
        const game = games[roomCode];
        if (game && game.players.length < 2) {
            socket.join(roomCode);
            game.players.push({ id: socket.id, score: 0 });
            
            io.to(roomCode).emit('gameStart', {
                roomCode: roomCode,
                players: game.players,
                settings: game.settings,
                turn: game.players[0].id
            });
            game.gameState = 'playing';
            console.log(`${socket.id} oyuncusu [${roomCode}] odasına katıldı. Oyun başlıyor.`);

        } else {
            socket.emit('joinError', 'Oda bulunamadı veya oda dolu.');
        }
    });

    // Sıradaki oyuncu kelimeyi belirlediğinde...
    socket.on('setWord', ({ roomCode, word }) => {
        const game = games[roomCode];
        if (!game) return;

        game.word = word.toUpperCase();
        game.maskedWord = word.toUpperCase().replace(/[A-ZÇĞIİÖŞÜ]/gi, '_');
        game.guesses = [];
        game.wrongGuesses = 0;

        const guessingPlayer = game.players.find(p => p.id !== socket.id);
        if (guessingPlayer) {
            io.to(guessingPlayer.id).emit('wordIsSet', {
                maskedWord: game.maskedWord,
                turn: guessingPlayer.id
            });
            socket.emit('waitForGuess', { maskedWord: game.maskedWord });
        }
    });

    // Bir oyuncu harf tahmin ettiğinde...
    socket.on('guessLetter', ({ roomCode, letter }) => {
        const game = games[roomCode];
        if (!game) return;

        const guessingPlayer = game.players.find(p => p.id === socket.id);
        if (!guessingPlayer) return;

        letter = letter.toUpperCase();
        let correctGuess = false;
        
        if (!game.guesses.includes(letter)) {
            game.guesses.push(letter);
            if (game.word.includes(letter)) {
                correctGuess = true;
                guessingPlayer.score += 1;
            } else {
                game.wrongGuesses++;
                guessingPlayer.score -= 1;
            }
        }

        const newMaskedWord = game.word.split('').map(char => {
            return game.guesses.includes(char) || char === ' ' ? char : '_';
        }).join('');
        game.maskedWord = newMaskedWord;

        const isWinner = !game.maskedWord.includes('_');
        const isLoser = game.wrongGuesses >= game.settings.wrongRights;
        
        io.to(roomCode).emit('updateGameState', {
            maskedWord: game.maskedWord,
            wrongGuesses: game.wrongGuesses,
            correctGuess: correctGuess,
            guessedLetter: letter,
            isWinner: isWinner,
            isLoser: isLoser,
            word: isWinner || isLoser ? game.word : null,
            scores: {
                [game.players[0].id]: game.players[0].score,
                [game.players[1].id]: game.players[1].score,
            }
        });

        if(isWinner || isLoser) {
            game.rematchVotes = [];
        }
    });

    // Tekrar oyna isteği geldiğinde...
    socket.on('playAgain', ({ roomCode }) => {
        const game = games[roomCode];
        if (!game) return;

        if (!game.rematchVotes.includes(socket.id)) {
            game.rematchVotes.push(socket.id);
        }

        if (game.rematchVotes.length === 2) {
            game.word = null;
            game.maskedWord = null;
            game.guesses = [];
            game.wrongGuesses = 0;
            game.rematchVotes = [];

            const currentTurnPlayerIndex = game.players.findIndex(p => p.id === socket.id);
            const nextTurnPlayerId = game.players[currentTurnPlayerIndex === 0 ? 1 : 0].id;

            io.to(roomCode).emit('gameStart', {
                roomCode: roomCode,
                players: game.players,
                settings: game.settings,
                turn: nextTurnPlayerId
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Bir oyuncunun bağlantısı kesildi:', socket.id);
        // Burada oyuncunun olduğu odayı bulup diğer oyuncuya haber verme mantığı eklenebilir.
    });
});
