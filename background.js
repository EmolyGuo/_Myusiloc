console.log("background started");

// Same goal as the other files. If you change it, change it everywhere.
const GOAL = 3;

// Default values, used if nothing has been saved yet.
// blockedSites is the list of sites to block. Add more here, like "reddit.com".
const defaults = {
  correctPlays: 0,
  lastResetDate: "",
  blockedSites: ["instagram.com", "tiktok.com", "netflix.com", "youtube.com", "twitch.tv", "crunchyroll.com"]
};

// ---------- Check if a web address belongs to a blocked site ----------
function isBlockedSite(url, blockedSites) {
  let hostname;
  try {
    hostname = new URL(url).hostname;   // "https://www.instagram.com/reels" -> "www.instagram.com"
  } catch (error) {
    return false;                       // not a normal web address, so ignore it
  }

  for (let i = 0; i < blockedSites.length; i++) {
    const site = blockedSites[i];
    // Matches "instagram.com" exactly, or anything ending in ".instagram.com"
    if (hostname === site || hostname.endsWith("." + site)) {
      return true;
    }
  }
  return false;
}

// ---------- Load the saved data, resetting it first if it's a new day ----------
function loadToday(callback) {
  chrome.storage.local.get(defaults, function (data) {
    const today = new Date().toDateString();   // for example "Sat Oct 24 2026"

    if (data.lastResetDate !== today) {
      // Only wipe the plays if this is a NEW day, not the very first run.
      if (data.lastResetDate !== "") {
        data.correctPlays = 0;
      }
      data.lastResetDate = today;
      chrome.storage.local.set({
        correctPlays: data.correctPlays,
        lastResetDate: today
      });
    }

    callback(data);
  });
}

// ---------- The blocker ----------
// This runs every time any tab starts going to a new page.
chrome.webNavigation.onBeforeNavigate.addListener(function (details) {
  // frameId 0 is the main page. Anything else is a small embedded piece, so skip it.
  if (details.frameId !== 0) {
    return;
  }

  loadToday(function (data) {
    const unlocked = data.correctPlays >= GOAL;

    if (!unlocked && isBlockedSite(details.url, data.blockedSites)) {
      // Send this tab to our blocked page instead.
      chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL("blocked.html") });
    }
  });
});

// ---------- Midnight reset ----------
// An alarm wakes this script up at midnight so the plays reset even if
// the user doesn't open any new page.
function setMidnightAlarm() {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);   // 24:00 means the start of tomorrow

  chrome.alarms.create("midnight-reset", {
    when: midnight.getTime(),
    periodInMinutes: 24 * 60        // then repeat every 24 hours
  });
}

chrome.runtime.onInstalled.addListener(setMidnightAlarm);
chrome.runtime.onStartup.addListener(setMidnightAlarm);

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === "midnight-reset") {
    loadToday(function () {});      // loadToday does the reset; nothing else to do
  }
});
