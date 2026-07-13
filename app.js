// Sanogich — kamera orqali mashqlarni sanaydigan AI ilova.
// Pose aniqlash: MediaPipe Pose Landmarker (barcha hisoblar qurilmada bajariladi).

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "./vendor/tasks-vision/vision_bundle.mjs";

// ── MediaPipe landmark indekslari ──
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

// Uch nuqta orasidagi burchak (gradusda), b — burchak uchi.
function angle(a, b, c) {
  const ab = Math.atan2(a.y - b.y, a.x - b.x);
  const cb = Math.atan2(c.y - b.y, c.x - b.x);
  let deg = Math.abs((ab - cb) * (180 / Math.PI));
  if (deg > 180) deg = 360 - deg;
  return deg;
}

function avg(...vals) {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

// Ko'rinish darajasi past bo'lgan nuqtalarni ishonchsiz deb hisoblaymiz.
function visible(lm, ...idxs) {
  return idxs.every((i) => (lm[i].visibility ?? 1) > 0.5);
}

// ── Mashq ta'riflari ──
// Har bir mashq — ikki bosqichli holat mashinasi (masalan: "pastda" / "tepada").
// Takror faqat to'liq sikl bajarilganda sanaladi; gisterezis titrashni oldini oladi.
const EXERCISES = {
  pushup: {
    name: "Push-up",
    tip: "Kamerani yon tomondan qo'ying, butun tanangiz ko'rinsin",
    caloriesPerRep: 0.4,
    stages: { down: "PASTDA ⬇", up: "TEPADA ⬆" },
    detect(lm) {
      if (!visible(lm, LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST) &&
          !visible(lm, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST)) {
        return { valid: false, message: "Qo'llaringiz ko'rinmayapti" };
      }
      const left = angle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
      const right = angle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
      const elbow = avg(left, right);
      // Tana gorizontalligini tekshiramiz — tik turgan odam push-up qilayotgani yo'q.
      const torsoVertical = Math.abs(lm[LM.LEFT_SHOULDER].y - lm[LM.LEFT_HIP].y);
      const torsoHorizontal = Math.abs(lm[LM.LEFT_SHOULDER].x - lm[LM.LEFT_HIP].x);
      if (torsoVertical > torsoHorizontal * 1.5) {
        return { valid: false, message: "Push-up holatiga o'ting (tana gorizontal bo'lsin)" };
      }
      if (elbow < 95) return { valid: true, stage: "down" };
      if (elbow > 155) return { valid: true, stage: "up" };
      return { valid: true, stage: null };
    },
  },

  squat: {
    name: "Prised",
    tip: "Kameraga to'liq bo'yingiz ko'rinsin (old yoki yon tomondan)",
    caloriesPerRep: 0.45,
    stages: { down: "PASTDA ⬇", up: "TEPADA ⬆" },
    detect(lm) {
      if (!visible(lm, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE) &&
          !visible(lm, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE)) {
        return { valid: false, message: "Oyoqlaringiz ko'rinmayapti — orqaroq turing" };
      }
      const left = angle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
      const right = angle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]);
      const knee = avg(left, right);
      if (knee < 110) return { valid: true, stage: "down" };
      if (knee > 160) return { valid: true, stage: "up" };
      return { valid: true, stage: null };
    },
  },

  situp: {
    name: "Press",
    tip: "Kamerani yon tomondan qo'ying, yotgan holatingiz ko'rinsin",
    caloriesPerRep: 0.35,
    stages: { down: "YOTGAN ⬇", up: "KO'TARILGAN ⬆" },
    detect(lm) {
      if (!visible(lm, LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE) &&
          !visible(lm, LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE)) {
        return { valid: false, message: "Tanangiz to'liq ko'rinmayapti" };
      }
      const left = angle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
      const right = angle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]);
      const hip = avg(left, right);
      if (hip < 80) return { valid: true, stage: "up" };
      if (hip > 130) return { valid: true, stage: "down" };
      return { valid: true, stage: null };
    },
  },

  curl: {
    name: "Bitseps",
    tip: "Kameraga old tomondan qarab turing, qo'llaringiz ko'rinsin",
    caloriesPerRep: 0.25,
    stages: { down: "TUSHIRILGAN ⬇", up: "KO'TARILGAN ⬆" },
    detect(lm) {
      const leftOk = visible(lm, LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST);
      const rightOk = visible(lm, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST);
      if (!leftOk && !rightOk) {
        return { valid: false, message: "Qo'llaringiz ko'rinmayapti" };
      }
      const angles = [];
      if (leftOk) angles.push(angle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]));
      if (rightOk) angles.push(angle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]));
      // Ikkala qo'l ko'rinsa — ikkalasi ham bukilgan bo'lishi kerak (minimal burchak emas, o'rtacha).
      const elbow = avg(...angles);
      if (elbow < 55) return { valid: true, stage: "up" };
      if (elbow > 150) return { valid: true, stage: "down" };
      return { valid: true, stage: null };
    },
  },

  plank: {
    name: "Planka",
    tip: "Kamerani yon tomondan qo'ying — planka vaqti soniyada o'lchanadi",
    type: "hold",
    caloriesPerRep: 0.05, // soniyasiga
    stages: { hold: "USHLAB TURING 🔥" },
    detect(lm) {
      const leftOk = visible(lm, LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_ANKLE);
      const rightOk = visible(lm, LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_ANKLE);
      if (!leftOk && !rightOk) {
        return { valid: false, message: "Tanangiz to'liq ko'rinmayapti — yon tomondan turing" };
      }
      const side = leftOk
        ? [lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_ANKLE]]
        : [lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_ANKLE]];
      const [shoulder, hip, ankle] = side;
      const bodyStraight = angle(shoulder, hip, ankle) > 150;
      const horizontal = Math.abs(shoulder.y - hip.y) < Math.abs(shoulder.x - hip.x);
      if (bodyStraight && horizontal) return { valid: true, stage: "hold" };
      if (horizontal && !bodyStraight) {
        return { valid: true, stage: null, message: "Belingizni to'g'rilang — tana bir chiziqda bo'lsin" };
      }
      return { valid: true, stage: null };
    },
  },

  lunge: {
    name: "Vipad",
    tip: "Kameraga yon tomondan turing, ikkala oyoq ko'rinsin",
    caloriesPerRep: 0.4,
    stages: { down: "PASTDA ⬇", up: "TEPADA ⬆" },
    detect(lm) {
      if (!visible(lm, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE,
                   LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE)) {
        return { valid: false, message: "Ikkala oyoq ham ko'rinishi kerak" };
      }
      const left = angle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
      const right = angle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]);
      // Vipadda old tizza ~90° gacha bukiladi, orqa tizza ham pastga tushadi.
      if (Math.min(left, right) < 100) return { valid: true, stage: "down" };
      if (left > 160 && right > 160) return { valid: true, stage: "up" };
      return { valid: true, stage: null };
    },
  },

  highknees: {
    name: "Tizza ko'tarish",
    tip: "Kameraga old tomondan qarab turing, to'liq bo'y ko'rinsin",
    caloriesPerRep: 0.2,
    stages: { down: "PASTDA", up: "TIZZA TEPADA ⬆" },
    detect(lm) {
      if (!visible(lm, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE)) {
        return { valid: false, message: "Oyoqlaringiz ko'rinmayapti — orqaroq turing" };
      }
      const hipY = avg(lm[LM.LEFT_HIP].y, lm[LM.RIGHT_HIP].y);
      // Tana bo'yiga nisbatan chegara — kameradan uzoq-yaqinlikka bog'liq bo'lmasin.
      const torso = Math.abs(avg(lm[LM.LEFT_SHOULDER].y, lm[LM.RIGHT_SHOULDER].y) - hipY);
      const margin = torso * 0.25;
      const leftUp = lm[LM.LEFT_KNEE].y < hipY - margin;
      const rightUp = lm[LM.RIGHT_KNEE].y < hipY - margin;
      if (leftUp || rightUp) return { valid: true, stage: "up" };
      if (lm[LM.LEFT_KNEE].y > hipY + margin && lm[LM.RIGHT_KNEE].y > hipY + margin) {
        return { valid: true, stage: "down" };
      }
      return { valid: true, stage: null };
    },
  },

  jumpingjack: {
    name: "Jumping Jack",
    tip: "Kameraga old tomondan qarab turing, butun bo'yingiz ko'rinsin",
    caloriesPerRep: 0.3,
    stages: { down: "YOPIQ", up: "OCHIQ ✕" },
    detect(lm) {
      if (!visible(lm, LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
                   LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP)) {
        return { valid: false, message: "Butun bo'yingiz ko'rinishi kerak — orqaroq turing" };
      }
      const shoulderY = avg(lm[LM.LEFT_SHOULDER].y, lm[LM.RIGHT_SHOULDER].y);
      const wristY = avg(lm[LM.LEFT_WRIST].y, lm[LM.RIGHT_WRIST].y);
      const hipWidth = Math.abs(lm[LM.LEFT_HIP].x - lm[LM.RIGHT_HIP].x);
      const ankleSpread = Math.abs(lm[LM.LEFT_ANKLE].x - lm[LM.RIGHT_ANKLE].x);
      const armsUp = wristY < shoulderY; // y pastga qarab o'sadi
      const legsApart = ankleSpread > hipWidth * 1.6;
      if (armsUp && legsApart) return { valid: true, stage: "up" };
      if (!armsUp && ankleSpread < hipWidth * 1.2) return { valid: true, stage: "down" };
      return { valid: true, stage: null };
    },
  },
};

// ── Holat ──
const state = {
  exercise: "pushup",
  stage: null,       // "up" | "down" | null
  reps: 0,
  totalReps: 0,
  calories: 0,
  running: false,
  soundOn: true,
  facingMode: "user",
  startTime: null,
  lastRepTime: 0,
  holdMs: 0,      // planka kabi "hold" mashqlarda to'plangan vaqt
  holdLast: null, // oxirgi kadr vaqti (hold davom etayotganda)
};

// ── DOM ──
const $ = (id) => document.getElementById(id);
const video = $("video");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const repCountEl = $("rep-count");
const stageEl = $("stage-indicator");
const feedbackBar = $("feedback-bar");
const feedbackText = $("feedback-text");
const loadingScreen = $("loading-screen");
const startScreen = $("start-screen");
const overlayEl = $("overlay");
const exerciseTipEl = $("exercise-tip");

let poseLandmarker = null;
let drawingUtils = null;
let stream = null;
let lastVideoTime = -1;

// ── Ovoz (Web Audio — tashqi fayl kerak emas) ──
let audioCtx = null;
function beep(freq = 880, duration = 0.12) {
  if (!state.soundOn) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch { /* ovoz ishlamasa ham sanash davom etadi */ }
}

function speakCount(n) {
  if (!state.soundOn || !("speechSynthesis" in window)) return;
  // Har 10-takrorda sonni aytamiz, qolganida qisqa signal yetarli.
  if (n % 10 !== 0) return;
  const utter = new SpeechSynthesisUtterance(String(n));
  utter.rate = 1.1;
  speechSynthesis.speak(utter);
}

// ── UI yangilash ──
function setFeedback(msg, tone = "") {
  feedbackText.textContent = msg;
  feedbackBar.className = tone;
}

function updateRepUI() {
  repCountEl.textContent = state.reps;
  $("stat-total").textContent = state.totalReps;
  $("stat-calories").textContent = Math.round(state.calories);
  repCountEl.classList.remove("flash");
  void repCountEl.offsetWidth; // animatsiyani qayta ishga tushirish
  repCountEl.classList.add("flash");
}

function updateTimer() {
  if (!state.startTime) return;
  const s = Math.floor((Date.now() - state.startTime) / 1000);
  $("stat-time").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
setInterval(updateTimer, 1000);

// ── Takror sanash mantiqi ──
function processDetection(result) {
  const ex = EXERCISES[state.exercise];
  const res = ex.detect(result);

  if (!res.valid) {
    setFeedback(res.message, "warn");
    stageEl.textContent = "—";
    state.holdLast = null;
    return;
  }

  // "Hold" turdagi mashqlar (planka): takror emas, to'g'ri holatda
  // o'tkazilgan vaqt soniyada sanaladi.
  if (ex.type === "hold") {
    const now = performance.now();
    if (res.stage === "hold") {
      if (state.holdLast !== null) state.holdMs += now - state.holdLast;
      state.holdLast = now;
      stageEl.textContent = ex.stages.hold;
      const secs = Math.floor(state.holdMs / 1000);
      if (secs !== state.reps) {
        state.reps = secs;
        state.calories += ex.caloriesPerRep;
        updateRepUI();
        if (secs > 0 && secs % 10 === 0) {
          beep(1320);
          speakCount(secs);
        }
      }
      setFeedback("Ajoyib! Shu holatda turing 🔥", "good");
    } else {
      state.holdLast = null;
      stageEl.textContent = "—";
      setFeedback(res.message ?? "Planka holatiga o'ting", res.message ? "warn" : "");
    }
    return;
  }

  if (res.stage) {
    stageEl.textContent = ex.stages[res.stage];

    // To'liq sikl: down → up = 1 takror.
    if (state.stage === "down" && res.stage === "up") {
      const now = Date.now();
      // Juda tez ketma-ket "takror" — shovqin, e'tiborsiz qoldiramiz.
      if (now - state.lastRepTime > 400) {
        state.reps += 1;
        state.totalReps += 1;
        state.calories += ex.caloriesPerRep;
        state.lastRepTime = now;
        updateRepUI();
        beep(state.reps % 10 === 0 ? 1320 : 880);
        speakCount(state.reps);
      }
    }
    state.stage = res.stage;
  }

  if (state.stage === "down") {
    setFeedback("Yaxshi! Endi ko'tariling 💪", "good");
  } else if (state.stage === "up") {
    setFeedback("Pastga tushing ⬇", "");
  } else {
    setFeedback("Mashq holatiga o'ting", "");
  }
}

// ── Chizish ──
function drawPose(landmarks) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
    color: "#22d3ee",
    lineWidth: 3,
  });
  drawingUtils.drawLandmarks(landmarks, {
    color: "#4ade80",
    radius: 4,
  });
  ctx.restore();
}

// ── Asosiy sikl ──
function predictLoop() {
  if (!state.running) return;

  if (video.currentTime !== lastVideoTime && video.videoWidth > 0) {
    lastVideoTime = video.currentTime;
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const result = poseLandmarker.detectForVideo(video, performance.now());
    if (result.landmarks && result.landmarks.length > 0) {
      const lm = result.landmarks[0];
      drawPose(lm);
      processDetection(lm);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setFeedback("Odam topilmadi — kameraga ko'rinib turing", "warn");
      stageEl.textContent = "—";
    }
  }
  requestAnimationFrame(predictLoop);
}

// ── Kamera ──
async function startCamera() {
  startScreen.classList.remove("visible");
  loadingScreen.classList.add("visible");

  try {
    if (!poseLandmarker) {
      $("loading-text").textContent = "AI model yuklanmoqda… (birinchi marta ~10 soniya)";
      const vision = await FilesetResolver.forVisionTasks("./vendor/tasks-vision/wasm");
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "./models/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      drawingUtils = new DrawingUtils(ctx);
    }

    $("loading-text").textContent = "Kamera yoqilmoqda…";
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise((r) => (video.onloadedmetadata = r));
    await video.play();

    const mirror = state.facingMode === "user";
    video.classList.toggle("mirrored", mirror);
    canvas.classList.toggle("mirrored", mirror);

    loadingScreen.classList.remove("visible");
    overlayEl.classList.add("visible");
    state.running = true;
    state.startTime ??= Date.now();
    lastVideoTime = -1;
    setFeedback("Mashqni boshlang!", "good");
    predictLoop();
  } catch (err) {
    loadingScreen.classList.remove("visible");
    startScreen.classList.add("visible");
    if (err.name === "NotAllowedError") {
      setFeedback("Kameraga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.", "bad");
    } else {
      setFeedback(`Xatolik: ${err.message}`, "bad");
    }
    console.error(err);
  }
}

function stopCamera() {
  state.running = false;
  state.holdLast = null; // pauzadan keyin vaqt sakrab ketmasin
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

// ── Boshqaruv tugmalari ──
$("start-btn").addEventListener("click", startCamera);

document.querySelectorAll(".exercise-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".exercise-btn.active")?.classList.remove("active");
    btn.classList.add("active");
    state.exercise = btn.dataset.exercise;
    state.reps = 0;
    state.stage = null;
    state.holdMs = 0;
    state.holdLast = null;
    repCountEl.textContent = "0";
    stageEl.textContent = "—";
    const ex = EXERCISES[state.exercise];
    $("rep-label").textContent = ex.type === "hold" ? "soniya" : "marta";
    exerciseTipEl.textContent = ex.tip;
    if (state.running) {
      setFeedback(`${ex.name}: ${ex.tip}`, "");
    }
  });
});

$("reset-btn").addEventListener("click", () => {
  state.reps = 0;
  state.stage = null;
  state.holdMs = 0;
  state.holdLast = null;
  repCountEl.textContent = "0";
  stageEl.textContent = "—";
  setFeedback("Hisob nolga tushirildi", "");
});

$("camera-flip-btn").addEventListener("click", async () => {
  if (!state.running) return;
  state.facingMode = state.facingMode === "user" ? "environment" : "user";
  stopCamera();
  await startCamera();
});

$("sound-btn").addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  $("sound-btn").textContent = state.soundOn ? "🔊 Ovoz" : "🔇 Ovoz";
});

// Sahifa yopilganda kamerani o'chiramiz.
window.addEventListener("pagehide", stopCamera);

// Boshlang'ich holat
startScreen.classList.add("visible");
exerciseTipEl.textContent = EXERCISES[state.exercise].tip;

// Avtomatik testlar uchun ichki interfeys — sun'iy landmarklar bilan
// sanash mantiqini kamerasiz ham tekshirish imkonini beradi.
window.__sanogichTest = {
  process: processDetection,
  state: () => state,
  setExercise: (name) => {
    state.exercise = name;
    state.stage = null;
    state.holdMs = 0;
    state.holdLast = null;
  },
};
