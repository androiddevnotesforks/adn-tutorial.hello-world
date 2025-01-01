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
  const smartLayoutHover = document.getElementById('smartLayoutHover').checked;
  const smartLayoutVerticalHover = document.getElementById('smartLayoutVerticalHover').checked;
  const globalDirection = document.querySelector('.split-all-button.active')?.dataset.direction || null;
  const autoCloseTimer = document.getElementById('autoCloseTimer').value;
  chrome.storage.local.set({ 
    selectedSites, 
    selectedMode, 
    splitDirections, 
    smartLayoutHover, 
    smartLayoutVerticalHover, 
    globalDirection,
    autoCloseTimer 
  });
}

// Function to restore selected sites and mode
function restoreSettings() {
  // First uncheck all checkboxes
  document.querySelectorAll('input[name="sites"]').forEach(checkbox => {
    checkbox.checked = false;
  });
  
  // Restore saved selections and mode
  chrome.storage.local.get([
    'selectedSites', 
    'selectedMode', 
    'splitDirections', 
    'smartLayoutHover', 
    'smartLayoutVerticalHover', 
    'globalDirection',
    'autoCloseTimer',
    'hasInitializedBefore'
  ], (result) => {
    // Handle site selections
    if (result.selectedSites) {
      result.selectedSites.forEach(site => {
        // Only restore selection if the site still exists
        if (URLS[site]) {
          const checkbox = document.querySelector(`input[value="${site}"]`);
          if (checkbox) checkbox.checked = true;
        }
      });
    } else if (!result.hasInitializedBefore) {
      // Set default selections only on first ever load
      const defaultSites = ['Grok', 'ChatGPT'];
      defaultSites.forEach(site => {
        if (URLS[site]) {
          const checkbox = document.querySelector(`input[value="${site}"]`);
          if (checkbox) checkbox.checked = true;
        }
      });
      // Mark that we've initialized before
      chrome.storage.local.set({ hasInitializedBefore: true });
    }

    // Handle auto-close timer
    const autoCloseTimerInput = document.getElementById('autoCloseTimer');
    if (autoCloseTimerInput && result.autoCloseTimer) {
      autoCloseTimerInput.value = result.autoCloseTimer;
    }

    // Handle half-screen hover setting
    const smartLayoutHoverCheckbox = document.getElementById('smartLayoutHover');
    if (smartLayoutHoverCheckbox) {
      smartLayoutHoverCheckbox.checked = result.smartLayoutHover || false;
    }
    const smartLayoutVerticalHoverCheckbox = document.getElementById('smartLayoutVerticalHover');
    if (smartLayoutVerticalHoverCheckbox) {
      smartLayoutVerticalHoverCheckbox.checked = result.smartLayoutVerticalHover || false;
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
const INITIAL_DEFAULT_URLS = {
  Grok: (prompt) => `https://grok.com/chat?q=${prompt}`,
  "Grok on X": (prompt) => `https://x.com/i/grok?text=${prompt}`,
  ChatGPT: (prompt) => `https://chatgpt.com/?q=${prompt}`,
  Claude: (prompt) => `https://claude.ai/new?q=${prompt}`,
  Perplexity: (prompt) => `https://www.perplexity.ai/?q=${prompt}`,
  Google: (prompt) => `https://www.google.com/search?q=${prompt}`
};

// Initialize URLs
let URLS = {};

// Function to initialize URLs
async function initializeURLs() {
  // Start with a clean slate
  URLS = {};
  
  // Get removed defaults first
  const result = await chrome.storage.local.get(['removedDefaults']);
  const removedDefaults = result.removedDefaults || [];
  console.log('Removed defaults:', removedDefaults);
  
  // Add non-removed default URLs, using case-sensitive comparison
  Object.entries(INITIAL_DEFAULT_URLS).forEach(([key, fn]) => {
    if (!removedDefaults.includes(key)) {
      URLS[key] = fn;
    }
  });
  console.log('After adding defaults:', Object.keys(URLS));
  
  // Get and add custom sites
  const customResult = await chrome.storage.local.get(['customSites']);
  if (customResult.customSites) {
    Object.entries(customResult.customSites).forEach(([key, template]) => {
      URLS[key] = (prompt) => template.replace('{prompt}', prompt);
    });
  }
  console.log('Final URLS:', Object.keys(URLS));
}

// Function to save removed default sites
function saveRemovedDefaultSites() {
  // Get the original case keys from INITIAL_DEFAULT_URLS that are not in URLS
  const removedDefaults = Object.keys(INITIAL_DEFAULT_URLS).filter(key => !URLS[key]);
  console.log('Saving removed defaults:', removedDefaults);
  chrome.storage.local.set({ removedDefaults });
}

// Function to initialize default websites in UI
function initializeWebsitesUI() {
  const checkboxGroup = document.querySelector('.checkbox-group');
  checkboxGroup.innerHTML = ''; // Clear existing items
  
  // Get all websites and sort them alphabetically (case-insensitive)
  const sortedWebsites = Object.keys(URLS).sort((a, b) => 
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  
  // Add all current websites in sorted order
  sortedWebsites.forEach(name => {
    addWebsiteToUI(name);
  });
}

// Function to add a website to the UI
function addWebsiteToUI(name, skipSaveSettings = true) {
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
      <button class="remove-site" title="Remove this website">\u00D7</button>
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
  
  // Add remove button listener
  const removeButton = websiteItem.querySelector('.remove-site');
  if (removeButton) {
    removeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Remove from URLS
      delete URLS[name];
      
      // Remove from UI
      websiteItem.remove();
      
      // Save appropriate storage
      if (INITIAL_DEFAULT_URLS[name]) {
        saveRemovedDefaultSites();
      } else {
        saveCustomSites();
      }
      
      saveSettings();
    });
  }
  
  // Insert at the end of the checkbox group
  checkboxGroup.appendChild(websiteItem);
  
  // Only save settings if not skipped (for initial load)
  if (!skipSaveSettings) {
    saveSettings();
  }
}

// Function to save custom sites
function saveCustomSites() {
  const customSites = Object.keys(URLS).reduce((acc, key) => {
    if (!INITIAL_DEFAULT_URLS[key]) {
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

// Add custom website handler
document.getElementById('addCustomSite').addEventListener('click', () => {
  const nameInput = document.getElementById('customSiteName');
  const urlInput = document.getElementById('customSiteUrl');
  const errorElement = document.getElementById('customSiteError');
  
  const name = nameInput.value.trim();
  const urlTemplate = urlInput.value.trim();

  // Helper function to show error
  const showError = (message, focusElement) => {
    errorElement.textContent = message;
    errorElement.classList.add('visible');
    if (focusElement) focusElement.focus();
  };

  // Clear previous error
  errorElement.classList.remove('visible');
  
  // Validate name
  if (!name) {
    showError('Please enter a website name', nameInput);
    return;
  }

  // Validate URL template
  if (!urlTemplate) {
    showError('Please enter a URL template', urlInput);
    return;
  }
  
  // Check if website already exists (case-insensitive check)
  if (Object.keys(URLS).some(key => key.toLowerCase() === name.toLowerCase())) {
    showError('A website with this name already exists', nameInput);
    return;
  }

  // Validate URL format
  try {
    // Test if it's a valid URL by replacing {prompt} with a test value
    const testUrl = urlTemplate.replace('{prompt}', 'test');
    new URL(testUrl);

    if (!urlTemplate.includes('{prompt}')) {
      showError('URL template must include {prompt} placeholder.\n\nExample: https://example.com/search?q={prompt}', urlInput);
      return;
    }

    // Check if the {prompt} is in a query parameter or path
    const isValidFormat = urlTemplate.includes('?') && 
      (urlTemplate.includes('q={prompt}') || 
       urlTemplate.includes('query={prompt}') || 
       urlTemplate.includes('search={prompt}') || 
       urlTemplate.includes('text={prompt}') ||
       urlTemplate.includes('p={prompt}')) ||
      urlTemplate.includes('/{prompt}');

    if (!isValidFormat) {
      showError('The {prompt} should be in a query parameter (like ?q={prompt}) or in the path.\n\nExamples:\n- https://example.com/search?q={prompt}\n- https://example.com/query/{prompt}', urlInput);
      return;
    }
  } catch (error) {
    showError('Please enter a valid URL starting with http:// or https://', urlInput);
    return;
  }
  
  // Add to URLS object with original case
  URLS[name] = (prompt) => urlTemplate.replace('{prompt}', prompt);
  
  // If this is a default site being re-added, remove it from removedDefaults
  if (INITIAL_DEFAULT_URLS[name]) {
    chrome.storage.local.get(['removedDefaults'], (result) => {
      const removedDefaults = result.removedDefaults || [];
      const updatedRemovedDefaults = removedDefaults.filter(site => site !== name);
      chrome.storage.local.set({ removedDefaults: updatedRemovedDefaults });
      console.log('Updated removed defaults:', updatedRemovedDefaults);
    });
  }
  
  // Add to UI with original case and save settings
  addWebsiteToUI(name, false);
  
  // Save to storage
  saveCustomSites();
  
  // Clear inputs and error
  nameInput.value = '';
  urlInput.value = '';
  errorElement.classList.remove('visible');
});

// Clear error message when user starts typing
document.getElementById('customSiteName').addEventListener('input', () => {
  document.getElementById('customSiteError').classList.remove('visible');
});

document.getElementById('customSiteUrl').addEventListener('input', () => {
  document.getElementById('customSiteError').classList.remove('visible');
});

// Initialize custom sites on load
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('promptInput').focus();
  
  // Initialize URLs first
  await initializeURLs();
  
  // Then initialize UI (without saving settings)
  initializeWebsitesUI();
  
  // Finally restore settings
  restoreSettings();

  // Update keyboard shortcut based on platform
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const shortcutElement = document.querySelector('.shortcut-footer');
  if (shortcutElement) {
    shortcutElement.innerHTML = isMac ? 
      'Keyboard shortcut: <kbd>Command</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd>' :
      'Keyboard shortcut: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd>';
  }

  // Add event listener for auto-close timer
  const autoCloseTimerInput = document.getElementById('autoCloseTimer');
  if (autoCloseTimerInput) {
    autoCloseTimerInput.addEventListener('change', () => {
      saveSettings();
    });
  }

  // Add event listeners for half-screen hover checkboxes
  const smartLayoutHoverCheckbox = document.getElementById('smartLayoutHover');
  if (smartLayoutHoverCheckbox) {
    smartLayoutHoverCheckbox.addEventListener('change', (e) => {
      if (!e.target.checked) {
        // If unchecked and horizontal is the active global direction, set all to horizontal
        const horizontalButton = document.querySelector('.split-all-button[data-direction="horizontal"].active');
        if (horizontalButton) {
          document.querySelectorAll('.split-control').forEach(control => {
            if (control.dataset.direction === 'horizontal') {
              control.classList.add('active');
            } else {
              control.classList.remove('active');
            }
          });
        }
      }
      saveSettings();
    });
  }
  const smartLayoutVerticalHoverCheckbox = document.getElementById('smartLayoutVerticalHover');
  if (smartLayoutVerticalHoverCheckbox) {
    smartLayoutVerticalHoverCheckbox.addEventListener('change', (e) => {
      if (!e.target.checked) {
        // If unchecked and vertical is the active global direction, set all to vertical
        const verticalButton = document.querySelector('.split-all-button[data-direction="vertical"].active');
        if (verticalButton) {
          document.querySelectorAll('.split-control').forEach(control => {
            if (control.dataset.direction === 'vertical') {
              control.classList.add('active');
            } else {
              control.classList.remove('active');
            }
          });
        }
      }
      saveSettings();
    });
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

  // Then restore settings
  restoreSettings();

  // Add event listeners for split-all buttons
  document.querySelectorAll('.split-all-button').forEach(button => {
    button.addEventListener('click', () => {
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

      // Clear smart mode checkboxes when switching layouts
      const smartLayoutHoverCheckbox = document.getElementById('smartLayoutHover');
      const smartLayoutVerticalHoverCheckbox = document.getElementById('smartLayoutVerticalHover');
      smartLayoutHoverCheckbox.checked = false;
      smartLayoutVerticalHoverCheckbox.checked = false;

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

  // Add event listeners for add buttons in examples
  document.querySelectorAll('.add-button').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.dataset.name;
      const urlTemplate = button.dataset.url;
      
      // Check if website already exists (case-insensitive check)
      if (Object.keys(URLS).some(key => key.toLowerCase() === name.toLowerCase())) {
        const errorElement = document.getElementById('customSiteError');
        errorElement.textContent = 'This website already exists';
        errorElement.classList.add('visible');
        return;
      }

      // Add to URLS object with original case
      URLS[name] = (prompt) => urlTemplate.replace('{prompt}', prompt);
      
      // Add to UI with original case
      addWebsiteToUI(name, false);
      
      // Save to storage
      saveCustomSites();
      
      // Show success feedback
      button.textContent = 'Added!';
      button.style.background = 'rgba(0, 255, 0, 0.1)';
      button.style.color = '#4CAF50';
      button.style.borderColor = 'rgba(76, 175, 80, 0.3)';
      button.disabled = true;
      
      // Reset button after 2 seconds
      setTimeout(() => {
        button.textContent = 'Add';
        button.style.background = '';
        button.style.color = '';
        button.style.borderColor = '';
        button.disabled = false;
      }, 2000);
    });
  });

  // Add event listeners for quick-add buttons
  document.querySelectorAll('.quick-add-button').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.dataset.name;
      const url = button.dataset.url;
      
      // Check if website already exists
      if (Object.keys(URLS).some(key => key.toLowerCase() === name.toLowerCase())) {
        // If it exists, just check its checkbox
        const checkbox = document.querySelector(`input[name="sites"][value="${name}"]`);
        if (checkbox && !checkbox.checked) {
          checkbox.checked = true;
          saveSettings();
        }
        return;
      }

      // Add to URLS object with original case
      URLS[name] = (prompt) => url.replace('{prompt}', prompt);
      
      // If this is a default site being re-added, remove it from removedDefaults
      if (INITIAL_DEFAULT_URLS[name]) {
        chrome.storage.local.get(['removedDefaults'], (result) => {
          const removedDefaults = result.removedDefaults || [];
          const updatedRemovedDefaults = removedDefaults.filter(site => site !== name);
          chrome.storage.local.set({ removedDefaults: updatedRemovedDefaults });
          console.log('Updated removed defaults (quick-add):', updatedRemovedDefaults);
        });
      }
      
      // Add to UI and check the checkbox
      addWebsiteToUI(name, false);
      const checkbox = document.querySelector(`input[name="sites"][value="${name}"]`);
      if (checkbox) {
        checkbox.checked = true;
      }
      
      // Save to storage
      saveCustomSites();
      saveSettings();
      
      // Show success feedback
      button.classList.add('active');
      setTimeout(() => {
        button.classList.remove('active');
      }, 1000);
    });
  });

  // Add toggle all functionality
  const toggleAllButton = document.getElementById('toggleAllSites');
  toggleAllButton.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('input[name="sites"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = !allChecked;
    });
    
    toggleAllButton.textContent = allChecked ? 'Select All' : 'Unselect All';
    saveSettings();
  });

  // Update toggle button text on any checkbox change
  document.querySelector('.checkbox-group').addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const checkboxes = document.querySelectorAll('input[name="sites"]');
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      toggleAllButton.textContent = allChecked ? 'Unselect All' : 'Select All';
    }
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
  
  // Toggle the split-all buttons visibility
  const splitControls = document.querySelector('.split-controls');
  
  if (splitControls) {
    if (show) {
      splitControls.classList.add('active');
    } else {
      splitControls.classList.remove('active');
    }
  }

  // Show compact timer for split mode only
  const compactTimer = document.querySelector('.auto-close-timer.compact');
  if (compactTimer) {
    compactTimer.style.display = show ? 'flex' : 'none';
  }
}

// Function to toggle hover options visibility based on global direction
function toggleHoverOptions(direction) {
  const smartLayoutHoverOption = document.querySelector('label[for="smartLayoutHover"], label.half-screen-option:has(#smartLayoutHover)');
  const smartLayoutVerticalHoverOption = document.querySelector('label[for="smartLayoutVerticalHover"], label.half-screen-option:has(#smartLayoutVerticalHover)');

  if (direction === 'horizontal') {
    smartLayoutHoverOption.style.display = 'flex';
    smartLayoutVerticalHoverOption.style.display = 'none';
  } else if (direction === 'vertical') {
    smartLayoutHoverOption.style.display = 'none';
    smartLayoutVerticalHoverOption.style.display = 'flex';
  } else {
    // Hide both options when no direction is selected
    smartLayoutHoverOption.style.display = 'none';
    smartLayoutVerticalHoverOption.style.display = 'none';
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
  const autoCloseTimer = document.getElementById('autoCloseTimer').value;
  const autoCloseMs = autoCloseTimer ? parseInt(autoCloseTimer) * 1000 : 0;
  
  try {
    if (mode === 'normal') {
      // Get the current window
      const currentWindow = await chrome.windows.getCurrent();
      
      // Create promises for all tabs
      const tabPromises = selectedSites.map(async site => {
        const tab = await chrome.tabs.create({
          url: URLS[site](encodedPrompt),
          windowId: currentWindow.id,
          active: false // Keep the current tab active
        });
        
        // Set a timeout to close all tabs if timer is set
        if (autoCloseMs > 0) {
          setTimeout(async () => {
            try {
              await chrome.tabs.remove(tab.id);
            } catch (error) {
              console.error(`Error closing ${site} tab:`, error);
            }
          }, autoCloseMs);
        }
        
        return tab;
      });
      
      // Wait for all tabs to be created
      await Promise.all(tabPromises);
    } else {
      // Split screen mode
      const screenWidth = window.screen.availWidth;
      const screenHeight = window.screen.availHeight;
      
      if (selectedSites.length === 1) {
        // Single window mode
        const window = await chrome.windows.create({
          url: URLS[selectedSites[0]](encodedPrompt),
          state: 'maximized'
        });
        
        // Set a timeout to close the window if timer is set
        if (autoCloseMs > 0) {
          setTimeout(async () => {
            try {
              await chrome.windows.remove(window.id);
            } catch (error) {
              console.error(`Error closing ${selectedSites[0]} window:`, error);
            }
          }, autoCloseMs);
        }
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
            
            // Set a timeout to close the window if timer is set
            if (autoCloseMs > 0) {
              setTimeout(async () => {
                try {
                  await chrome.windows.remove(window.id);
                } catch (error) {
                  console.error(`Error closing ${site} window:`, error);
                }
              }, autoCloseMs);
            }
            
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
              const smartLayoutHoverEnabled = document.getElementById('smartLayoutHover').checked;
              const smartLayoutVerticalHoverEnabled = document.getElementById('smartLayoutVerticalHover').checked;

              // If half-screen hover is enabled, apply those layouts directly
              if (smartLayoutHoverEnabled || smartLayoutVerticalHoverEnabled) {
                // Handle horizontal windows
                if (smartLayoutHoverEnabled) {
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
                if (smartLayoutVerticalHoverEnabled) {
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
                const baseDelay = numWindows <= 1 ? 0 : numWindows * 500;
                setTimeout(() => positionWindows(attempt + 1), baseDelay * attempt);
              }
            }
          };

          // Initial positioning with delay based on number of windows
          const initialDelay = numWindows <= 1 ? 0 : numWindows * 500;
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
