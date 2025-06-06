const videoElement = document.getElementById('video');
const camCanvas = document.getElementById('camCanvas');
const camCtx = camCanvas.getContext('2d');

const canvasWidth = 640;
const canvasHeight = 480;
videoElement.width = canvasWidth;
videoElement.height = canvasHeight;
camCanvas.width = canvasWidth;
camCanvas.height = canvasHeight;

const lastYs = [];
const SMOOTHING_FRAMES = 10;
let smoothedY = 0.5;

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: canvasWidth,
  height: canvasHeight
});
camera.start();

function onResults(results) {
  camCtx.save();
  camCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  camCtx.drawImage(results.image, 0, 0, canvasWidth, canvasHeight);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
    const landmarks = results.multiHandLandmarks[0];
    drawConnectors(camCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
    drawLandmarks(camCtx, landmarks, { color: '#FF0000', lineWidth: 1 });

    const wristY = landmarks[0].y;
    lastYs.push(wristY);
    if (lastYs.length > SMOOTHING_FRAMES) lastYs.shift();

    const average = lastYs.reduce((a, b) => a + b, 0) / lastYs.length;
    const amplification = 1.2;
    let delta = (average - 0.5) * amplification;
    delta = Math.max(-0.5, Math.min(0.5, delta));
    smoothedY = delta + 0.5;
  }

  camCtx.restore();
}

window.getSmoothedHandY = () => smoothedY;

setInterval(() => {
  if (typeof getSmoothedHandY !== 'function') return;

  const normY = getSmoothedHandY();
  const canvasHeight = 1000;
  const paddleHeight = 180;
  const newY = Math.min(Math.max(0, normY * canvasHeight - paddleHeight / 2), canvasHeight - paddleHeight);

  if (window.socket && window.socket.readyState === WebSocket.OPEN) {
    window.socket.send(JSON.stringify({
      type: 'paddleMove',
      y: newY
    }));
  }
}, 1000 / 60);
