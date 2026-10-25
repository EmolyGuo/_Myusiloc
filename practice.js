const GOAL = 3;

// songs.js only has songs for levels 1 to 5.
const MAX_SONG_LEVEL = 5;

// Default values, used if nothing has been saved yet.
const defaults = {
  level: 1,
  xpPercent: 0,
  correctPlays: 0,
  totalExp: 0
};

// ---------- Find the elements on the page ----------
const levelLabel = document.getElementById("level-label");
const xpFill = document.getElementById("xp-fill");
const levelUp = document.getElementById("level-up");
const songTitle = document.getElementById("song-title");
const songDetails = document.getElementById("song-details");
const sheetImage = document.getElementById("sheet-image");
const sheetPlaceholder = document.getElementById("sheet-placeholder");
const listening = document.getElementById("listening");
const feedback = document.getElementById("feedback");
const counter = document.getElementById("counter");
const micBox = document.getElementById("mic-box");
const micLabel = document.getElementById("mic-label");
const micNote = document.getElementById("mic-note");
const micFill = document.getElementById("mic-fill");
const micThreshold = document.getElementById("mic-threshold");
const micHint = document.getElementById("mic-hint");
const startButton = document.getElementById("start-button");
const songButton = document.getElementById("song-button");
const fakeCorrect = document.getElementById("fake-correct");
const fakeWrong = document.getElementById("fake-wrong");
const resetButton = document.getElementById("reset-button");

// NEW: pop-up for failed attempts
const grannyOverlay = document.getElementById("granny-overlay");
const grannyImage = document.getElementById("granny-image");

// NEW: the two pictures. One is picked at random each time.
const GRANNY_IMAGES = ["granny1.jpg", "granny2.jpg"];

// These are loaded from storage below.
let correctPlays = 0;
let currentLevel = 1;

let currentSong = null;
let noteStates = [];      // "good" / "close" / "miss" / "current" for each note
let playing = false;

// ---------- Small helper functions ----------
function updateCounter() {
  counter.textContent = correctPlays + " of " + GOAL + " correct plays";
}

function showFeedback(text, kind) {
  feedback.textContent = text;
  feedback.className = "feedback " + kind;
}

function showLevel() {
  levelLabel.textContent = "Level " + currentLevel;
  xpFill.style.width = xp_percent(total_experience) + "%";
}

// Draws the sheet music for the current song (colouring notes as they are played).
function showSheet() {
  sheetImage.src = sheetDataUri(currentSong.notes, noteStates);
  sheetImage.classList.remove("hidden");
  sheetPlaceholder.classList.add("hidden");
}

// ---------- Get a song for the player's current level ----------
function loadSong() {
  if (playing) {
    stop_listening();
  }

  const songLevel = Math.min(currentLevel, MAX_SONG_LEVEL);
  const song = nextSong(songLevel);

  if (song === null) {
    songTitle.textContent = "No songs at this level";
    songDetails.textContent = "";
    return;
  }

  currentSong = song;
  noteStates = [];
  songTitle.textContent = song.title;
  songDetails.textContent = song.composer + "  |  Key of " + song.key + "  |  " + song.bpm + " BPM";
  showSheet();
  levelUp.classList.add("hidden");
  listening.classList.add("hidden");
  startButton.textContent = "Start playing";
  showFeedback("Press \"Start playing\" when you're ready.", "");
}

// ---------- Live microphone meter ----------
// Turns a loudness (RMS) into a bar width. The square root makes quiet
// sounds visible too. Anything past the black line is loud enough to count.
function levelToPercent(rms) {
  return Math.min(100, Math.sqrt(rms / 0.2) * 100);
}

let meterRunning = false;
let quietSince = null;

function runMeter() {
  if (!meterRunning) return;
  const rms = get_input_level();
  const loud = rms >= VOLUME_THRESHOLD;
  micFill.style.width = levelToPercent(rms) + "%";
  micFill.className = "mic-fill" + (loud ? " loud" : "");

  if (loud) {
    micLabel.textContent = "Microphone: hearing sound";
    quietSince = null;
    micHint.classList.add("hidden");
  } else {
    micLabel.textContent = "Microphone: waiting for sound...";
    if (quietSince === null) quietSince = Date.now();
    // Quiet for 4+ seconds while the player is supposed to be playing
    if (playing && Date.now() - quietSince > 4000) micHint.classList.remove("hidden");
  }

  const note = get_last_note();
  micNote.textContent = loud && note ? note : "--";
  requestAnimationFrame(runMeter);
}

function startMeter() {
  if (!micBox) return;      // older practice.html without the meter: skip it
  micThreshold.style.left = levelToPercent(VOLUME_THRESHOLD) + "%";
  micBox.classList.remove("hidden");
  if (!meterRunning) {
    meterRunning = true;
    quietSince = null;
    runMeter();
  }
}

// ---------- Saving progress ----------
// The EXP maths lives in detector.js (earn_exp). This just saves it and updates the screen.
function saveProgress(leveledUp) {
  currentLevel = user_level;
  chrome.storage.local.set({
    totalExp: total_experience,
    level: user_level,
    xpPercent: xp_percent(total_experience)
  });
  showLevel();

  if (leveledUp) {
    levelUp.textContent = "You're so cool! You're now level " + user_level + "!";
    levelUp.classList.remove("hidden");
  }
}

// ---------- THE PLUG-IN POINT ----------
//   handleResult(true)   -> the play was correct
//   handleResult(false)  -> the play was wrong
function handleResult(passed) {
  if (passed) {
    if (correctPlays < GOAL) {
      correctPlays = correctPlays + 1;
      chrome.storage.local.set({ correctPlays: correctPlays });
    }
    updateCounter();

    if (correctPlays >= GOAL) {
      showFeedback("You're unlocked! Go enjoy your scrolling.", "good");
      listening.classList.add("hidden");
    } else {
      showFeedback("Yippee! Correct! Keep going.", "good");
    }
  } else {
    showFeedback("You suck! Try again.", "bad");
  }
}

// NEW: ---------- Pop-up for failed attempts ----------
function showGranny() {
  const pick = Math.floor(Math.random() * GRANNY_IMAGES.length);   // 0 or 1
  grannyImage.src = GRANNY_IMAGES[pick];
  grannyOverlay.classList.remove("hidden");   // show it

  // After 2000 milliseconds (2 seconds), hide it again.
  setTimeout(function () {
    grannyOverlay.classList.add("hidden");
  }, 2000);
}

// ---------- Listening to the player ----------
async function startPlaying() {
  if (playing || !currentSong) return;
  playing = true;
  startButton.disabled = true;
  noteStates = [];
  showSheet();

  try {
    showFeedback("Allow the microphone if Chrome asks...", "");
    await init_audio();            // <- Chrome shows the microphone prompt here
  } catch (error) {
    playing = false;
    startButton.disabled = false;
    if (error && error.name === "NotAllowedError") {
      showFeedback("Microphone is blocked. Click the lock icon next to the address bar, set Microphone to Allow, then reload.", "bad");
    } else if (error && error.name === "NotFoundError") {
      showFeedback("No microphone found. Plug one in and try again.", "bad");
    } else {
      showFeedback("Couldn't start the microphone: " + error, "bad");
    }
    return;
  }

  startMeter();                    // show the live sound meter
  listening.classList.remove("hidden");

  const result = await play_level(currentSong, Math.min(currentLevel, MAX_SONG_LEVEL), {
    onCountdown: function (seconds) {
      showFeedback("Get ready... " + seconds, "");
    },
    onNote: function (index, state) {
      noteStates[index] = state;
      showSheet();
      if (state === "current") {
        showFeedback("Play: " + currentSong.notes[index].replace(/\d/, ""), "");
      }
    }
  });

  playing = false;
  startButton.disabled = false;
  if (result.cancelled) return;     // the player picked a new song

  listening.classList.add("hidden");
  const got = Math.round(result.score * 100) + "%";
  const need = Math.round(result.required * 100) + "%";
  if (result.passed) saveProgress(result.leveledUp);   // EXP was already added in play_level
  handleResult(result.passed);
  startButton.textContent = result.passed ? "Play again" : "Try again";
  if (!result.passed) {
    showGranny();   // NEW
    showFeedback("You suck! Try again. (" + got + " accuracy, you need " + need + ")", "bad");
  }
}

// ---------- Buttons ----------
startButton.addEventListener("click", startPlaying);
songButton.addEventListener("click", loadSong);
fakeCorrect.addEventListener("click", function () {
  const leveledUp = earn_exp(currentLevel * 10);   // the real path does this inside play_level
  saveProgress(leveledUp);
  handleResult(true);
});
fakeWrong.addEventListener("click", function () {
  handleResult(false);
  showGranny();   // NEW
});

// DEMO ONLY: wipes today's plays, EXP and level so you can start over.
if (resetButton) resetButton.addEventListener("click", function () {
  stop_listening();
  correctPlays = 0;
  total_experience = 0;
  user_level = 1;
  currentLevel = 1;
  chrome.storage.local.set({ correctPlays: 0, totalExp: 0, level: 1, xpPercent: 0 });
  updateCounter();
  showLevel();
  loadSong();
  showFeedback("Progress reset. Back to locked, level 1.", "");
});

// Let go of the microphone when the tab closes.
window.addEventListener("beforeunload", function () {
  meterRunning = false;
  stop_audio();
});

// ---------- Load saved data, then show the first song ----------
chrome.storage.local.get(defaults, function (data) {
  correctPlays = data.correctPlays;
  total_experience = data.totalExp;
  user_level = check_level(total_experience);
  currentLevel = user_level;
  updateCounter();
  showLevel();
  loadSong();
});

// If the progress is changed somewhere else (like the popup's Reset button),
// update this page too, so it doesn't keep showing, or save back, old numbers.
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== "local") return;
  if (!changes.correctPlays && !changes.totalExp) return;

  if (changes.correctPlays && changes.correctPlays.newValue !== correctPlays) {
    correctPlays = changes.correctPlays.newValue || 0;
    updateCounter();
  }
  if (changes.totalExp && changes.totalExp.newValue !== total_experience) {
    total_experience = changes.totalExp.newValue || 0;
    user_level = check_level(total_experience);
    currentLevel = user_level;
    showLevel();
  }
  if (correctPlays < GOAL && !playing) {
    showFeedback("Progress was reset. Press \"Start playing\" when you're ready.", "");
  }
});
