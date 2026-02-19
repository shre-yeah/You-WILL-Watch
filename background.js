// Background Service Worker

let tabTimers= {}; //to track the tab switch, as in the time spent in the switched tab that isn't youtube

const Roastmessages = [
    "Back at it already? That was quick... （⊙ｏ⊙）",
    "Focus is a skill. You're practicing distraction.",
    "I am watching you by the way :)",
    "Come onnn. Come back and finish what you started (p≧w≦q)",
    "What was so important that it couldn't wait?",
    "Your future self is disappointed. I am too <( ‵□′)>",
    "Tab switching: the modern art of self-sabotage ",
    "I believe in you by the way. Come back fast",
    "Traitor! You left me! (T_T)",
    "Where do you think you're going? Get back here!",
    "Tick tock. I'm waiting...",
    "Oh look, a buttefly! I mean...a distraction!"
];


// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('You WILL Watch is installed successfully!');
  
  // Initialize storage
  chrome.storage.local.set({
    stats: {
      pauseCount: 0,
      tabSwitches: 0,
      concentrationMinutes: 0,
      lastResetDate: new Date().toDateString()
    },
    mode: 'safe'
  });
    // Check daily for stats reset
    chrome.alarms.create('dailyReset', { periodInMinutes: 60 });
    chrome.alarms.create('checkStrictMode', { periodInMinutes: 1 });
});


//TAB SWITHCIG KA LOGIC 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
{

    if (!sender.tab) return;

    if(message.type === 'TAB_LEFT')
        handleTabLeft(sender.tab.id);
    else if(message.type === 'TAB_RETURNED')
        handleTabReturned(sender.tab.id);

});

function handleTabLeft(tabId)
{
    handleTabReturned(tabId); //just in case any timers exist, we clear them

    console.log(`Tab ${tabId} left. Starting timers...`);

    console.log('tabsleft in background ')
    const randomMsg= Roastmessages[Math.floor(Math.random() * Roastmessages.length)];

    //the 5 sec timer
    const timeoutId = setTimeout(() => {
        sendBrowserNotification("Tab Switch Alert", randomMsg);
    }, 5000);

    //1 minute time
    chrome.alarms.create(`nag_1min_${tabId}`, { delayInMinutes: 1 });

    // Store the timeout ID so we can cancel it if they return fast
    tabTimers[tabId] = timeoutId;

}

function handleTabReturned(tabId)
{
    if(tabTimers[tabId])
    {
        clearTimeout(tabTimers[tabId]);
        delete tabTimers[tabId];
    }

    chrome.alarms.clear(`nag_1min_${tabId}`);
}



chrome.alarms.onAlarm.addListener((alarm) => {

  console.log("alarm triggered");
  if (alarm.name === 'dailyReset') {
    checkAndResetStats();
  } else if (alarm.name === 'checkStrictMode') {
    checkStrictMode();
  }
  else if (alarm.name.startsWith('nag_1min_')){
    sendBrowserNotification("Strict Mode Alert", "It's been a minute. Come back or I'm closing this tab. (Just kidding, but seriously come back)");
}

});

function sendBrowserNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png', 
        title: title,
        message: message,
        priority: 2
    });
}

async function checkAndResetStats() {
  const result = await chrome.storage.local.get(['stats']);
  // Safe check in case stats is undefined
  if (!result.stats) return; 

  const today = new Date().toDateString();
  
  if (result.stats.lastResetDate !== today) {
    chrome.storage.local.set({
      stats: {
        pauseCount: 0,
        tabSwitches: 0,
        concentrationMinutes: 0,
        lastResetDate: today
      }
    });
    console.log('Stats reset for new day');
  }
}

async function checkStrictMode() {
    const result = await chrome.storage.local.get(['strictEndTime', 'mode']);
    
    if (result.strictEndTime && Date.now() >= result.strictEndTime && result.mode === 'strict') {
      chrome.storage.local.set({ mode: 'safe' });
      chrome.storage.local.remove('strictEndTime');
      console.log('Strict mode expired, switched to safe mode');
    }
}