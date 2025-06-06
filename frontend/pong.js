const socket = new WebSocket('wss://cs.catlin.edu/ws/2025/spencer');
window.socket = socket; // <-- Allow handtracker to access WebSocket

let playerNumber = 0;
let roomId = '...';
let Pong;
let initialized = false;
let startGamePending = false;
let isRestarting = false;

socket.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'init') {
    playerNumber = msg.player;
    roomId = msg.roomId;
    document.getElementById('playerId').innerText = `P${playerNumber}`;
    document.getElementById('roomId').innerText = roomId;

    Pong = Object.assign({}, Game);
    Pong.initialize();
    initialized = true;

    if (startGamePending) {
      Pong.running = true;
    }
  }

  if (msg.type === 'startGame') {
    if (initialized) {
      Pong.running = true;
    } else {
      startGamePending = true;
    }
  }

  if (msg.type === 'gameState') {
    if (!Pong || !Pong.running) return;
    Pong.rawBall = msg.ball;
    Pong.rawPaddles = msg.paddles;
    Pong.rawScores = msg.scores;
    Pong.ballCountdown = msg.ballCountdown || 0;
    Pong.draw();
  }

  if (msg.type === 'gameOver') {
    if (Pong) {
      document.getElementById('endMessage').innerText = `Player ${msg.winner} Wins!`;
      document.getElementById('endOverlay').style.display = 'flex';
    }
  }

  if (msg.type === 'restartConfirmed') {
    document.getElementById('endOverlay').style.display = 'none';
    window.location.reload();
  }

  if (msg.type === 'waitingForOtherPlayer') {
    document.getElementById('restartBtn').innerText = 'Waiting for other player...';
    document.getElementById('restartBtn').disabled = true;
  }
});

document.getElementById('restartBtn').addEventListener('click', () => {
  if (!isRestarting) {
    socket.send(JSON.stringify({ type: 'restartRequest' }));
    isRestarting = true;
  }
});

var Game = {
  initialize: function () {
    this.canvas = document.getElementById('pongCanvas');
    this.context = this.canvas.getContext('2d');

    this.canvas.width = 1400;
    this.canvas.height = 1000;
    this.canvas.style.width = (this.canvas.width / 2) + 'px';
    this.canvas.style.height = (this.canvas.height / 2) + 'px';

    this.running = false;
    this.color = '#8c52ff';

    this.rawBall = { x: 700, y: 500, width: 18, height: 18 };
    this.rawPaddles = { 1: { y: 410, height: 180 }, 2: { y: 410, height: 180 } };
    this.rawScores = { 1: 0, 2: 0 };
    this.ballCountdown = 0;

    this.menu();
  },

  menu: function () {
    this.draw();
    this.context.font = '50px Courier New';
    this.context.fillStyle = this.color;
    this.context.fillRect(this.canvas.width / 2 - 350, this.canvas.height / 2 - 48, 700, 100);
    this.context.fillStyle = '#ffffff';
    this.context.textAlign = 'center';
    this.context.fillText('Waiting for Players...', this.canvas.width / 2, this.canvas.height / 2 + 15);
  },

  draw: function () {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const paddleWidth = 18;
    const paddleXLeft = 150;
    const paddleXRight = this.canvas.width - 150;

    const you = playerNumber;
    const opponent = playerNumber === 1 ? 2 : 1;
    const yourPaddle = this.rawPaddles[you];
    const oppPaddle = this.rawPaddles[opponent];
    const ball = this.rawBall;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(paddleXLeft, yourPaddle.y, paddleWidth, yourPaddle.height);
    ctx.fillRect(paddleXRight, oppPaddle.y, paddleWidth, oppPaddle.height);

    const mirroredBallX = playerNumber === 2
      ? this.canvas.width - ball.x - ball.width
      : ball.x;
    ctx.fillRect(mirroredBallX, ball.y, ball.width, ball.height);

    ctx.beginPath();
    ctx.setLineDash([7, 15]);
    ctx.moveTo((this.canvas.width / 2), this.canvas.height - 140);
    ctx.lineTo((this.canvas.width / 2), 140);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.font = '100px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(this.rawScores[you].toString(), (this.canvas.width / 2) - 300, 200);
    ctx.fillText(this.rawScores[opponent].toString(), (this.canvas.width / 2) + 300, 200);

    if (this.ballCountdown > 0) {
      ctx.font = '100px Courier New';
      ctx.fillText(this.ballCountdown.toString(), this.canvas.width / 2, this.canvas.height / 2);
    }
  }
};
