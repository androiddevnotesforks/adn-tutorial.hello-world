console.log('This is a popup!');

document.getElementById('sendButton').addEventListener('click', () => {
  const prompt = document.getElementById('promptInput').value;
  if (prompt) {
    // Encode the prompt for URL safety
    const encodedPrompt = encodeURIComponent(prompt);
    
    // Open both URLs in new tabs
    chrome.tabs.create({
      url: `https://grok.com/chat?q=${encodedPrompt}`
    });
    chrome.tabs.create({
      url: `https://x.com/i/grok?text=${encodedPrompt}`
    });
  }
});
