// Draws simple treble-clef sheet music (as SVG) from a list of note names.
// Because it's drawn from the same `notes` list the detector listens for,
// the sheet always matches the song. No image files or internet needed.

const SHEET_LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// "C#4" -> { letter: "C", sharp: true, step: 28 }
// "step" counts white keys: E4 (bottom staff line) = 30, each step up = half a line gap.
function parseSheetNote(note) {
  const letter = note[0];
  const sharp = note[1] === "#";
  const octave = parseInt(note[note.length - 1], 10);
  return { letter: letter, sharp: sharp, step: octave * 7 + SHEET_LETTER_INDEX[letter] };
}

/**
 * notes:  ["C4", "D4", ...]
 * states: optional array, same length, each "good" | "close" | "miss" | "current" | undefined
 * Returns the SVG as a string.
 */
function renderSheetSvg(notes, states) {
  states = states || [];

  const PER_LINE = 8;      // notes per row of music
  const SPACING = 56;      // sideways space per note
  const LEFT = 78;         // room for the clef
  const GAP = 10;          // distance between staff lines
  const ROW_HEIGHT = 150;
  const width = LEFT + PER_LINE * SPACING + 10;
  const rows = Math.ceil(notes.length / PER_LINE);
  const height = rows * ROW_HEIGHT + 10;

  const colors = { good: "#2e9e5b", close: "#e8751a", miss: "#a62828", current: "#a62828", "current-good": "#2e9e5b" };
  let svg = "";

  for (let row = 0; row < rows; row++) {
    const top = 50 + row * ROW_HEIGHT;     // y of the top staff line (F5)
    const bottom = top + 4 * GAP;          // y of the bottom staff line (E4)
    const first = row * PER_LINE;
    const inRow = Math.min(PER_LINE, notes.length - first);
    const rowEnd = LEFT + inRow * SPACING - 10;

    // five staff lines
    for (let l = 0; l < 5; l++) {
      const y = top + l * GAP;
      svg += `<line x1="10" y1="${y}" x2="${rowEnd}" y2="${y}" stroke="#2d2a32" stroke-width="1"/>`;
    }
    // clef + barlines
    svg += `<text x="16" y="${bottom + 12}" font-size="62" fill="#2d2a32" ` +
           `font-family="'Noto Music','Segoe UI Symbol','Apple Symbols',serif">\uD834\uDD1E</text>`;
    svg += `<line x1="10" y1="${top}" x2="10" y2="${bottom}" stroke="#2d2a32"/>`;
    for (let b = 4; b < inRow; b += 4) {
      const bx = LEFT + b * SPACING - SPACING / 2 - 6;
      svg += `<line x1="${bx}" y1="${top}" x2="${bx}" y2="${bottom}" stroke="#2d2a32"/>`;
    }
    svg += `<line x1="${rowEnd}" y1="${top}" x2="${rowEnd}" y2="${bottom}" stroke="#2d2a32" stroke-width="2"/>`;

    for (let i = 0; i < inRow; i++) {
      const index = first + i;
      const n = parseSheetNote(notes[index]);
      const x = LEFT + i * SPACING;
      const y = bottom - (n.step - 30) * (GAP / 2);
      const state = states[index];
      const color = colors[state] || "#2d2a32";

      if (state === "current" || state === "current-good") {
        svg += `<rect x="${x - 22}" y="${top - 30}" width="44" height="${4 * GAP + 100}" rx="8" fill="#fff1d6"/>` +
               `<line x1="${x - 22}" y1="${top}" x2="${x + 22}" y2="${top}" stroke="#2d2a32"/>`;
        // the highlight covers the staff lines, so redraw them in this column
        for (let l = 1; l < 5; l++) {
          const ly = top + l * GAP;
          svg += `<line x1="${x - 22}" y1="${ly}" x2="${x + 22}" y2="${ly}" stroke="#2d2a32"/>`;
        }
      }

      // ledger lines for notes above or below the staff
      for (let e = 28; e >= n.step; e -= 2) {
        const ly = bottom - (e - 30) * (GAP / 2);
        svg += `<line x1="${x - 11}" y1="${ly}" x2="${x + 11}" y2="${ly}" stroke="#2d2a32"/>`;
      }
      for (let e = 40; e <= n.step; e += 2) {
        const ly = bottom - (e - 30) * (GAP / 2);
        svg += `<line x1="${x - 11}" y1="${ly}" x2="${x + 11}" y2="${ly}" stroke="#2d2a32"/>`;
      }

      // note head + stem (stem points down for notes on/above the middle line)
      svg += `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="5" fill="${color}" transform="rotate(-20 ${x} ${y})"/>`;
      if (n.step >= 34) {
        svg += `<line x1="${x - 6}" y1="${y}" x2="${x - 6}" y2="${y + 32}" stroke="${color}" stroke-width="1.5"/>`;
      } else {
        svg += `<line x1="${x + 6}" y1="${y}" x2="${x + 6}" y2="${y - 32}" stroke="${color}" stroke-width="1.5"/>`;
      }
      if (n.sharp) {
        svg += `<text x="${x - 20}" y="${y + 5}" font-size="16" fill="${color}" font-family="Arial,sans-serif">\u266F</text>`;
      }

      // small note name underneath, as a helper for beginners
      svg += `<text x="${x}" y="${bottom + 52}" font-size="12" text-anchor="middle" ` +
             `fill="${color}" font-family="Arial,sans-serif">${notes[index].replace(/\d/, "")}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
         `viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${svg}</svg>`;
}

// Turns the SVG text into something an <img src="..."> can load.
function sheetDataUri(notes, states) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(renderSheetSvg(notes, states));
}

if (typeof module !== "undefined") {
  module.exports = { renderSheetSvg, sheetDataUri };
}