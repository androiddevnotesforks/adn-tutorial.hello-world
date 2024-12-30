console.log('This is a popup!');

// Function to save selected sites and mode
function saveSettings() {
  const selectedSites = Array.from(document.querySelectorAll('input[name="sites"]:checked'))
    .map(cb => cb.value);
  const selectedMode = document.querySelector('input[name="mode"]:checked').value;
  chrome.storage.local.set({ selectedSites, selectedMode });
}

// Function to restore selected sites and mode
function restoreSettings() {
  // First uncheck all checkboxes
  document.querySelectorAll('input[name="sites"]').forEach(checkbox => {
    checkbox.checked = false;
  });
  
  // Restore saved selections and mode
  chrome.storage.local.get(['selectedSites', 'selectedMode'], (result) => {
    // Handle site selections
    if (result.selectedSites && result.selectedSites.length > 0) {
      // Use saved selections if they exist
      result.selectedSites.forEach(site => {
        const checkbox = document.querySelector(`input[value="${site}"]`);
        if (checkbox) checkbox.checked = true;
      });
    } else {
      // Use defaults only if no saved selections exist
      const defaultSites = ['grok', 'chatgpt'];
      defaultSites.forEach(site => {
        const checkbox = document.querySelector(`input[value="${site}"]`);
        if (checkbox) checkbox.checked = true;
      });
    }

    // Handle display mode
    if (result.selectedMode) {
      const modeInput = document.querySelector(`input[name="mode"][value="${result.selectedMode}"]`);
      if (modeInput) modeInput.checked = true;
    } else {
      // Default to split mode if no saved preference
      const splitModeInput = document.querySelector('input[name="mode"][value="split"]');
      if (splitModeInput) splitModeInput.checked = true;
    }

    // Save initial settings if this was the first load
    if (!result.selectedSites || !result.selectedMode) {
      saveSettings();
    }
  });
}

// Focus on the prompt input field when popup opens
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('promptInput').focus();
  restoreSettings();
});

// URL mapping
const URLS = {
  grok: (prompt) => `https://grok.com/chat?q=${prompt}`,
  x: (prompt) => `https://x.com/i/grok?text=${prompt}`,
  chatgpt: (prompt) => `https://chatgpt.com/?q=${prompt}`,
  perplexity: (prompt) => `https://www.perplexity.ai/?q=${prompt}`,
  google: (prompt) => `https://www.google.com/search?q=${prompt}`


};

// Add event listeners to checkboxes to enforce 1-2 selection
document.querySelectorAll('input[name="sites"]').forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    const checked = document.querySelectorAll('input[name="sites"]:checked');
    if (checked.length > 2) {
      checkbox.checked = false;
    }
    saveSettings();
  });
});

// Add event listener for mode changes
document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', saveSettings);
});

// Function to execute the prompt
async function executePrompt() {
  const prompt = document.getElementById('promptInput').value;
  if (!prompt) return;

  // Get selected sites
  const selectedSites = Array.from(document.querySelectorAll('input[name="sites"]:checked'))
    .map(cb => cb.value);

  if (selectedSites.length === 0) {
    alert('Please select at least one website');
    return;
  }

  const encodedPrompt = encodeURIComponent(prompt);
  const mode = document.querySelector('input[name="mode"]:checked').value;
  
  try {
    if (mode === 'normal') {
      // Open selected URLs in tabs
      selectedSites.forEach(site => {
        chrome.tabs.create({ url: URLS[site](encodedPrompt) });
      });
    } else {
      // Split screen mode
      const screenWidth = window.screen.availWidth;
      const screenHeight = window.screen.availHeight;
      
      if (selectedSites.length === 1) {
        // Single window mode
        await chrome.windows.create({
          url: URLS[selectedSites[0]](encodedPrompt),
          state: 'maximized'
        });
      } else {
        // Two windows side by side
        const windowWidth = Math.floor(screenWidth / 2);
        
        try {
          // Create first window
          const firstWindow = await chrome.windows.create({
            url: URLS[selectedSites[0]](encodedPrompt),
            left: 0,
            top: 0,
            width: windowWidth,
            height: screenHeight,
            state: 'normal'
          });

          // Create second window
          const secondWindow = await chrome.windows.create({
            url: URLS[selectedSites[1]](encodedPrompt),
            left: windowWidth,
            top: 0,
            width: windowWidth,
            height: screenHeight,
            state: 'normal'
          });

          // Function to position windows with retry
          const positionWindows = async (attempt = 1) => {
            try {
              await Promise.all([
                chrome.windows.update(firstWindow.id, {
                  left: 0,
                  top: 0,
                  width: windowWidth,
                  height: screenHeight,
                  state: 'normal'
                }),
                chrome.windows.update(secondWindow.id, {
                  left: windowWidth,
                  top: 0,
                  width: windowWidth,
                  height: screenHeight,
                  state: 'normal'
                })
              ]);
            } catch (error) {
              if (attempt < 3) {
                // Retry up to 3 times with increasing delay
                setTimeout(() => positionWindows(attempt + 1), 750 * attempt);
              }
            }
          };

          // Initial positioning with delay to let windows settle
          setTimeout(() => positionWindows(), 750);
        } catch (error) {
          console.error('Error in split screen:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error creating windows:', error);
  }
}

// Listen for Enter key on input
document.getElementById('promptInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      // Allow the default behavior for Shift+Enter (new line)
      return;
    } else {
      // Prevent default and execute prompt for Enter alone
      event.preventDefault();
      executePrompt();
    }
  }
});

// Listen for button click
document.getElementById('sendButton').addEventListener('click', executePrompt);
