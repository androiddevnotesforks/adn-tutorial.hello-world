console.log('This is a popup!');

// Function to save selected sites and mode
function saveSettings() {
  const selectedSites = Array.from(document.querySelectorAll('input[name="sites"]:checked'))
    .map(cb => cb.value);
  const selectedMode = document.querySelector('input[name="mode"]:checked').value;
  const splitDirections = {};
  document.querySelectorAll('.split-control.active').forEach(btn => {
    splitDirections[btn.dataset.site] = btn.dataset.direction;
  });
  const halfScreenHover = document.getElementById('halfScreenHover').checked;
  const halfScreenVerticalHover = document.getElementById('halfScreenVerticalHover').checked;
  const globalDirection = document.querySelector('.split-all-button.active')?.dataset.direction || null;
  chrome.storage.local.set({ selectedSites, selectedMode, splitDirections, halfScreenHover, halfScreenVerticalHover, globalDirection });
}

// Function to restore selected sites and mode
function restoreSettings() {
  // First uncheck all checkboxes
  document.querySelectorAll('input[name="sites"]').forEach(checkbox => {
    checkbox.checked = false;
  });
  
  // Restore saved selections and mode
  chrome.storage.local.get(['selectedSites', 'selectedMode', 'splitDirections', 'halfScreenHover', 'halfScreenVerticalHover', 'globalDirection'], (result) => {
    // Handle site selections
    if (result.selectedSites && result.selectedSites.length > 0) {
      result.selectedSites.forEach(site => {
        const checkbox = document.querySelector(`input[value="${site}"]`);
        if (checkbox) checkbox.checked = true;
      });
    } else {
      const defaultSites = ['grok', 'chatgpt'];
      defaultSites.forEach(site => {
        const checkbox = document.querySelector(`input[value="${site}"]`);
        if (checkbox) checkbox.checked = true;
      });
    }

    // Handle half-screen hover setting
    const halfScreenHoverCheckbox = document.getElementById('halfScreenHover');
    if (halfScreenHoverCheckbox) {
      halfScreenHoverCheckbox.checked = result.halfScreenHover || false;
    }
    const halfScreenVerticalHoverCheckbox = document.getElementById('halfScreenVerticalHover');
    if (halfScreenVerticalHoverCheckbox) {
      halfScreenVerticalHoverCheckbox.checked = result.halfScreenVerticalHover || false;
    }

    // Handle display mode
    if (result.selectedMode) {
      const modeInput = document.querySelector(`input[name="mode"][value="${result.selectedMode}"]`);
      if (modeInput) {
        modeInput.checked = true;
        toggleSplitControls(result.selectedMode === 'split');
      }
    } else {
      // Default to split mode if no saved preference
      const splitModeInput = document.querySelector('input[name="mode"][value="split"]');
      if (splitModeInput) {
        splitModeInput.checked = true;
        toggleSplitControls(true);
      }
    }

    // Handle split directions
    if (result.splitDirections) {
      Object.entries(result.splitDirections).forEach(([site, direction]) => {
        const button = document.querySelector(`.split-control[data-site="${site}"][data-direction="${direction}"]`);
        if (button) {
          // Deactivate other button in the pair
          const otherDirection = direction === 'vertical' ? 'horizontal' : 'vertical';
          const otherButton = document.querySelector(`.split-control[data-site="${site}"][data-direction="${otherDirection}"]`);
          if (otherButton) otherButton.classList.remove('active');
          button.classList.add('active');
        }
      });
    } else {
      // Set default vertical split for all sites
      document.querySelectorAll('.split-control[data-direction="vertical"]').forEach(btn => {
        btn.classList.add('active');
      });
    }

    // Handle global direction and hover options visibility
    if (result.globalDirection) {
      document.querySelectorAll('.split-all-button').forEach(button => {
        if (button.dataset.direction === result.globalDirection) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      toggleHoverOptions(result.globalDirection);
    } else {
      toggleHoverOptions(null);
    }

    // Save initial settings if this was the first load
    if (!result.selectedSites || !result.selectedMode) {
      saveSettings();
    }
  });
}

// URL mapping
const DEFAULT_URLS = {
  grok: (prompt) => `https://grok.com/chat?q=${prompt}`,
  x: (prompt) => `https://x.com/i/grok?text=${prompt}`,
  chatgpt: (prompt) => `https://chatgpt.com/?q=${prompt}`,
  perplexity: (prompt) => `https://www.perplexity.ai/?q=${prompt}`,
  google: (prompt) => `https://www.google.com/search?q=${prompt}`
};

let URLS = { ...DEFAULT_URLS };

// Function to save custom sites
function saveCustomSites() {
  const customSites = Object.keys(URLS).reduce((acc, key) => {
    if (!DEFAULT_URLS[key]) {
      // Store the URL template directly
      const fn = URLS[key];
      const dummyPrompt = '{prompt}';
      const template = fn(dummyPrompt);
      acc[key] = template;
    }
    return acc;
  }, {});
  chrome.storage.local.set({ customSites });
}

// Function to restore custom sites
function restoreCustomSites() {
  chrome.storage.local.get(['customSites'], (result) => {
    if (result.customSites) {
      Object.entries(result.customSites).forEach(([key, template]) => {
        // Create the function from the template
        URLS[key] = (prompt) => template.replace('{prompt}', prompt);
        addWebsiteToUI(key);
      });
    }
  });
}

// Function to add a website to the UI
function addWebsiteToUI(name) {
  const checkboxGroup = document.querySelector('.checkbox-group');
  const websiteItem = document.createElement('div');
  websiteItem.className = 'website-item';
  
  // Create the website item with controls
  websiteItem.innerHTML = `
    <input type="checkbox" name="sites" value="${name}">
    <span>${name}</span>
    <div class="website-controls">
      <button class="split-control active" data-site="${name}" data-direction="vertical">Vertical</button>
      <button class="split-control" data-site="${name}" data-direction="horizontal">Horizontal</button>
      ${!DEFAULT_URLS[name] ? '<button class="remove-site" title="Remove this website">Remove</button>' : ''}
    </div>
  `;
  
  // Add checkbox event listener
  const checkbox = websiteItem.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    saveSettings();
  });
  
  // Add split control listeners
  websiteItem.querySelectorAll('.split-control').forEach(button => {
    button.addEventListener('click', () => {
      const site = button.dataset.site;
      const direction = button.dataset.direction;
      
      // Toggle active state
      const otherDirection = direction === 'vertical' ? 'horizontal' : 'vertical';
      const otherButton = websiteItem.querySelector(`.split-control[data-direction="${otherDirection}"]`);
      
      if (otherButton) {
        otherButton.classList.remove('active');
      }
      button.classList.add('active');
      
      saveSettings();
    });
  });
  
  if (!DEFAULT_URLS[name]) {
    const removeButton = websiteItem.querySelector('.remove-site');
    if (removeButton) {
      removeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        delete URLS[name];
        websiteItem.remove();
        saveCustomSites();
        saveSettings();
      });
    }
  }
  
  // Insert at the end of the checkbox group
  checkboxGroup.appendChild(websiteItem);
  
  // Save settings without automatically checking the checkbox
  saveSettings();
}

// Add custom website handler
document.getElementById('addCustomSite').addEventListener('click', () => {
  const nameInput = document.getElementById('customSiteName');
  const urlInput = document.getElementById('customSiteUrl');
  
  const name = nameInput.value.trim();
  const urlTemplate = urlInput.value.trim();
  
  if (!name || !urlTemplate) {
    alert('Please enter both name and URL template');
    return;
  }
  
  if (URLS[name]) {
    alert('A website with this name already exists');
    return;
  }
  
  if (!urlTemplate.includes('{prompt}')) {
    alert('URL template must include {prompt} placeholder');
    return;
  }
  
  // Add to URLS object
  URLS[name] = (prompt) => urlTemplate.replace('{prompt}', prompt);
  
  // Add to UI
  addWebsiteToUI(name);
  
  // Save to storage
  saveCustomSites();
  
  // Clear inputs
  nameInput.value = '';
  urlInput.value = '';
});

// Initialize custom sites on load
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('promptInput').focus();
  
  // Add event listeners for half-screen hover checkboxes
  const halfScreenHoverCheckbox = document.getElementById('halfScreenHover');
  if (halfScreenHoverCheckbox) {
    halfScreenHoverCheckbox.addEventListener('change', saveSettings);
  }
  const halfScreenVerticalHoverCheckbox = document.getElementById('halfScreenVerticalHover');
  if (halfScreenVerticalHoverCheckbox) {
    halfScreenVerticalHoverCheckbox.addEventListener('change', saveSettings);
  }

  // Initialize split controls for all websites (default and custom)
  document.querySelectorAll('.split-control').forEach(button => {
    button.addEventListener('click', () => {
      const site = button.dataset.site;
      const direction = button.dataset.direction;
      
      // Toggle active state
      const otherDirection = direction === 'vertical' ? 'horizontal' : 'vertical';
      const otherButton = document.querySelector(`.split-control[data-site="${site}"][data-direction="${otherDirection}"]`);
      
      if (otherButton) {
        otherButton.classList.remove('active');
      }
      button.classList.add('active');
      
      saveSettings();
    });
  });

  // First restore custom sites without saving settings
  chrome.storage.local.get(['customSites'], (result) => {
    if (result.customSites) {
      Object.entries(result.customSites).forEach(([key, template]) => {
        // Create the function from the template
        URLS[key] = (prompt) => template.replace('{prompt}', prompt);
        // Add to UI without saving settings
        const checkboxGroup = document.querySelector('.checkbox-group');
        const websiteItem = document.createElement('div');
        websiteItem.className = 'website-item';
        
        websiteItem.innerHTML = `
          <input type="checkbox" name="sites" value="${key}">
          <span>${key}</span>
          <div class="website-controls">
            <button class="split-control active" data-site="${key}" data-direction="vertical">Vertical</button>
            <button class="split-control" data-site="${key}" data-direction="horizontal">Horizontal</button>
            <button class="remove-site" title="Remove this website">Remove</button>
          </div>
        `;
        
        // Add checkbox event listener
        const checkbox = websiteItem.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
          saveSettings();
        });
        
        // Add split control listeners
        websiteItem.querySelectorAll('.split-control').forEach(button => {
          button.addEventListener('click', () => {
            const site = button.dataset.site;
            const direction = button.dataset.direction;
            
            const otherDirection = direction === 'vertical' ? 'horizontal' : 'vertical';
            const otherButton = websiteItem.querySelector(`.split-control[data-direction="${otherDirection}"]`);
            
            if (otherButton) {
              otherButton.classList.remove('active');
            }
            button.classList.add('active');
            
            saveSettings();
          });
        });
        
        const removeButton = websiteItem.querySelector('.remove-site');
        if (removeButton) {
          removeButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            delete URLS[key];
            websiteItem.remove();
            saveCustomSites();
            saveSettings();
          });
        }
        
        checkboxGroup.appendChild(websiteItem);
      });
    }
  });

  // Then restore settings
  restoreSettings();

  // Add event listeners for split-all buttons
  document.querySelectorAll('.split-all-button').forEach(button => {
    button.addEventListener('click', () => {
      // Only proceed if in split mode
      const currentMode = document.querySelector('input[name="mode"]:checked').value;
      if (currentMode !== 'split') return;

      const direction = button.dataset.direction;
      
      // Toggle active state for split-all buttons
      document.querySelectorAll('.split-all-button').forEach(btn => {
        if (btn === button) {
          btn.classList.toggle('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Update hover options visibility based on the active button
      toggleHoverOptions(button.classList.contains('active') ? direction : null);

      // Update all split controls if the button is active
      if (button.classList.contains('active')) {
        document.querySelectorAll('.split-control').forEach(control => {
          if (control.dataset.direction === direction) {
            control.classList.add('active');
          } else {
            control.classList.remove('active');
          }
        });
      }
      
      saveSettings();
      updateSplitWarning();
    });
  });

  // Function to update split warning based on selected sites and direction
  function updateSplitWarning() {
    const selectedSites = document.querySelectorAll('input[name="sites"]:checked').length;
    const currentDirection = document.querySelector('.split-control.active')?.dataset.direction;
    const warningElement = document.querySelector('.split-warning');
    
    if (!warningElement) return;

    if (currentDirection === 'horizontal' && selectedSites >= 5) {
      warningElement.textContent = 'Warning: Some windows may not be visible in horizontal split with 5 or more websites due to screen height constraints.';
      warningElement.classList.add('visible');
    } else if (currentDirection === 'vertical' && selectedSites >= 6) {
      warningElement.textContent = 'Warning: Some windows may not be visible in vertical split with 6 or more websites due to screen width constraints.';
      warningElement.classList.add('visible');
    } else {
      warningElement.classList.remove('visible');
    }
  }

  // Add event listeners to checkboxes
  document.querySelectorAll('input[name="sites"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      saveSettings();
      updateSplitWarning();
    });
  });

  // Add event listener for mode changes
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      toggleSplitControls(e.target.value === 'split');
      saveSettings();
      updateSplitWarning();
    });
  });

  // Initialize warning on load
  updateSplitWarning();

  // Info tooltip functionality
  const infoButton = document.querySelector('.info-button');
  const infoTooltip = document.querySelector('.info-tooltip');
  const closeButton = document.querySelector('.info-tooltip-close');

  infoButton.addEventListener('click', (e) => {
    e.stopPropagation();
    infoTooltip.classList.toggle('visible');
  });

  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    infoTooltip.classList.remove('visible');
  });

  // Close tooltip when clicking outside
  document.addEventListener('click', (e) => {
    if (!infoTooltip.contains(e.target) && !infoButton.contains(e.target)) {
      infoTooltip.classList.remove('visible');
    }
  });

  // Prevent tooltip from closing when clicking inside it
  infoTooltip.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Copy button functionality
  document.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', async () => {
      const url = button.dataset.url;
      try {
        await navigator.clipboard.writeText(url);
        button.textContent = 'Copied!';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = 'Copy';
          button.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  });
});

// Add event listeners to checkboxes
document.querySelectorAll('input[name="sites"]').forEach(checkbox => {
  checkbox.addEventListener('change', saveSettings);
});

// Add event listener for mode changes
document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    toggleSplitControls(e.target.value === 'split');
    saveSettings();
  });
});

// Add event listener for split direction changes
document.querySelectorAll('input[name="split_direction"]').forEach(radio => {
  radio.addEventListener('change', saveSettings);
});

// Function to toggle split controls visibility
function toggleSplitControls(show) {
  document.querySelectorAll('.website-controls').forEach(controls => {
    if (show) {
      controls.classList.remove('hidden');
    } else {
      controls.classList.add('hidden');
    }
  });
  
  // Also toggle the split-all buttons visibility
  const splitControls = document.querySelector('.split-controls');
  if (splitControls) {
    if (show) {
      splitControls.classList.add('active');
    } else {
      splitControls.classList.remove('active');
    }
  }
}

// Function to toggle hover options visibility based on global direction
function toggleHoverOptions(direction) {
  const halfScreenHoverOption = document.querySelector('label[for="halfScreenHover"], label.half-screen-option:has(#halfScreenHover)');
  const halfScreenVerticalHoverOption = document.querySelector('label[for="halfScreenVerticalHover"], label.half-screen-option:has(#halfScreenVerticalHover)');

  if (direction === 'horizontal') {
    halfScreenHoverOption.style.display = 'flex';
    halfScreenVerticalHoverOption.style.display = 'none';
  } else if (direction === 'vertical') {
    halfScreenHoverOption.style.display = 'none';
    halfScreenVerticalHoverOption.style.display = 'flex';
  } else {
    halfScreenHoverOption.style.display = 'flex';
    halfScreenVerticalHoverOption.style.display = 'flex';
  }
}

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
      // Open selected URLs in windows
      for (const site of selectedSites) {
        await chrome.windows.create({
          url: URLS[site](encodedPrompt),
          state: 'normal'
        });
      }
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
        const numWindows = selectedSites.length;
        let verticalCount = 0;
        let horizontalCount = 0;
        
        // Count splits in each direction
        selectedSites.forEach(site => {
          const direction = document.querySelector(`.split-control.active[data-site="${site}"]`)?.dataset.direction;
          if (direction === 'horizontal') horizontalCount++;
          else verticalCount++;
        });
        
        try {
          const windows = [];
          let currentVerticalOffset = 0;
          let currentHorizontalOffset = 0;
          
          // Calculate dimensions
          const verticalWidth = verticalCount > 0 ? Math.floor(screenWidth / verticalCount) : screenWidth;
          const horizontalHeight = horizontalCount > 0 ? Math.floor(screenHeight / horizontalCount) : screenHeight;
          
          // Create all windows
          for (let i = 0; i < numWindows; i++) {
            const site = selectedSites[i];
            const direction = document.querySelector(`.split-control.active[data-site="${site}"]`)?.dataset.direction || 'vertical';
            const isVertical = direction === 'vertical';
            
            const window = await chrome.windows.create({
              url: URLS[site](encodedPrompt),
              left: isVertical ? currentVerticalOffset : 0,
              top: isVertical ? 0 : currentHorizontalOffset,
              width: isVertical ? verticalWidth : screenWidth,
              height: isVertical ? screenHeight : horizontalHeight,
              state: 'normal'
            });
            
            if (isVertical) {
              currentVerticalOffset += verticalWidth;
            } else {
              currentHorizontalOffset += horizontalHeight;
            }
            
            windows.push({
              window,
              direction,
              offset: isVertical ? currentVerticalOffset - verticalWidth : currentHorizontalOffset - horizontalHeight
            });
          }

          // Function to position windows with retry
          const positionWindows = async (attempt = 1) => {
            try {
              const halfScreenHoverEnabled = document.getElementById('halfScreenHover').checked;
              const halfScreenVerticalHoverEnabled = document.getElementById('halfScreenVerticalHover').checked;

              // If half-screen hover is enabled, apply those layouts directly
              if (halfScreenHoverEnabled || halfScreenVerticalHoverEnabled) {
                // Handle horizontal windows
                if (halfScreenHoverEnabled) {
                  const horizontalWindows = windows.filter(w => w.direction === 'horizontal');
                  if (horizontalWindows.length > 0) {
                    const numHorizontal = horizontalWindows.length;
                    const leftCount = Math.ceil(numHorizontal / 2);
                    const rightCount = numHorizontal - leftCount;
                    const leftHeight = Math.floor(screenHeight / leftCount);
                    const rightHeight = Math.floor(screenHeight / rightCount);

                    // Position left side windows
                    for (let i = 0; i < leftCount; i++) {
                      await chrome.windows.update(horizontalWindows[i].window.id, {
                        width: Math.floor(screenWidth / 2),
                        height: leftHeight,
                        left: 0,
                        top: i * leftHeight,
                        state: 'normal'
                      });
                    }

                    // Position right side windows
                    for (let i = 0; i < rightCount; i++) {
                      await chrome.windows.update(horizontalWindows[leftCount + i].window.id, {
                        width: Math.floor(screenWidth / 2),
                        height: rightHeight,
                        left: Math.floor(screenWidth / 2),
                        top: i * rightHeight,
                        state: 'normal'
                      });
                    }
                  }
                }

                // Handle vertical windows
                if (halfScreenVerticalHoverEnabled) {
                  const verticalWindows = windows.filter(w => w.direction === 'vertical');
                  if (verticalWindows.length > 0) {
                    const numVertical = verticalWindows.length;
                    const topCount = Math.ceil(numVertical / 2); // More windows on top if odd number
                    const bottomCount = numVertical - topCount;
                    const topWidth = Math.floor(screenWidth / topCount);
                    const bottomWidth = Math.floor(screenWidth / bottomCount);

                    // Position top half windows
                    for (let i = 0; i < topCount; i++) {
                      await chrome.windows.update(verticalWindows[i].window.id, {
                        width: topWidth,
                        height: Math.floor(screenHeight / 2),
                        left: i * topWidth,
                        top: 0,
                        state: 'normal'
                      });
                    }

                    // Position bottom half windows
                    for (let i = 0; i < bottomCount; i++) {
                      await chrome.windows.update(verticalWindows[topCount + i].window.id, {
                        width: bottomWidth,
                        height: Math.floor(screenHeight / 2),
                        left: i * bottomWidth,
                        top: Math.floor(screenHeight / 2),
                        state: 'normal'
                      });
                    }
                  }
                }
              } else {
                // If no half-screen hover is enabled, position windows normally
                await Promise.all(
                  windows.map(({ window, direction, offset }) => {
                    const isVertical = direction === 'vertical';
                    return chrome.windows.update(window.id, {
                      left: isVertical ? offset : 0,
                      top: isVertical ? 0 : offset,
                      width: isVertical ? verticalWidth : screenWidth,
                      height: isVertical ? screenHeight : horizontalHeight,
                      state: 'normal'
                    });
                  })
                );
              }
            } catch (error) {
              if (attempt < 3) {
                const baseDelay = numWindows <= 1 ? 0 : numWindows * 300;
                setTimeout(() => positionWindows(attempt + 1), baseDelay * attempt);
              }
            }
          };

          // Initial positioning with delay based on number of windows
          const initialDelay = numWindows <= 1 ? 0 : numWindows * 300;
          setTimeout(() => positionWindows(), initialDelay);
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
