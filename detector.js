// Listens to the microphone and checks whether the player plays a song's notes.
// Used by practice.js. Microphone permission is requested in init_audio(),
// which must run on an extension PAGE (practice.html), not in the popup.

// how much EXP you need for each level
const level_thresholds = { 1: 0, 2: 100, 3: 250, 4: 500, 5: 1000 };

// accuracy needed to pass a song at each level
const level_accuracy = { 1: 0.80, 2: 0.75, 3: 0.70, 4: 0.65, 5: 0.60 };

// The song plays at a steady tempo, like a metronome: ONE NOTE PER BEAT.
// One beat = 60 / BPM seconds (100 BPM = 0.6 s, 150 BPM = 0.4 s).
// The highlight on the sheet moves on this fixed schedule whether or not you hit the note.
// MIN_NOTE_SLOT stops it getting too short for the detector to hear anything.
const BEATS_PER_NOTE = 1;
const MIN_NOTE_SLOT = 0.4;
function note_slot(bpm) {
  return Math.max(MIN_NOTE_SLOT, (60 / bpm) * BEATS_PER_NOTE);
}
const COUNTDOWN = 3;            // seconds before the song starts
const DURATION = 0.1;           // seconds of audio analysed at a time
const VOLUME_THRESHOLD = 0.03;  // quieter than this counts as silence
const MIN_CLARITY = 0.6;        // how "pitched" a sound must be (0 to 1) to count as a note

// true  = playing the right note in any octave counts (guitars sound an octave
//         lower than written, and detectors sometimes jump an octave).
// false = the exact octave is required.
const IGNORE_OCTAVE = true;

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
const percent = (x) => `${Math.round(x * 100)}%`;
const mod = (a, n) => ((a % n) + n) % n;

// ---------- levels ----------
let total_experience = 0; // total amount
let user_level = 1;       // current level

function check_level(total_experience) {
  let level = 1;
  for (const [key, threshold] of Object.entries(level_thresholds)) {
    if (total_experience >= threshold) level = Number(key);
    else break;
  }
  return level;
}

function earn_exp(experience_gained) {
  const old_level = user_level;
  total_experience += experience_gained;
  user_level = check_level(total_experience);

  console.log(`You earned ${experience_gained} EXP!`);
  console.log(`Total EXP: ${total_experience}`);

  if (user_level > old_level) {
    console.log(`You're so cool! You're now: ${user_level}!`);
  } else {
    console.log(`You suck, your level is still: ${user_level}`);
  }
  return user_level > old_level;     // true if this earned a level up
}

// EXP still needed for the next level (0 at max level)
function exp_to_next_level(total_experience) {
  const level = check_level(total_experience);
  if (level === Math.max(...Object.keys(level_thresholds).map(Number))) return 0;
  return level_thresholds[level + 1] - total_experience;
}

// 0-100: how far through the current level the player is
function xp_percent(total_experience) {
  const level = check_level(total_experience);
  const next = level_thresholds[level + 1];
  if (next === undefined) return 100;
  const start = level_thresholds[level];
  return Math.round(((total_experience - start) / (next - start)) * 100);
}

console.log(exp_to_next_level(total_experience));

// ---------- pitch detection (pure function, no microphone needed) ----------
// Uses the normalised autocorrelation method (McLeod). Plain autocorrelation
// often locks on to a lower octave; this picks the FIRST strong peak instead.
function detect_pitch(audio, sampleRate) {
  const n = audio.length;

  // Ignore silence
  let sum_squares = 0;
  for (let i = 0; i < n; i++) sum_squares += audio[i] * audio[i];
  if (Math.sqrt(sum_squares / n) < VOLUME_THRESHOLD) return null;

  const min_lag = Math.floor(sampleRate / 1500);                          // highest pitch ~1500 Hz
  const max_lag = Math.min(Math.floor(sampleRate / 50), (n >> 1) - 1);    // lowest pitch ~50 Hz

  // nsdf[lag] is close to 1 when the wave repeats itself after `lag` samples
  const nsdf = new Float32Array(max_lag + 2);
  for (let lag = 0; lag <= max_lag + 1; lag++) {
    let acf = 0, m = 0;
    for (let i = 0; i < n - lag; i++) {
      acf += audio[i] * audio[i + lag];
      m += audio[i] * audio[i] + audio[i + lag] * audio[i + lag];
    }
    nsdf[lag] = m > 0 ? (2 * acf) / m : 0;
  }

  // Collect the highest point of every positive stretch (after the first one).
  let lag = 1;
  while (lag < max_lag && nsdf[lag] > 0) lag++;     // skip the start-up bump at lag 0
  const peaks = [];
  while (lag < max_lag) {
    while (lag < max_lag && nsdf[lag] <= 0) lag++;
    let peak = -1;
    while (lag < max_lag && nsdf[lag] > 0) {
      if (peak < 0 || nsdf[lag] > nsdf[peak]) peak = lag;
      lag++;
    }
    if (peak >= min_lag) peaks.push(peak);
  }
  if (peaks.length === 0) return null;

  let highest = 0;
  for (const p of peaks) highest = Math.max(highest, nsdf[p]);
  if (highest < MIN_CLARITY) return null;           // noise, not a clear note

  // First peak that is nearly as strong as the strongest one
  let best = peaks.find((p) => nsdf[p] >= 0.9 * highest);

  // Parabolic interpolation for a more exact period
  const a = nsdf[best - 1], b = nsdf[best], c = nsdf[best + 1];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;

  return sampleRate / (best + shift);
}

function freq_to_note(frequency) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  return `${NOTES[mod(midi, 12)]}${Math.floor(midi / 12) - 1}`;
}

function note_to_midi(note) {
  const name = note.slice(0, -1);
  const octave = parseInt(note.slice(-1), 10);
  return (octave + 1) * 12 + NOTES.indexOf(name);
}

// 1 = right note, 0.5 = one semitone off, 0 = wrong
function compare_notes(played, expected) {
  let difference = Math.abs(note_to_midi(played) - note_to_midi(expected));
  if (IGNORE_OCTAVE) {
    difference = difference % 12;
    difference = Math.min(difference, 12 - difference);
  }
  if (difference === 0) return 1;
  if (difference === 1) return 0.5;
  return 0;
}

// ---------- microphone ----------
let audio_context = null;
let analyser = null;
let mic_stream = null;
let stop_requested = false;
let last_note = null;     // most recent note heard (for the on-screen display)

// Asks for the microphone. Chrome shows the "Allow / Block" prompt here.
async function init_audio() {
  if (audio_context) {
    await audio_context.resume();
    return;
  }

  mic_stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  });

  audio_context = new AudioContext();
  await audio_context.resume();

  const needed = Math.ceil(audio_context.sampleRate * DURATION);
  analyser = audio_context.createAnalyser();
  analyser.fftSize = Math.max(8192, 2 ** Math.ceil(Math.log2(needed)));
  audio_context.createMediaStreamSource(mic_stream).connect(analyser);
}

// Releases the microphone (the red recording dot in the tab goes away).
function stop_audio() {
  stop_requested = true;
  if (mic_stream) mic_stream.getTracks().forEach((t) => t.stop());
  if (audio_context) audio_context.close();
  mic_stream = null;
  audio_context = null;
  analyser = null;
  last_note = null;
}

// Lets a running song stop early (e.g. "New song" clicked) without closing the mic.
function stop_listening() {
  stop_requested = true;
}

// How loud the microphone is right now (0 = silent). Used by the on-screen meter.
function get_input_level() {
  if (!analyser) return 0;
  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

function get_last_note() { return last_note; }

// Returns the note being played right now (like "C4"), or null for silence/noise.
async function get_live_note() {
  await sleep(DURATION);

  const sampleRate = audio_context.sampleRate;
  const n = Math.floor(sampleRate * DURATION);
  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);
  const audio = buffer.slice(buffer.length - n);        // newest n samples

  let mean = 0;
  for (let i = 0; i < n; i++) mean += audio[i];
  mean /= n;
  for (let i = 0; i < n; i++) audio[i] -= mean;

  const frequency = detect_pitch(audio, sampleRate);
  last_note = frequency === null ? null : freq_to_note(frequency);
  return last_note;
}

// ---------- scoring a song ----------
// Waits for ONE note. Returns 1 (played it), 0.5 (a semitone off), or 0 (missed).
// A note only counts if it is heard in two checks in a row, so a quick
// accidental blip doesn't pass. If the same note repeats (C, C), the player
// has to stop or change pitch in between, so one long note can't count twice.
async function listen_for_note(expected, previous, window_end, onHit) {
  let gap_seen = !(previous && compare_notes(previous, expected) === 1);
  let in_a_row = 0;
  let best = 0;

  while (Date.now() < window_end && !stop_requested) {
    const played = await get_live_note();
    if (played === null) {
      gap_seen = true;
      in_a_row = 0;
      continue;
    }

    const score = compare_notes(played, expected);
    if (score === 1) {
      if (!gap_seen) continue;                 // still ringing from the last note
      in_a_row++;
      if (in_a_row >= 2) {
        if (onHit) onHit();
        return 1;
      }
    } else {
      gap_seen = true;
      in_a_row = 0;
      best = Math.max(best, score);
    }
  }
  return best;
}

// hooks (all optional):
//   onCountdown(secondsLeft)
//   onNote(index, "current" | "current-good" | "good" | "close" | "miss")
async function song_percentage(notes, bpm, hooks) {
  hooks = hooks || {};
  if (!notes || notes.length === 0) return 0;

  stop_requested = false;
  await init_audio();

  console.log("Get ready...");
  for (let i = COUNTDOWN; i > 0 && !stop_requested; i--) {
    console.log(i);
    if (hooks.onCountdown) hooks.onCountdown(i);
    await sleep(1);
  }

  const slot_ms = note_slot(bpm) * 1000;
  const song_start = Date.now();
  let total = 0;
  for (let i = 0; i < notes.length && !stop_requested; i++) {
    const slot_end = song_start + (i + 1) * slot_ms;     // fixed schedule, no drifting
    console.log(`Play ${notes[i]}`);
    if (hooks.onNote) hooks.onNote(i, "current");

    const score = await listen_for_note(
      notes[i], i > 0 ? notes[i - 1] : null, slot_end,
      function () { if (hooks.onNote) hooks.onNote(i, "current-good"); }
    );

    // Keep the highlight on this note until its beat is over, then move on.
    while (Date.now() < slot_end && !stop_requested) await sleep(0.01);

    console.log(`  score: ${percent(score)}`);
    if (hooks.onNote) hooks.onNote(i, score === 1 ? "good" : score > 0 ? "close" : "miss");
    total += score;
  }

  return stop_requested ? null : total / notes.length;
}

// Plays one song attempt. Returns { cancelled, passed, score, required, leveledUp }.
async function play_level(song, level, hooks) {
  const score = await song_percentage(song.notes, song.bpm, hooks);
  if (score === null) return { cancelled: true, passed: false, score: 0, required: 0, leveledUp: false };

  const required_score = level_accuracy[level];

  console.log(`\nYour accuracy: ${percent(score)}`);
  console.log(`Required accuracy: ${percent(required_score)}`);

  if (score >= required_score) {
    console.log("Yippee!");

    const experience_gained = level * 10;
    const leveledUp = earn_exp(experience_gained);

    return { cancelled: false, passed: true, score: score, required: required_score, leveledUp: leveledUp };
  } else {
    console.log("You suck! Try again.");
    return { cancelled: false, passed: false, score: score, required: required_score, leveledUp: false };
  }
}

// lets `node detector.js`-style tests import the pure functions
if (typeof module !== "undefined") {
  module.exports = { detect_pitch, freq_to_note, compare_notes, check_level, xp_percent, earn_exp };
}