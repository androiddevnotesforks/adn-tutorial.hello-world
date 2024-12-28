console.log('This is a popup!');

// Focus on the prompt input field when popup opens
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('promptInput').focus();
});

// URL mapping
const URLS = {
  grok: (prompt) => `https://grok.com/chat?q=${prompt}`,
  x: (prompt) => `https://x.com/i/grok?text=${prompt}`,
  chatgpt: (prompt) => `https://chatgpt.com/?q=${prompt}`
};

// Add event listeners to checkboxes to enforce 1-2 selection
document.querySelectorAll('input[name="sites"]').forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    const checked = document.querySelectorAll('input[name="sites"]:checked');
    if (checked.length > 2) {
      checkbox.checked = false;
    }
  });
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

        // Wait a bit for windows to settle
        setTimeout(async () => {
          // Ensure windows are positioned correctly
          await chrome.windows.update(firstWindow.id, {
            left: 0,
            top: 0,
            width: windowWidth,
            height: screenHeight,
            state: 'normal'
          });
          
          await chrome.windows.update(secondWindow.id, {
            left: windowWidth,
            top: 0,
            width: windowWidth,
            height: screenHeight,
            state: 'normal'
          });
        }, 500);
      }
    }
  } catch (error) {
    console.error('Error creating windows:', error);
  }
}

// Listen for Enter key on input
document.getElementById('promptInput').addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    executePrompt();
  }
});

// Listen for button click
document.getElementById('sendButton').addEventListener('click', executePrompt);
