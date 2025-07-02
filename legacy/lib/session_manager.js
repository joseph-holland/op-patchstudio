// Session Manager for collapsible sections state persistence
// Uses sessionStorage to persist state during browser session only

class SessionManager {
  constructor() {
    this.storageKey = "opxy_section_states";
    this.tabKey = "opxy_last_tab";
    this.dropdownKey = "opxy_dropdown_values";
    this.sections = new Map();
    this.init();
    this.initTabPersistence();
    // Disable dropdown persistence to always default conversion settings
    // this.initDropdownPersistence();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupSections());
    } else {
      this.setupSections();
    }
  }

  // Storage utility functions
  saveToStorage(data) {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn("sessionStorage not available:", e);
    }
  }

  loadFromStorage() {
    try {
      const data = sessionStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn("se  ssionStorage not available:", e);
      return {};
    }
  }

  clearStorage() {
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch (e) {
      console.warn("sessionStorage not available:", e);
    }
  }

  setupSections() {
    // Find all collapsible sections
    const collapsibleElements = document.querySelectorAll(
      '[data-bs-toggle="collapse"]'
    );

    collapsibleElements.forEach((trigger) => {
      const targetId = trigger.getAttribute("data-bs-target");
      if (targetId) {
        const target = document.querySelector(targetId);
        if (target) {
          const sectionId = targetId.replace("#", "");
          this.sections.set(sectionId, {
            trigger: trigger,
            target: target,
            chevron: trigger.querySelector('i[class*="chevron"]'),
          });

          // Restore saved state first
          this.restoreState(sectionId);

          // Add event listeners
          target.addEventListener("shown.bs.collapse", () => {
            this.saveState(sectionId, true);
            this.updateChevron(sectionId, true);
          });

          target.addEventListener("hidden.bs.collapse", () => {
            this.saveState(sectionId, false);
            this.updateChevron(sectionId, false);
          });

          // Set initial chevron state based on current visibility
          const isCurrentlyVisible = target.classList.contains("show");
          this.updateChevron(sectionId, isCurrentlyVisible);
        }
      }
    });
  }

  saveState(sectionId, isExpanded) {
    const currentStates = this.loadFromStorage();
    currentStates[sectionId] = isExpanded ? "expanded" : "collapsed";
    this.saveToStorage(currentStates);
  }

  restoreState(sectionId) {
    const savedStates = this.loadFromStorage();
    const savedState = savedStates[sectionId];
    const section = this.sections.get(sectionId);

    if (!section || !savedState) return;

    if (savedState === "collapsed") {
      // Close the section
      section.target.classList.remove("show");
      section.trigger.setAttribute("aria-expanded", "false");
      this.updateChevron(sectionId, false);
    } else if (savedState === "expanded") {
      // Open the section
      section.target.classList.add("show");
      section.trigger.setAttribute("aria-expanded", "true");
      this.updateChevron(sectionId, true);
    }
  }

  updateChevron(sectionId, isExpanded) {
    const section = this.sections.get(sectionId);
    if (section && section.chevron) {
      if (isExpanded) {
        section.chevron.classList.remove("fa-chevron-right");
        section.chevron.classList.add("fa-chevron-down");
      } else {
        section.chevron.classList.remove("fa-chevron-down");
        section.chevron.classList.add("fa-chevron-right");
      }
    }
  }

  initTabPersistence() {
    // Save tab on click
    const drumTab = document.getElementById("drum-tab");
    const multiTab = document.getElementById("multi-tab");
    if (drumTab && multiTab) {
      drumTab.addEventListener("click", () => {
        sessionStorage.setItem(this.tabKey, "drum");
      });
      multiTab.addEventListener("click", () => {
        sessionStorage.setItem(this.tabKey, "multi");
      });
    }
    // Restore tab on load
    const lastTab = sessionStorage.getItem(this.tabKey);
    if (lastTab === "multi") {
      const multiTabBtn = document.getElementById("multi-tab");
      if (multiTabBtn) multiTabBtn.click();
    } else if (lastTab === "drum") {
      const drumTabBtn = document.getElementById("drum-tab");
      if (drumTabBtn) drumTabBtn.click();
    }
  }

  // Dropdown persistence methods
  initDropdownPersistence() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.clearConversionDropdownSettings();
        this.initializeConversionDropdowns();
        this.setupDropdowns();
      });
    } else {
      this.clearConversionDropdownSettings();
      this.initializeConversionDropdowns();
      this.setupDropdowns();
    }
  }

  setupDropdowns() {
    // Define dropdown IDs to persist
    // Note: Conversion dropdowns (sample-rate, bit-depth, channels) are excluded
    // to always default to "keep original" settings
    const dropdownIds = [
      // Add other dropdown IDs here if needed, but not conversion settings
    ];

    dropdownIds.forEach(id => {
      const dropdown = document.getElementById(id);
      if (dropdown) {
        // Restore saved value
        this.restoreDropdownValue(id);
        
        // Add change listener to save value
        dropdown.addEventListener('change', () => {
          this.saveDropdownValue(id, dropdown.value);
        });
      }
    });
  }

  saveDropdownValue(dropdownId, value) {
    try {
      const currentValues = this.loadDropdownValues();
      currentValues[dropdownId] = value;
      sessionStorage.setItem(this.dropdownKey, JSON.stringify(currentValues));
    } catch (e) {
      console.warn("sessionStorage not available for dropdown persistence:", e);
    }
  }

  loadDropdownValues() {
    try {
      const data = sessionStorage.getItem(this.dropdownKey);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn("sessionStorage not available for dropdown persistence:", e);
      return {};
    }
  }

  restoreDropdownValue(dropdownId) {
    const savedValues = this.loadDropdownValues();
    const savedValue = savedValues[dropdownId];
    const dropdown = document.getElementById(dropdownId);
    
    if (dropdown && savedValue) {
      // Check if the saved value exists as an option
      const option = dropdown.querySelector(`option[value="${savedValue}"]`);
      if (option) {
        dropdown.value = savedValue;
        
        // Trigger change event to update any dependent calculations
        const changeEvent = new Event('change', { bubbles: true });
        dropdown.dispatchEvent(changeEvent);
      }
    }
  }

  clearDropdownStorage() {
    try {
      sessionStorage.removeItem(this.dropdownKey);
    } catch (e) {
      console.warn("sessionStorage not available:", e);
    }
 }

  // Clear any existing conversion dropdown settings from both localStorage and sessionStorage
  clearConversionDropdownSettings() {
    const conversionDropdownIds = [
      'sample-rate-drum',
      'bit-depth-drum', 
      'channels-drum',
      'sample-rate-multi',
      'bit-depth-multi',
      'channels-multi'
    ];
    // Remove from localStorage (legacy)
    conversionDropdownIds.forEach(id => {
      localStorage.removeItem(`dropdown_${id}`);
    });
    // Remove from sessionStorage (in case any code ever used it)
    conversionDropdownIds.forEach(id => {
      sessionStorage.removeItem(`dropdown_${id}`);
    });
  }

  // Initialize conversion dropdowns to default "keep" values
  initializeConversionDropdowns() {
    const conversionDropdowns = {
      'sample-rate-drum': '0',     // Keep original
      'bit-depth-drum': 'keep',    // Keep original
      'channels-drum': 'keep',     // Keep original
      'sample-rate-multi': '0',    // Keep original
      'bit-depth-multi': 'keep',   // Keep original
      'channels-multi': 'keep'     // Keep original
    };
    
    Object.entries(conversionDropdowns).forEach(([id, defaultValue]) => {
      const dropdown = document.getElementById(id);
      if (dropdown) {
        dropdown.value = defaultValue;
        console.log(`Initialized ${id} to ${defaultValue}`);
      }
    });
  }

  // Debug function to check current dropdown values
  debugConversionDropdowns() {
    const conversionDropdownIds = [
      'sample-rate-drum',
      'bit-depth-drum', 
      'channels-drum',
      'sample-rate-multi',
      'bit-depth-multi',
      'channels-multi'
    ];
    
    console.log('=== Conversion Dropdown Values ===');
    conversionDropdownIds.forEach(id => {
      const dropdown = document.getElementById(id);
      if (dropdown) {
        console.log(`${id}: ${dropdown.value}`);
      } else {
        console.log(`${id}: element not found`);
      }
    });
    console.log('===================================');
  }

  // Public method to reset all storage including dropdowns
  resetAllStates() {
    this.clearStorage();
    this.clearDropdownStorage();
    location.reload(); // Reload to see default states
  }
}

// Initialize the session manager
let sessionManager;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    sessionManager = new SessionManager();
    // Make it globally accessible for debugging
    window.sessionManager = sessionManager;
  });
} else {
  sessionManager = new SessionManager();
  // Make it globally accessible for debugging
  window.sessionManager = sessionManager;
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = SessionManager;
}
