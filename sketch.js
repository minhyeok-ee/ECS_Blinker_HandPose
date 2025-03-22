// sketch.js
let serialPort, writer, reader;
let redSlider, yellowSlider, greenSlider;
let currentMode = 0;
let dataBuffer = "";
let hands = [],
  handPose,
  videoCapture;
const OK_THRESHOLD = 40;

function preload() {
  handPose = ml5.handPose();
}

function setup() {
  noCanvas();

  redSlider = document.getElementById("redSlider");
  yellowSlider = document.getElementById("yellowSlider");
  greenSlider = document.getElementById("greenSlider");

  redSlider.addEventListener("input", updateTimes);
  yellowSlider.addEventListener("input", updateTimes);
  greenSlider.addEventListener("input", updateTimes);

  document
    .getElementById("connectButton")
    .addEventListener("click", connectToArduino);

  startCamera();
  videoCapture = createCapture(VIDEO);
  videoCapture.size(640, 480);
  videoCapture.hide();
  handPose.detectStart(videoCapture, gotHands);

  setInterval(checkGesture, 1000);
}

function gotHands(results) {
  hands = results;
}

async function startCamera() {
  try {
    const video = document.getElementById("video");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    console.log("✅ 카메라 연결 성공!");
  } catch (error) {
    console.error("🚨 카메라 접근 오류:", error);
  }
}

function updateTimes() {
  if (currentMode === 0) {
    document.getElementById("redTime").textContent = redSlider.value;
    document.getElementById("yellowTime").textContent = yellowSlider.value;
    document.getElementById("greenTime").textContent = greenSlider.value;
    sendData();
  }
}

async function connectToArduino() {
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    writer = serialPort.writable.getWriter();
    reader = serialPort.readable.getReader();
    console.log("Connected to Arduino!");
    readData();
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

async function sendData() {
  if (writer) {
    let data = `${redSlider.value},${yellowSlider.value},${greenSlider.value},${currentMode}\n`;
    await writer.write(new TextEncoder().encode(data));
    console.log("🔄 데이터 전송:", data);
  }
}

async function readData() {
  while (serialPort.readable) {
    try {
      const { value, done } = await reader.read();
      if (done) break;

      let chunk = new TextDecoder().decode(value);
      dataBuffer += chunk;

      let lines = dataBuffer.split("\n");
      while (lines.length > 1) {
        let line = lines.shift().trim();
        processData(line);
      }
      dataBuffer = lines[0];
    } catch (err) {
      console.error("Read error:", err);
    }
  }
}

function processData(data) {
  console.log("Received Data:", data);
  let parts = data.split(",");
  if (parts.length !== 5) return;

  currentMode = parseInt(parts[0]);
  document.getElementById("modeText").textContent = currentMode;
  document.getElementById("brightnessValue").textContent = parts[4];

  let redState = parseInt(parts[1]);
  let yellowState = parseInt(parts[2]);
  let greenState = parseInt(parts[3]);

  document.getElementById("redLed").classList.toggle("on", redState);
  document.getElementById("yellowLed").classList.toggle("on", yellowState);
  document.getElementById("greenLed").classList.toggle("on", greenState);
}

function dist2D(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function isPalmFacing(hand) {
  let kp = hand.keypoints;
  let v1 = { x: kp[5].x - kp[0].x, y: kp[5].y - kp[0].y };
  let v2 = { x: kp[17].x - kp[0].x, y: kp[17].y - kp[0].y };
  let cross = v1.x * v2.y - v1.y * v2.x;
  return cross < 0;
}

function isOnlyThumbUp(kp) {
  let wrist = kp[0];
  let thumbUp = kp[4].y < kp[2].y;
  let thumbExtended = dist2D(kp[4], wrist) > dist2D(kp[2], wrist);
  let index = kp[8].y > kp[6].y;
  let middle = kp[12].y > kp[10].y;
  let ring = kp[16].y > kp[14].y;
  let pinky = kp[20].y > kp[18].y;
  return thumbUp && thumbExtended && index && middle && ring && pinky;
}

function isOnlyThumb(kp) {
  let wrist = kp[0];
  let thumbExtended = dist2D(kp[4], wrist) > dist2D(kp[2], wrist);
  let indexExtended = kp[8].y < kp[6].y;
  let middleExtended = kp[12].y < kp[10].y;
  let ringExtended = kp[16].y < kp[14].y;
  let pinkyExtended = kp[20].y < kp[18].y;
  return (
    thumbExtended &&
    !indexExtended &&
    !middleExtended &&
    !ringExtended &&
    !pinkyExtended
  );
}

function countExtendedFingers(kp) {
  let fingers = 0;
  // Thumb
  if (dist2D(kp[4], kp[2]) > 30) fingers++;
  // Index
  if (kp[8].y < kp[6].y) fingers++;
  // Middle
  if (kp[12].y < kp[10].y) fingers++;
  // Ring
  if (kp[16].y < kp[14].y) fingers++;
  // Pinky
  if (kp[20].y < kp[18].y) fingers++;
  return fingers;
}

function checkGesture() {
  if (hands.length > 0) {
    let hand = hands[0];
    let kp = hand.keypoints;

    if (isOnlyThumbUp(kp)) {
      redSlider.value = Math.min(parseInt(redSlider.value) + 100, 3500);
      yellowSlider.value = Math.min(parseInt(yellowSlider.value) + 100, 3500);
      greenSlider.value = Math.min(parseInt(greenSlider.value) + 100, 3500);
      document.getElementById("redTime").textContent = redSlider.value;
      document.getElementById("yellowTime").textContent = yellowSlider.value;
      document.getElementById("greenTime").textContent = greenSlider.value;
      updateTimes();
    } else if (isOnlyThumb(kp) && kp[4].y > kp[2].y) {
      redSlider.value = Math.max(parseInt(redSlider.value) - 100, 500);
      yellowSlider.value = Math.max(parseInt(yellowSlider.value) - 100, 500);
      greenSlider.value = Math.max(parseInt(greenSlider.value) - 100, 500);
      document.getElementById("redTime").textContent = redSlider.value;
      document.getElementById("yellowTime").textContent = yellowSlider.value;
      document.getElementById("greenTime").textContent = greenSlider.value;
      updateTimes();
    } else {
      let fingerCount = countExtendedFingers(kp);
      if (fingerCount >= 2 && fingerCount <= 4) {
        currentMode = fingerCount - 1; // 2 fingers → mode 1, 3 → mode 2, 4 → mode 3
        sendData();
      } else if (fingerCount === 5) {
        if (!isPalmFacing(hand)) {
          currentMode = 0; // Return to 기본모드 if palm is facing
          sendData();
        }
      }
    }
  }
}
