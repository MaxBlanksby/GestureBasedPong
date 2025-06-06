const WebSocket = require('ws');
const wsPort = 9658;
const wss = new WebSocket.Server({ port: wsPort });

let nextRoomId = 1;
const rooms = {};
const MAX_SCORE = 5;

function broadcastToRoom(roomId, data) {
  const room = rooms[roomId];
  if (!room) return;
  for (const player of room.players) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(data));
    }
  }
}

function startGameLoop(roomId) {
  const room = rooms[roomId];
  const state = {
    ball: { x: 700, y: 500, vx: 0, vy: 0, width: 18, height: 18 },
    paddles: {
      1: { y: 410, height: 180 },
      2: { y: 410, height: 180 }
    },
    scores: { 1: 0, 2: 0 },
    width: 1400,
    height: 1000
  };
  room.state = state;
  room.ballDelayUntil = Date.now() + 3000;
  room.pendingDirection = 1;
  room.gameOver = false;

  room.interval = setInterval(() => {
    if (room.gameOver) return;

    const b = state.ball;
    const p1 = state.paddles[1];
    const p2 = state.paddles[2];
    const now = Date.now();
    const delayActive = now < room.ballDelayUntil;
    const secondsLeft = delayActive ? Math.ceil((room.ballDelayUntil - now) / 1000) : 0;

    if (!delayActive) {
      if (room.pendingDirection !== null) {
        const dir = room.pendingDirection;
        state.ball.vx = dir === 1 ? -8 : 8;
        state.ball.vy = Math.random() > 0.5 ? 5 : -5;
        room.pendingDirection = null;
      }

      b.x += b.vx;
      b.y += b.vy;

      if (b.y <= 0 || b.y + b.height >= state.height) b.vy *= -1;

      if (b.x <= 168 && b.x >= 150 && b.y + b.height >= p1.y && b.y <= p1.y + p1.height) b.vx = Math.abs(b.vx);
      if (b.x + b.width >= 1232 && b.x <= 1250 && b.y + b.height >= p2.y && b.y <= p2.y + p2.height) b.vx = -Math.abs(b.vx);

      if (b.x <= 0) {
        state.scores[2]++;
        broadcastToRoom(roomId, { type: 'gameState', ball: b, paddles: state.paddles, scores: state.scores, ballCountdown: 0 });
        if (state.scores[2] >= MAX_SCORE) {
          endGame(roomId, 2);
          return;
        }
        resetBall(state);
        room.ballDelayUntil = Date.now() + 3000;
        room.pendingDirection = 1;
        return;
      }

      if (b.x >= state.width) {
        state.scores[1]++;
        broadcastToRoom(roomId, { type: 'gameState', ball: b, paddles: state.paddles, scores: state.scores, ballCountdown: 0 });
        if (state.scores[1] >= MAX_SCORE) {
          endGame(roomId, 1);
          return;
        }
        resetBall(state);
        room.ballDelayUntil = Date.now() + 3000;
        room.pendingDirection = 2;
        return;
      }
    }

    broadcastToRoom(roomId, {
      type: 'gameState',
      ball: b,
      paddles: state.paddles,
      scores: state.scores,
      ballCountdown: secondsLeft
    });
  }, 1000 / 60);
}

function resetBall(state) {
  state.ball = {
    x: 700,
    y: 500,
    vx: 0,
    vy: 0,
    width: 18,
    height: 18
  };
}

function endGame(roomId, winner) {
  const room = rooms[roomId];
  if (!room) return;
  room.gameOver = true;
  broadcastToRoom(roomId, { type: 'gameOver', winner });
  clearInterval(room.interval);
  room.restartVotes = new Set();
}

wss.on('connection', (ws) => {
  let assignedRoom = null;
  let playerId = null;

  for (const roomId in rooms) {
    if (rooms[roomId].players.length === 1) {
      assignedRoom = roomId;
      break;
    }
  }

  if (!assignedRoom) {
    assignedRoom = nextRoomId++;
    rooms[assignedRoom] = { players: [], state: null, interval: null, restartVotes: new Set(), gameOver: false };
  }

  playerId = rooms[assignedRoom].players.length + 1;
  rooms[assignedRoom].players.push({ id: playerId, ws });

  ws.send(JSON.stringify({
    type: 'init',
    player: playerId,
    totalPlayers: rooms[assignedRoom].players.length,
    roomId: assignedRoom.toString()
  }));

  if (rooms[assignedRoom].players.length === 2) {
    broadcastToRoom(assignedRoom, { type: 'startGame' });
    startGameLoop(assignedRoom);
  }

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const room = rooms[assignedRoom];

    if (data.type === 'paddleMove') {
      if (room && room.state && room.state.paddles[playerId]) {
        room.state.paddles[playerId].y = data.y;

        broadcastToRoom(assignedRoom, {
          type: 'gameState',
          ball: room.state.ball,
          paddles: room.state.paddles,
          scores: room.state.scores,
          ballCountdown: room.ballDelayUntil > Date.now()
            ? Math.ceil((room.ballDelayUntil - Date.now()) / 1000)
            : 0
        });
      }
    }

    if (data.type === 'restartRequest') {
      if (!room) return;
      room.restartVotes.add(playerId);
      if (room.restartVotes.size === 2) {
        broadcastToRoom(assignedRoom, { type: 'restartConfirmed' });
      } else {
        ws.send(JSON.stringify({ type: 'waitingForOtherPlayer' }));
      }
    }
  });

  ws.on('close', () => {
    const room = rooms[assignedRoom];
    if (room) {
      room.players = room.players.filter(p => p.id !== playerId);
      if (room.players.length === 0) {
        clearInterval(room.interval);
        delete rooms[assignedRoom];
      }
    }
  });
});