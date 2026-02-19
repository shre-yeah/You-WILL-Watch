// You Will WATCH - popup scritp

let currentMode = 'safe';
let strictEndTime = null;
let updateInterval = null;

// Get the active YouTube tab
async function getYouTubeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab && tab.url && tab.url.includes('youtube.com')) {
    return tab;
  }
  return null;
}

// Update stats display
async function updateStats() {
  const tab = await getYouTubeTab();
  if (!tab) {
    document.getElementById('status').textContent = 'Start watching something first, fam. :/';
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStats' });
    
    document.getElementById('pause-count').textContent = response.stats.pauseCount;
    document.getElementById('tab-switches').textContent = response.stats.tabSwitches;
    document.getElementById('focus-time').textContent = `${response.stats.concentrationMinutes}m`;
    
    currentMode = response.mode;
    strictEndTime = response.strictEndTime;
    
    // Update mode buttons
    document.getElementById('safe-btn').classList.toggle('active', currentMode === 'safe');
    document.getElementById('strict-btn').classList.toggle('active', currentMode === 'strict');
    
    // Update strict mode lock indicator
    updateLockIndicator();
    
    document.getElementById('status').textContent = `Mode: ${currentMode === 'strict' ? '♨_♨ Strict' : '-O- Safe'}`;
  } catch (error) {
    console.log('Error getting stats:', error);
    document.getElementById('status').textContent = 'Refresh the YouTube page';
  }
}

// Update lock indicator
function updateLockIndicator() {
  const lockedIndicator = document.getElementById('locked-indicator');
  const timeRemaining = document.getElementById('time-remaining');
  
  if (strictEndTime && Date.now() < strictEndTime) {
    const remaining = strictEndTime - Date.now();
    const minutes = Math.ceil(remaining / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    lockedIndicator.style.display = 'block';
    timeRemaining.textContent = hours > 0 
      ? `${hours}h ${mins}m remaining` 
      : `${mins}m remaining`;
    
    // Disable mode switching
    document.getElementById('safe-btn').disabled = true;
    document.getElementById('strict-btn').disabled = true;
    document.getElementById('strict-settings').classList.remove('show');
  } else {
    lockedIndicator.style.display = 'none';
    document.getElementById('safe-btn').disabled = false;
    document.getElementById('strict-btn').disabled = false;
    
    if (strictEndTime && Date.now() >= strictEndTime) {
      // Lock expired, switch to safe mode
      setMode('safe');
      strictEndTime = null;
      chrome.storage.local.remove('strictEndTime');
    }
  }
}

// Set mode
async function setMode(mode, duration = null) {
  const tab = await getYouTubeTab();
  if (!tab) {
    alert('Start a video firssttt');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { 
      action: 'setMode', 
      mode: mode,
      duration: duration
    });
    
    currentMode = mode;
    if (duration && mode === 'strict') {
      strictEndTime = Date.now() + (duration * 60000);
    }
    
    updateStats();
    
    if (mode === 'strict' && duration) {
      document.getElementById('status').textContent = `Strict mode activated for ${duration} minutes!`;
    } else {
      document.getElementById('status').textContent = `Mode changed to ${mode}`;
    }
  } catch (error) {
    console.log('Error setting mode:', error);
    alert('Please refresh the YouTube page and try again');
  }
}

// Reset stats
async function resetStats() {
  if (!confirm('Why would you reset stats for the day? It already gets reset at the end of the day. Anyway! This cannot be undone.')) {
    return;
  }

  const tab = await getYouTubeTab();
  if (!tab) {
    alert('Please open a YouTube video first');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'resetStats' });
    updateStats();
    document.getElementById('status').textContent = 'Stats reset!';
  } catch (error) {
    console.log('Error resetting stats:', error);
  }
}




// Event listeners
document.getElementById('safe-btn').addEventListener('click', () => {
  if (!strictEndTime || Date.now() >= strictEndTime) {
    setMode('safe');
    document.getElementById('strict-settings').classList.remove('show');
  }
});

document.getElementById('strict-btn').addEventListener('click', () => {
  if (!strictEndTime || Date.now() >= strictEndTime) {
    document.getElementById('strict-settings').classList.toggle('show');
  }
});

document.getElementById('activate-strict').addEventListener('click', () => {
  const duration = parseInt(document.getElementById('duration-input').value);
  
  if (!duration || duration < 1) {
    alert('Valid input pleaseee (ToT) Atleast a minute');
    return;
  }

  if (!confirm(`You sure you wanna focus for ${duration} minutes? You won't be able to change modes until time is up! Just confirming for formality. I believe in you ㄟ(≧◇≦)ㄏ`)) {
    return;
  }

  setMode('strict', duration);
  document.getElementById('strict-settings').classList.remove('show');
});

document.getElementById('reset-btn').addEventListener('click', resetStats);

// Initialize
updateStats();

// Update every second to keep lock timer current
updateInterval = setInterval(() => {
  updateLockIndicator();
}, 1000);

// Update stats every 5 seconds
setInterval(updateStats, 5000);

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('global-toggle');
    const statusDiv = document.getElementById('status');

    // 1. Load saved state
    chrome.storage.local.get(['extensionEnabled'], (result) => {
        // Default to true if not set
        const isEnabled = result.extensionEnabled !== false; 
        toggle.checked = isEnabled;
        updateStatus(isEnabled);
    });

    // 2. Listen for changes
    toggle.addEventListener('change', () => {
        const isEnabled = toggle.checked;
        
        // Save to storage
        chrome.storage.local.set({ extensionEnabled: isEnabled });
        updateStatus(isEnabled);
    });

    function updateStatus(enabled) {
        statusDiv.textContent = enabled ? "Status: ACTIVE (Good luck!) (/≧▽≦)/" : "Status: DISABLED (Slacker...￣へ￣)";
        
    }
});


