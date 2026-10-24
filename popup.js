const GOAL = 3; // correct plays needed to unlock

// Default values, used the first time before anything has been saved.
const defaults = {
  level: 1,
  xpPercent: 0,
  correctPlays: 0
};

// ---------- Find the elements on the page ----------
// getElementById is like looking up a variable by its name tag.
const statusCard = document.getElementById("status-card");
const statusTitle = document.getElementById("status-title");
const statusDetail = document.getElementById("status-detail");
const levelLabel = document.getElementById("level-label");
const xpFill = document.getElementById("xp-fill");
const startButton = document.getElementById("start-button");
const resetButton = document.getElementById("reset-button");

// ---------- Function: update the screen using the data ----------
function showData(data) {
  levelLabel.textContent = "Level " + data.level;
  xpFill.style.width = data.xpPercent + "%";

  if (data.correctPlays >= GOAL) {
    // Goal reached: show the green "unlocked" look
    statusCard.className = "status-card unlocked";
    statusTitle.textContent = "Unlocked";
    statusDetail.textContent = "Enjoy your scrolling!";
  } else {
    // Goal not reached: show the red "locked" look
    statusCard.className = "status-card locked";
    statusTitle.textContent = "Locked";
    statusDetail.textContent = data.correctPlays + " of " + GOAL + " correct plays today";
  }
}

// ---------- Load saved data when the popup opens ----------
// chrome.storage.local is the extension's saved memory.
// If something hasn't been saved yet, it falls back to the defaults above.
chrome.storage.local.get(defaults, function (data) {
  showData(data);
});

// ---------- Buttons ----------
startButton.addEventListener("click", function () {
  // Opens practice.html in a new tab (we'll make that page later).
  chrome.tabs.create({ url: chrome.runtime.getURL("practice.html") });
});

// DEMO ONLY: clears plays, EXP and level, so the sites get blocked again.
resetButton.addEventListener("click", function () {
  const cleared = { correctPlays: 0, totalExp: 0, level: 1, xpPercent: 0 };
  chrome.storage.local.set(cleared, function () {
    showData(cleared);
  });
});