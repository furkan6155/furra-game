// Sunucu ile bağlantı kuruyoruz
const socket = io();

// --- HTML Elementleri ---
const mainMenu = document.getElementById('main-menu');
const createGameBox = document.getElementById('create-game-box');
const joinGameBox = document.getElementById('join-game-box');
const roomCodeDisplay = document.getElementById('room-code-display');
const roomCodeText = document.getElementById('room-code-text');
const gameScreen = document.getElementById('game-screen');
const gameInfo = document.getElementById('game-info');
const setWordContainer = document.getElementById('set-word-container');
const gamePlayContainer = document.getElementById('game-play-container');
const wordInput = document.getElementById('word-input');
const setWordBtn = document.getElementById('set-word-btn');
const wrongGuessesCount = document.getElementById('wrong-guesses-count');
const maxWrongGuesses = document.getElementById('max-wrong-guesses');
const wordContainer = document.getElementById('word-container');
const keyboardContainer = document.getElementById('keyboard-container');
const gameOverContainer = document.getElementById('game-over-container');
const gameOverMessage = document.getElementById('game-over-message');
const player1Score = document.getElementById('player1-score');
const player2Score = document.getElementById('player2-score');

// --- Butonlar ---
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const mainMenuBtn = document.getElementById('main-menu-btn');
// --- Oyun Değişkenleri ---
let currentRoomCode = '';
let playerIsAdmin = false; // Oyunu kuran kişi mi?

// --- Buton Olay Dinleyicileri ---
createGameBtn.addEventListener('click', () => {
    const settings = {
        wrongRights: document.getElementById('wrong-rights').value
    };
    socket.emit('createGame', settings);
});

joinGameBtn.addEventListener('click', () => {
    const roomCode = document.getElementById('room-code-input').value.toUpperCase();
    if (roomCode) {
        socket.emit('joinGame', { roomCode });
    }
});

setWordBtn.addEventListener('click', () => {
    const word = wordInput.value;
    if (word.trim() === '') {
        alert('Lütfen geçerli bir kelime girin.');
        return;
    }
    socket.emit('setWord', { roomCode: currentRoomCode, word });
    
    // --- YENİ EKLENEN KISIM ---
    // Oyuncu kelimeyi onayladığı anda arayüzü güncelleyelim.
    setWordContainer.style.display = 'none';
    gameInfo.innerText = 'Rakibin tahmini bekleniyor...';
    
    // Kelimenin gizlenmiş halini kendi ekranında da göster
    const maskedWord = word.toUpperCase().replace(/[A-ZÇĞIİÖŞÜ]/gi, '_');
    wordContainer.innerText = maskedWord.split('').join(' ');
    
    gamePlayContainer.style.display = 'block';
    generateKeyboard(); // Klavyeyi oluştur
    enableKeyboard(false); // Ve kendi klavyesini kilitle
    // --- YENİ EKLENEN KISIM SONU ---
});
mainMenuBtn.addEventListener('click', () => {
    window.location.reload(); // Sayfayı yenileyerek en başa döner
});

playAgainBtn.addEventListener('click', () => {
    playAgainBtn.disabled = true;
    playAgainBtn.innerText = 'Rakip Bekleniyor...';
    socket.emit('playAgain', { roomCode: currentRoomCode });
});

// socket.on('gameStart', ...) fonksiyonunu bulun ve en başına şu satırı ekleyin:
// Bu, yeni bir tur başladığında oyun sonu ekranının gizlenmesini sağlar.
gameOverContainer.style.display = 'none';
playAgainBtn.disabled = false;
playAgainBtn.innerText = 'Tekrar Oyna';

// 'gameStart' fonksiyonunun tam hali şöyle olmalı:
socket.on('gameStart', (data) => {
    // YENİ EKLENEN SATIRLAR
    gameOverContainer.style.display = 'none';
    playAgainBtn.disabled = false;
    playAgainBtn.innerText = 'Tekrar Oyna';
    // ---

    currentRoomCode = data.roomCode; 
    mainMenu.style.display = 'none';
    gameScreen.style.display = 'block';
    gamePlayContainer.style.display = 'none';
    maxWrongGuesses.innerText = data.settings.wrongRights;
    
    if (data.turn === socket.id) {
        gameInfo.innerText = 'Sıra Sende: Kelime Belirle';
        setWordContainer.style.display = 'block';
    } else {
        gameInfo.innerText = 'Rakip kelimeyi belirliyor, lütfen bekle...';
    }
});
// --- Sunucudan Gelen Olaylar ---
socket.on('gameCreated', ({ roomCode }) => {
    currentRoomCode = roomCode;
    playerIsAdmin = true;
    roomCodeText.innerText = roomCode;
    createGameBox.style.display = 'none';
    joinGameBox.style.display = 'none';
    roomCodeDisplay.style.display = 'block';
});

socket.on('joinError', (message) => {
    alert(message);
});

socket.on('gameStart', (data) => {
    // YENİ EKLENEN SATIR: Gelen oda kodunu değişkene kaydediyoruz.
    currentRoomCode = data.roomCode; 

    mainMenu.style.display = 'none';
    gameScreen.style.display = 'block';
    gamePlayContainer.style.display = 'none';
    maxWrongGuesses.innerText = data.settings.wrongRights;
    
    // Sıra kelime belirleyecek oyuncuda mı?
    if (data.turn === socket.id) {
        gameInfo.innerText = 'Sıra Sende: Kelime Belirle';
        setWordContainer.style.display = 'block';
    } else {
        gameInfo.innerText = 'Rakip kelimeyi belirliyor, lütfen bekle...';
    }
});
socket.on('wordIsSet', ({ maskedWord, turn }) => {
    gamePlayContainer.style.display = 'block';
    setWordContainer.style.display = 'none';
    wordContainer.innerText = maskedWord.split('').join(' ');
    generateKeyboard(); // Klavyeyi oluştur
    
    if (turn === socket.id) {
        gameInfo.innerText = 'Sıra Sende: Harf Tahmin Et!';
        enableKeyboard(true);
    } else {
        gameInfo.innerText = 'Rakibin tahminini bekle...';
        enableKeyboard(false);
    }
});

socket.on('waitForGuess', ({ maskedWord }) => {
    gameInfo.innerText = 'Rakibin tahmini bekleniyor...';
    gamePlayContainer.style.display = 'block';
    wordContainer.innerText = maskedWord.split('').join(' ');
    generateKeyboard();
    enableKeyboard(false);
});

socket.on('updateGameState', (data) => {
    wordContainer.innerText = data.maskedWord.split('').join(' ');
    wrongGuessesCount.innerText = data.wrongGuesses;

    // Skorları güncelle
    if (data.scores) {
        // Oyuncuların ID'lerini al
        const playerIds = Object.keys(data.scores);
        const myId = socket.id;
        const opponentId = playerIds.find(id => id !== myId);

        player1Score.innerText = data.scores[myId];
        if (opponentId) {
            player2Score.innerText = data.scores[opponentId];
        }
    }

    const guessedKey = document.querySelector(`.key[data-key="${data.guessedLetter}"]`);
    if (guessedKey) {
        guessedKey.disabled = true;
        if (data.correctGuess) {
            guessedKey.classList.add('correct');
        } else {
            guessedKey.classList.add('incorrect');
        }
    }
    
    if(data.isWinner || data.isLoser) {
        enableKeyboard(false);
        let message = '';
        if(data.isWinner){
            message = "Tebrikler, Kazandınız!";
        } else {
            message = "Kaybettiniz!";
        }
        gameOverMessage.innerText = `${message} Doğru kelime: ${data.word}`;
        gameOverContainer.style.display = 'block';
    }
});

// --- Yardımcı Fonksiyonlar ---
function generateKeyboard() {
    keyboardContainer.innerHTML = ''; // Klavyeyi temizle
    const alphabet = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';
    for (const letter of alphabet) {
        const key = document.createElement('button');
        key.className = 'key';
        key.innerText = letter;
        key.dataset.key = letter; // Harfi data-attribute olarak sakla
        key.addEventListener('click', () => {
            if(key.disabled) return; // Zaten basılmışsa işlem yapma
            socket.emit('guessLetter', { roomCode: currentRoomCode, letter });
        });
        keyboardContainer.appendChild(key);
    }
}

function enableKeyboard(isEnabled) {
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        // Zaten doğru/yanlış olarak işaretlenmiş tuşlar hariç diğerlerini aktif/pasif et
        if(!key.classList.contains('correct') && !key.classList.contains('incorrect')){
            key.disabled = !isEnabled;
        }
    });
}