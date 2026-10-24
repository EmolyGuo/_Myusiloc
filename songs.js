// Every song has a `notes` list: the notes the player has to play, in order.
// The sheet music is drawn from this list (see sheet.js), and the detector
// listens for these same notes (see detector.js), so they always match.
// Note names: letter + optional "#" + octave. Middle C is "C4".
//
// Only public-domain tunes are included, and each one is just the opening
// phrase. Double-check the notes against real sheet music before shipping.
const SONGS = [
  // level 1
  { title: "Twinkle, Twinkle, Little Star", composer: "Traditional", key: "C", bpm: 100, level: 1,
    notes: ["C4","C4","G4","G4","A4","A4","G4","F4","F4","E4","E4","D4","D4","C4"] },
  { title: "Mary Had a Little Lamb", composer: "Traditional", key: "C", bpm: 100, level: 1,
    notes: ["E4","D4","C4","D4","E4","E4","E4","D4","D4","D4","E4","G4","G4"] },
  { title: "Hot Cross Buns", composer: "Traditional", key: "C", bpm: 100, level: 1,
    notes: ["E4","D4","C4","E4","D4","C4","C4","C4","C4","C4","D4","D4","D4","D4","E4","D4","C4"] },
  { title: "Frère Jacques", composer: "Traditional", key: "C", bpm: 100, level: 1,
    notes: ["C4","D4","E4","C4","C4","D4","E4","C4","E4","F4","G4","E4","F4","G4"] },
  // level 2
  { title: "Ode to Joy", composer: "Beethoven", key: "C", bpm: 108, level: 2,
    notes: ["E4","E4","F4","G4","G4","F4","E4","D4","C4","C4","D4","E4","E4","D4","D4"] },
  { title: "Amazing Grace", composer: "Traditional", key: "G", bpm: 72, level: 2,
    notes: ["D4","G4","B4","G4","B4","A4","G4","E4","D4"] },
  { title: "Jingle Bells", composer: "James Lord Pierpont", key: "G", bpm: 120, level: 2,
    notes: ["B4","B4","B4","B4","B4","B4","B4","D5","G4","A4","B4"] },
  { title: "London Bridge", composer: "Traditional", key: "C", bpm: 1023, level: 2,
    notes: ["G4","A4","G4","F4","E4","F4","G4","D4","E4","F4","E4","F4","G4"] },
  { title: "The Blue Danube", composer: "Johann Strauss", key: "D", bpm: 60, level: 2,
    notes: ["D4","D4","F#4","A4","A4"] },
  // level 3
  { title: "Greensleeves", composer: "Traditional", key: "Em", bpm: 90, level: 3,
    notes: ["G4","A4","B4","C5","B4","A4","F#4","D4","E4","F#4","G4","E4"] },
  { title: "Scarborough Fair", composer: "Traditional", key: "Dm", bpm: 84, level: 3,
    notes: ["D4","D4","A4","A4","E4","A4","G4","F4","E4","D4"] },
  { title: "Minuet in G", composer: "Petzold (attr. Bach)", key: "G", bpm: 120, level: 3,
    notes: ["D5","G4","A4","B4","C5","D5","G4","G4","E5","C5","D5","E5","F#5","G5"] },
  { title: "Canon in D", composer: "Pachelbel", key: "D", bpm: 60, level: 3,
    notes: ["F#5","E5","D5","C#5","B4","A4","B4","C#5"] },
  // level 4
  { title: "Fur Elise", composer: "Beethoven", key: "Am", bpm: 72, level: 4,
    notes: ["E5","D#5","E5","D#5","E5","B4","D5","C5","A4"] },
  { title: "Moonlight Sonata (1st mvt)", composer: "Beethoven", key: "C#m", bpm: 54, level: 4,
    notes: ["G#3","C#4","E4","G#3","C#4","E4","G#3","C#4","E4","G#3","C#4","E4"] },
  { title: "Prelude in C", composer: "J. S. Bach", key: "C", bpm: 60, level: 4,
    notes: ["C4","E4","G4","C5","E5","G4","C5","E5"] },
  { title: "Eine kleine Nachtmusik", composer: "Mozart", key: "G", bpm: 130, level: 4,
    notes: ["G4","D4","G4","D4","G4","D4","G4","B4","D5"] },
  // level 5
  { title: "Flight of the Bumblebee", composer: "Rimsky-Korsakov", key: "Am", bpm: 94, level: 5,
    notes: ["E5","D#5","D5","C#5","D5","D#5","D5","C#5"] },
  { title: "In the Hall of the Mountain King", composer: "Grieg", key: "Bm", bpm: 106, level: 5,
    notes: ["B3","C#4","D4","E4","F#4","D4","F#4","E4","C#4","E4","D4","B3","D4"] },
  { title: "Turkish March", composer: "Mozart", key: "Am", bpm: 141, level: 5,
    notes: ["B4","A4","G#4","A4","C5","D5","C5","B4","C5","E5"] },
];


// ---------------- memory between calls ----------------
const songsLeft = {};  // level -> songs not yet played this round
const lastSong = {};   // level -> title of the song played most recently at that level


/** Return a shuffled copy of an array (Fisher-Yates shuffle). */
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}


/** Return ONE song at the chosen level, or null if that level has no songs. */
function nextSong(level) {
  const allAtLevel = SONGS.filter((s) => s.level === level);
  if (allAtLevel.length === 0) return null;

  if (!songsLeft[level] || songsLeft[level].length === 0) {
    songsLeft[level] = shuffle(allAtLevel);
    // Don't let the first song of a new round match the last song of the old one.
    if (allAtLevel.length > 1 && songsLeft[level][0].title === lastSong[level]) {
      songsLeft[level].push(songsLeft[level].shift());
    }
  }

  const song = songsLeft[level].shift();
  lastSong[level] = song.title;
  return song;
}
