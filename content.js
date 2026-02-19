//Content Script
console.log("YouWillWatch: Content script LOADED and READY.");


let stats= {
    pauseCount:0,
    tabSwitches: 0,
    concentrationMinutes: 0,
    lastResetDate: new Date().toDateString()
};

let mode = 'safe'; // 'safe' or 'strict'
let strictEndTime = null;
let concentrationInterval = null;
let autoResumeTimeout = null;
let videoElement = null;
let overlay = null;
let countdownInterval = null;
let timerElement = null;
let isExtensionEnabled = true;
let styleElement = null; //for youtube sidebar

console.log("YouWillWatch: Content script LOADED and READY.");

let wasVisible = !document.hidden;
let lasstStateChange=0;



// EVENT LISTENERS


// A. Tab Switching (The standard way)
document.addEventListener('visibilitychange', () => {
    // Pass the actual state (True = Hidden, False = Visible)
    console.log("tab switch was detected");
    handleStateChange(document.hidden);
});

// B. Window Blur (Clicking outside Chrome)
window.addEventListener('blur', () => {
    console.log("Event: Window Blur (User clicked away)");
    // FORCE "Hidden" state (True), even if the tab is technically visible
    handleStateChange(true);
});

// C. Window Focus (Coming back)
window.addEventListener('focus', () => {
    console.log("Event: Window Focus");
    // FORCE "Visible" state (False)
    handleStateChange(false);
});





// --- 2. THE NEW HANDLER LOGIC ---
function handleStateChange(isAway) {
    if (!isExtensionEnabled) return;
    if(!videoElement || videoElement.ended || mode === 'safe') return;

    try {
        if (isAway) {
            // --- USER LEFT --- 
            console.log("-> Status: AWAY. Sending signal...");
            
            stats.tabSwitches++;
            saveStats();
            updateOverlay();
            
            chrome.runtime.sendMessage({ type: 'TAB_LEFT' });
            
        } else {
            // --- USER RETURNED ---
            // Only run this if the document is actually visible (prevents duplicate triggers)
            if (document.visibilityState === 'visible') {
                console.log("-> Status: ACTIVE. Cancelling timers.");
                
                chrome.runtime.sendMessage({ type: 'TAB_RETURNED' });
                showNotification("Welcome back! I was about to yell at you.", 'success');
            }
        }
    } catch (error) {
        console.log("⚠️ Context Invalidated. Please refresh the page.");
    }
}

// --- 3. INIT FUNCTION 
(async function init() {
    try {
        console.log("YouWillWatch: Starting Init...");
        
        // Load settings
        const result = await chrome.storage.local.get(['extensionEnabled']);
        if (result.extensionEnabled === false) {
            isExtensionEnabled = false;
            console.log("Extension is DISABLED in storage.");
            return; 
        }
        
        toggleSidebar(true);
        // Load stats and create UI
        await loadStats();
        //createOverlay();
        initVideoTracking();
        startConcentrationTimer();
        
        // Listen for strict mode quit attempts
        window.addEventListener('beforeunload', onBeforeUnload);
        
        console.log("YouWillWatch: Init Complete.");
        
    } catch (error) {
        console.error("YouWillWatch: Init FAILED", error);
    }
})();





//helper function to start a visible countdown
function startCountdown (durationSeconds, message= "Resuming in")
{
    stopCountdown();

    if(!timerElement)
    {
        timerElement= document.createElement('div');
        timerElement.id= 'focus-timer-pill';

        const videoContainer= document.querySelector('#movie_player') || document.body;
        videoContainer.appendChild(timerElement);
    }

    let timeLeft= durationSeconds;

    timerElement.textContent=`${message}: ${formatTime(timeLeft)}`;
    timerElement.style.display= 'block';

    //start the timer interval only if video hasn't ended
    if(!videoElement.ended)
    {

        countdownInterval= setInterval(() => {
            timeLeft--;

            if(timeLeft>0)
                timerElement.textContent=`${message}: ${formatTime(timeLeft)}`;
            else
            {
                stopCountdown();
                if(videoElement && videoElement.paused &&  !videoElement.ended )
                {
                    videoElement.play();
                    showNotification("Aight. Break's over kiddo. Back to work now", 'warning');
                }
            }

        }, 1000);
    }
}


function stopCountdown()
{
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    if (timerElement) {
        timerElement.style.display = 'none';
    }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

//using chrome storage to store stats and load them

async function loadStats()
{
    const result= await chrome.storage.local.get(['stats', 'mode', 'strictEndTime']);

    //resetting for new day
    const today= new Date().toDateString();
    if( result.stats && result.stats.lastResetDate === today)
    {
        stats= result.stats;
    }
    else
    {
        stats.lastResetDate= today;
        saveStats();
    }

    if(result.mode) mode= result.mode;
    if(result.strictEndTime) strictEndTime= result.strictEndTime;

}

async function saveStats()
{
    await chrome.storage.local.set({stats});
}

// function createOverlay()
// {
//     if(overlay) return;

//     overlay= document.createElement('div');
//     overlay.id= 'yt-focus-overlay';
//     overlay.innerHTML= `
//         <div class="stats-header">WHAT ARE YOUR STATS SAYING ABOUT YOU?</div>
//         <div class="stat-item">
//         <span class="stat-label">Pauses:</span>
//         <span class="stat-value" id="pause-count">0</span>
//         </div>
//         <div class="stat-item">
//         <span class="stat-label">Tab Switches:</span>
//         <span class="stat-value" id="tab-switches">0</span>
//         </div>
//         <div class="stat-item">
//         <span class="stat-label">Focus Time:</span>
//         <span class="stat-value" id="focus-time">0m</span>
//         </div>
//         <div class="mode-indicator" id="mode-indicator">Safe Mode</div>
//     `;
    
//     document.body.appendChild(overlay);

//     makeDraggable(overlay);
//     updateOverlay();  
   
// }

function updateOverlay()
{
    if (!overlay) return;

    document.getElementById('pause-count').textContent= stats.pauseCount;
    document.getElementById('tab-switches').textContent= stats.tabSwitches;
    document.getElementById('focus-time').textContent= `${stats.concentrationMinutes}m`;

    const modeIndicator = document.getElementById('mode-indicator');

    if (modeIndicator) {
        modeIndicator.textContent = mode === 'strict' ? 'Strict Mode' : 'Safe Mode';
        modeIndicator.className = `mode-indicator ${mode}`;
    }
}


function startConcentrationTimer()
{
    if(concentrationInterval) return;

    concentrationInterval = setInterval(() => {
        if(videoElement && !videoElement.paused && document.visibilityState== 'visible')
        {
            stats.concentrationMinutes++;
            saveStats();
            updateOverlay();
        }
    }, 60000);
}

function stopConcentrationTime()
{
    if(concentrationInterval)
    {
        clearInterval(concentrationInterval);
        concentrationInterval=null;
    }
}

function onVideoPause()
{
    if (!isExtensionEnabled) return;  //only runs if the extension is enabled


    stats.pauseCount++;
    saveStats();
    updateOverlay();

   stopCountdown();
    if(!videoElement.ended)
    {
        if(mode === 'strict' )
            startCountdown(60, "STRICT MODE: Resuming in:");
    
        else
        {       
            startCountdown(60, "Taking Notes? Hopefully yes. Anyway, we resume in:");
            showProcrastinatorPopup();
        }
    }
    
}

//Video Play

function onVideoPlay()
{
    stopCountdown();

    const popup = document.getElementById('procrastinator-popup');
    if (popup) {
        popup.remove();
    }
}

function showProcrastinatorPopup()
{
    if(videoElement && videoElement.paused && !videoElement.ended )
    {
        if (document.getElementById('procrastinator-popup')) return;

        const popup= document.createElement('div');
        popup.id= 'procrastinator-popup';
        popup.innerHTML= `
        <div class="popup-content">
        <h2>Now Now, why are you pausing?</h2>
        <p>Be honest with yourself...</p>
        <button id="taking-break-btn" class="popup-btn break-btn">Taking a break \(*>_<*)/</button>
        <button id="procrastinating-btn" class="popup-btn procrastinate-btn">Procrastinating o(￣┰￣*)ゞ</button>
        </div>
        
        `;
        document.body.appendChild(popup);

        console.log("the popup of safe mode is here");

        document.getElementById('taking-break-btn').addEventListener('click' ,() =>{

            popup.remove();
            
            showNotification("Alright. 5 Minute break granted. Get back to it soon yeah? I am watching you", 'info');

            startCountdown(300, "Break Time Remaining");
            
            
        });


        document.getElementById('procrastinating-btn').addEventListener('click', () => {
            popup.remove();
            if(videoElement && videoElement.paused && !videoElement.ended)
            {
                videoElement.play();
                showNotification("AHAHAHAHA. You wish!", 'success');
            }
        });
    }
}

//show notification
function showNotification(message, type= 'info')
{
    if(!videoElement) return;
    const notification = document.createElement('div');
    notification.className = `yt-focus-notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
    notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(()=> notification.remove(), 5000);
    },5000);
}

//tracking tab switch and annoying popups

function onBeforeUnload(e)
{
    if(mode === 'strict' && strictEndTime && Date.now()< strictEndTime)
    {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to quit? Your strict mode session is still active by the way. Obviously you cannot deceive me like this';
        return e.returnValue;
    }
}


//DOM manipulation to see if there is a video (by scanning every 1 second) 
function initVideoTracking()
{
    const checkVideo= setInterval(() =>
    {
        const video = document.querySelector('video');

        if  (video && video !== videoElement) 
        {
            videoElement = video;
            
            // Remove old listeners if they exist nahi to overflow type ho jaayega
            if (videoElement.pauseListener) {
                videoElement.removeEventListener('pause', videoElement.pauseListener);
            }
            if (videoElement.playListener) {
                videoElement.removeEventListener('play', videoElement.playListener);
            }
            
            // Add new listeners
            videoElement.pauseListener = onVideoPause;
            videoElement.playListener = onVideoPlay;
            
            videoElement.addEventListener('pause', videoElement.pauseListener);
            videoElement.addEventListener('play', videoElement.playListener);
            
            console.log('YouTube Focus Mode: Video tracking initialized');
        }
    }, 1000);
}

//Listen for messages from popup

chrome.runtime.onMessage.addListener ((message, sender, sendResponse) =>
{
    if (message.action === 'getStats') 
    {
        sendResponse({ stats, mode, strictEndTime });
    } 
    else if (message.action === 'setMode') 
    {
        mode = message.mode;
        if (message.duration && mode === 'strict') {
        strictEndTime = Date.now() + (message.duration * 60000);
        chrome.storage.local.set({ strictEndTime });
        }
        chrome.storage.local.set({ mode });
        updateOverlay();
        sendResponse({ success: true });
    } 
    else if (message.action === 'resetStats')
    {
        stats = {
        pauseCount: 0,
        tabSwitches: 0,
        concentrationMinutes: 0,
        lastResetDate: new Date().toDateString()
        };
        saveStats();
        updateOverlay();
        sendResponse({ success: true });
    }
});




function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    // 1. Load saved position from storage
    chrome.storage.local.get(['overlayPosition'], (result) => {
        if (result.overlayPosition) {
            element.style.top = result.overlayPosition.top;
            element.style.left = result.overlayPosition.left;
            element.style.right = 'auto'; // Important: override the CSS 'right' property
        }
    });

    // 2. Start Dragging
    element.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // Get the current position relative to the viewport
        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Switch from CSS positioning to JS positioning
        element.style.right = 'auto';
        element.style.width = `${rect.width}px`; // Prevent resizing
        element.style.cursor = 'grabbing';
        
        // Prevent default text selection behavior
        e.preventDefault();
    });

    // 3. Move Element (Use document so we don't lose focus if moving fast)
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        element.style.left = `${initialLeft + dx}px`;
        element.style.top = `${initialTop + dy}px`;
    });

    // 4. Stop Dragging & Save Position
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'move';

            // Save the new position so it stays there next time!
            chrome.storage.local.set({
                overlayPosition: {
                    top: element.style.top,
                    left: element.style.left
                }
            });
        }
    });
}


function toggleSidebar(shouldHide) {
    if (shouldHide) {
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'focus-mode-styles';
            styleElement.textContent = `
                /* Hide Recommendations Sidebar */
                #secondary { display: none !important; }
                #related { display: none !important; }
                
                /* Center the video player */
                ytd-watch-flexy[flexy] #primary.ytd-watch-flexy {
                    margin: 0 auto !important;
                    min-width: 0 !important;
                    flex: 1; 
                }
            `;
            document.head.appendChild(styleElement);
            console.log("Sidebar hidden for Focus Mode.");
        }
    } else {
        if (styleElement) {
            styleElement.remove();
            styleElement = null;
            console.log("Sidebar restored.");
        }
    }
}


chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.extensionEnabled) {
        isExtensionEnabled = changes.extensionEnabled.newValue;

        if (isExtensionEnabled) {
            // Re-enable everything
            console.log("Extension Enabled!");
            toggleSidebar(true);
            //if (!overlay) createOverlay();
            initVideoTracking();
            startConcentrationTimer();
            showNotification("Welcome back! Time to focus ^____^ ", 'success');
            
        } else {
            // DISABLE EVERYTHING
            console.log("Extension Disabled.");
            showNotification("So you're relaxing? Okay then (¬_¬')");
            
            // 1. Remove Overlay
            if (overlay) {
                overlay.remove();
                overlay = null;
            }
            

            // 2. Stop Timers
            stopConcentrationTime();
            stopCountdown(); // Use your new helper to stop the pill
            
            // 3. Remove Popup if open
            const popup = document.getElementById('procrastinator-popup');
            if (popup) popup.remove();

            // 4. Stop Video Tracking (Remove listeners)
            if (videoElement) {
                videoElement.removeEventListener('pause', onVideoPause);
                videoElement.removeEventListener('play', onVideoPlay);
                // Clear the reference so initVideoTracking can restart later
                videoElement = null; 
            }

            //5. Youtube side bar comes again
            toggleSidebar(false);
        }
    }
});