
const videoElement = document.getElementById('video');
const camCanvas    = document.getElementById('camCanvas');
const camCtx       = camCanvas.getContext('2d');

const canvasWidth  = 640;
const canvasHeight = 480;
videoElement.width  = canvasWidth;
videoElement.height = canvasHeight;
camCanvas.width  = canvasWidth;
camCanvas.height = canvasHeight;

const lastYs = [];
const SMOOTHING_FRAMES  = 10;

const AMPLIFICATION     = 1.2;

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

    //get y value 
    let yNorm = landmarks[0].y; 

    lastYs.push(yNorm);
    if (lastYs.length > SMOOTHING_FRAMES) {
      lastYs.shift();
    }
    const sumYs = lastYs.reduce((a, b) => a + b, 0);
    const yAvg   = sumYs / lastYs.length;

    let delta = yAvg - 0.5;       
    delta = delta * AMPLIFICATION;
    if (delta > 0.5) delta = 0.5;
    if (delta < -0.5) delta = -0.5;
    const mappedY = delta + 0.5;  

    const payload = { xNorm: landmarks[0].x, yNorm: yAvg, mappedY };
    window.dispatchEvent(new CustomEvent('handPosition', { detail: payload }));
  }

  camCtx.restore();
}