console.log('This is a popup!');

document.getElementById('sendButton').addEventListener('click', async () => {
  const prompt = document.getElementById('promptInput').value;
  if (!prompt) return;

  const encodedPrompt = encodeURIComponent(prompt);
  const mode = document.querySelector('input[name="mode"]:checked').value;
  
  try {
    if (mode === 'normal') {
      // Create an array of URLs to open
      const urls = [
        `https://grok.com/chat?q=${encodedPrompt}`,
        `https://x.com/i/grok?text=${encodedPrompt}`
      ];
      
      // Open all URLs at once
      for (const url of urls) {
        chrome.tabs.create({ url });
      }
    } else {
      // Split screen mode
      const screenWidth = window.screen.availWidth;
      const screenHeight = window.screen.availHeight;
      const windowWidth = Math.floor(screenWidth / 2);
      
      // Create first window on the left side
      const leftWindow = await chrome.windows.create({
        url: `https://grok.com/chat?q=${encodedPrompt}`,
        left: 0,
        top: 0,
        width: windowWidth,
        height: screenHeight,
        state: 'normal'
      });

      // Create second window on the right side
      const rightWindow = await chrome.windows.create({
        url: `https://x.com/i/grok?text=${encodedPrompt}`,
        left: windowWidth,
        top: 0,
        width: windowWidth,
        height: screenHeight,
        state: 'normal'
      });

      // Wait a bit for windows to settle
      setTimeout(async () => {
        // Update window positions to ensure they're side by side
        await chrome.windows.update(leftWindow.id, {
          left: 0,
          top: 0,
          width: windowWidth,
          height: screenHeight,
          state: 'normal'
        });
        
        await chrome.windows.update(rightWindow.id, {
          left: windowWidth,
          top: 0,
          width: windowWidth,
          height: screenHeight,
          state: 'normal'
        });
      }, 500);
    }
  } catch (error) {
    console.error('Error creating windows:', error);
  }
});
