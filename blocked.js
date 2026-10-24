// Same goal as the popup. If you change it, change it in both files.
const GOAL = 3;

// Default value, used if nothing has been saved yet.
const defaults = {
  correctPlays: 0
};

// ---------- Find the elements on the page ----------
const heading = document.getElementById("heading");
const remainingNumber = document.getElementById("remaining-number");
const message = document.getElementById("message");
const startButton = document.getElementById("start-button");

// ---------- Function: update the screen using the saved data ----------
function showData(data) {
  const remaining = GOAL - data.correctPlays;

  if (remaining <= 0) {
    // Already unlocked (for example, if someone opens this page directly)
    heading.textContent = "You're unlocked!";
    remainingNumber.textContent = "0";
    remainingNumber.className = "big-number unlocked";
    message.textContent = "Go ahead and scroll. You earned it.";
    startButton.textContent = "Practice more";
  } else {
    // Still locked: show how many plays are left
    heading.textContent = "Practice first!";
    remainingNumber.textContent = remaining;

    // "1 more correct play" vs "2 more correct plays"
    if (remaining === 1) {
      message.textContent = "more correct play to unlock";
    } else {
      message.textContent = "more correct plays to unlock";
    }
  }
}

// ---------- Load saved data when the page opens ----------
chrome.storage.local.get(defaults, function (data) {
  showData(data);
});

// ---------- Button ----------
startButton.addEventListener("click", function () {
  // Go to the practice page in this same tab (we'll make it later).
  window.location.href = "practice.html";
});