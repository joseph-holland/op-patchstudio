// == Importing necessary libraries ==
// Import JSZip for zip file generation
let jsZipLoadPromise = null;
if (typeof JSZip === "undefined") {
  jsZipLoadPromise = new Promise((resolve, reject) => {
  const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load JSZip"));
  document.head.appendChild(script);
  });
} else {
  jsZipLoadPromise = Promise.resolve();
}

// == Global Styles ==
// Add global slider styles to handle all browser-specific styling
// (Moved to style.css)
document.addEventListener("DOMContentLoaded", function () {
  // Example: update gain value display
  const gainSlider = document.getElementById("gain-slider");
  const gainValue = document.getElementById("gain-value");
  if (gainSlider && gainValue) {
    gainSlider.addEventListener("input", () => {
      gainValue.textContent = gainSlider.value;
    });
  }

  // Initialize file inputs for drum samples
  for (let i = 1; i <= NUM_DRUMS; i++) {
    const fileInput = document.getElementById(`sample-${i}`);
    const searchBtn = document.getElementById(`search-${i}`);
    
    if (fileInput) {
      fileInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (file) {
          if (file.type.startsWith("audio/") || file.name.toLowerCase().endsWith(".wav")) {
            loadSample(i, file);
          } else {
            alert("Please select a WAV audio file.");
          }
        }
      });
    }
    
    // Add click handler for search button
    if (searchBtn) {
      searchBtn.addEventListener("click", function() {
        const fileInput = document.getElementById(`sample-${i}`);
        if (fileInput) {
          fileInput.click();
        }
      });
    }
  }

  // Initialize import settings button
  const importBtn = document.getElementById("import-drum-settings-btn");
  const importInput = document.getElementById("import-drum-settings-input");
  if (importBtn && importInput) {
    importBtn.addEventListener("click", function() {
      importInput.click();
    });
    
    importInput.addEventListener("change", async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        
        // Validate preset type
        if (!json.type || json.type !== 'drum') {
          throw new Error('this is not a drum preset. please select a drum preset json file.');
        }

        if (!json.engine) {
          throw new Error('no engine settings found in the selected file.');
        }

        // Update engine settings
        const settings = json.engine;
        
        // Update playmode
        const playmodeSelect = document.getElementById("preset-playmode");
        if (playmodeSelect && settings.playmode) {
          playmodeSelect.value = settings.playmode;
        }
        
        // Update transpose (keep as is, -36 to +36 range)
        const transposeRange = document.getElementById("preset-transpose");
        const transposeNumber = document.getElementById("preset-transpose-number");
        if (transposeRange && transposeNumber && settings.transpose !== undefined) {
          transposeRange.value = settings.transpose;
          transposeNumber.value = settings.transpose;
        }
        
        // Update velocity sensitivity (convert from 0-32767 to 0-100)
        const velocityRange = document.getElementById("preset-velocity-sensitivity");
        const velocityNumber = document.getElementById("preset-velocity-sensitivity-number");
        if (velocityRange && velocityNumber && settings["velocity.sensitivity"] !== undefined) {
          const velocityPercent = Math.round((settings["velocity.sensitivity"] / 32767) * 100);
          velocityRange.value = velocityPercent;
          velocityNumber.value = velocityPercent;
        }
        
        // Update volume (convert from 0-32767 to 0-100)
        const volumeRange = document.getElementById("preset-volume");
        const volumeNumber = document.getElementById("preset-volume-number");
        if (volumeRange && volumeNumber && settings.volume !== undefined) {
          const volumePercent = Math.round((settings.volume / 32767) * 100);
          volumeRange.value = volumePercent;
          volumeNumber.value = volumePercent;
        }
        
        // Update stereo width (convert from 0-32767 to 0-100)
        const widthRange = document.getElementById("preset-width");
        const widthNumber = document.getElementById("preset-width-number");
        if (widthRange && widthNumber && settings.width !== undefined) {
          const widthPercent = Math.round((settings.width / 32767) * 100);
          widthRange.value = widthPercent;
          widthNumber.value = widthPercent;
        }

        // Save imported settings globally (store the converted percentage values)
        window.advancedPresetSettings = {
          playmode: settings.playmode || "poly",
          transpose: settings.transpose || 0,
          velocity: Math.round((settings["velocity.sensitivity"] || 0) / 32767 * 100),
          volume: Math.round((settings.volume || 0) / 32767 * 100),
          width: Math.round((settings.width || 0) / 32767 * 100),
        };

        showImportSuccess('drum engine settings imported successfully!');
        window.importedPresetJsonDrum = json;
      } catch (err) {
        console.error("Failed to import settings:", err);
        showImportError('failed to import settings: ' + err.message);
      }
      
      // Clear the input so the same file can be selected again
      importInput.value = "";
    });
  }

  // Watch preset name changes to enable/disable generate button
  const presetNameInput = document.getElementById("preset-name-drum");
  if (presetNameInput) {
    presetNameInput.addEventListener("input", updateGeneratePatchBtnState);
  }

  // Initial state update
  updateGeneratePatchBtnState();
  updateDrumPatchSize().catch(() => {});

  // Setup preset settings sliders
  const setupRangeWithNumber = (rangeId, numberId) => {
    const range = document.getElementById(rangeId);
    const number = document.getElementById(numberId);
    if (range && number) {
      range.addEventListener('input', () => {
        number.value = range.value;
      });
      number.addEventListener('input', () => {
        range.value = number.value;
      });
    }
  };

  // Link all preset settings sliders with their number inputs
  setupRangeWithNumber('preset-transpose', 'preset-transpose-number');
  setupRangeWithNumber('preset-velocity-sensitivity', 'preset-velocity-sensitivity-number');
  setupRangeWithNumber('preset-volume', 'preset-volume-number');
  setupRangeWithNumber('preset-width', 'preset-width-number');

  // Initialize drag and drop for drum samples
  const drumRows = document.querySelectorAll(".sample-row");
  drumRows.forEach((row) => {
    const idx = row.dataset.sampleIndex;
    if (!idx) return;

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.add("drag-over");
    });

    row.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove("drag-over");
    });

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove("drag-over");
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("audio/") || file.name.toLowerCase().endsWith(".wav")) {
          loadSample(idx, file);
        } else {
          alert("Please drop a WAV audio file.");
        }
      }
    });
  });

  // Initialize clear all button with confirmation dialog
  const clearAllBtn = document.getElementById("drum-clear-all-btn");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", function() {
      if (confirm("Are you sure you want to clear all loaded samples?")) {
        for (let i = 1; i <= NUM_DRUMS; i++) {
          clearSample(i);
        }
      }
    });
  }

  // Recompute patch size when dropdowns change
  ["sample-rate-drum", "bit-depth-drum", "channels-drum"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => {
        updateDrumPatchSize().catch((err) => console.warn("Patch size update failed", err));
        updateDrumPatchSummary();
        for (let k = 1; k <= NUM_DRUMS; k++) {
          if (drumSamples[k]) updateSampleUI(k);
        }
      });
    }
  });

  // Update channels dropdown on initial load
  updateChannelsDropdown();

  // Initialize bulk edit modal
  const bulkEditBtn = document.getElementById('drum-bulk-edit-btn');
  const bulkEditModal = new bootstrap.Modal(document.getElementById('bulk-edit-modal'));
  const bulkPlaymode = document.getElementById('bulk-playmode');
  const bulkReverse = document.getElementById('bulk-reverse');
  const bulkTuneSlider = document.getElementById('bulk-tune-slider');
  const bulkTune = document.getElementById('bulk-tune');
  const bulkGainSlider = document.getElementById('bulk-gain-slider');
  const bulkGain = document.getElementById('bulk-gain');
  const bulkPanSlider = document.getElementById('bulk-pan-slider');
  const bulkPan = document.getElementById('bulk-pan');
  const bulkSave = document.getElementById('bulk-save');

  // Link bulk edit number inputs with their sliders
  bulkTuneSlider.addEventListener('input', (e) => {
    bulkTune.value = e.target.value;
  });

  bulkTune.addEventListener('input', (e) => {
    bulkTuneSlider.value = e.target.value;
  });

  bulkGainSlider.addEventListener('input', (e) => {
    bulkGain.value = e.target.value;
  });

  bulkGain.addEventListener('input', (e) => {
    bulkGainSlider.value = e.target.value;
  });

  bulkPanSlider.addEventListener('input', (e) => {
    bulkPan.value = e.target.value;
  });

  bulkPan.addEventListener('input', (e) => {
    bulkPanSlider.value = e.target.value;
  });

  // Toggle reverse button
  bulkReverse.addEventListener('click', () => {
    const isReverse = bulkReverse.querySelector('span').textContent === 'reverse';
    bulkReverse.querySelector('i').style.transform = isReverse ? '' : 'scaleX(-1)';
    bulkReverse.querySelector('span').textContent = isReverse ? 'forward' : 'reverse';
  });

  // Show bulk edit modal
  bulkEditBtn.addEventListener('click', () => {
    // Reset form to defaults
    bulkPlaymode.value = 'oneshot';
    bulkReverse.querySelector('i').style.transform = '';
    bulkReverse.querySelector('span').textContent = 'forward';
    bulkTuneSlider.value = bulkTune.value = 0;
    bulkGainSlider.value = bulkGain.value = 0;
    bulkPanSlider.value = bulkPan.value = 0;
    
    bulkEditModal.show();
  });

  // Apply bulk edits to all loaded samples
  bulkSave.addEventListener('click', () => {
    const settings = {
      playmode: bulkPlaymode.value,
      reverse: bulkReverse.querySelector('span').textContent === 'reverse',
      tune: parseInt(bulkTune.value),
      gain: parseInt(bulkGain.value),
      pan: parseInt(bulkPan.value)
    };

    // Apply settings to all loaded samples
    for (let i = 1; i <= NUM_DRUMS; i++) {
      if (drumSamples[i]) {
        const advBtn = document.getElementById(`adv-${i}`);
        if (advBtn) {
          advBtn.dataset.playmode = settings.playmode;
          advBtn.dataset.reverse = settings.reverse.toString();
          advBtn.dataset.tune = settings.tune.toString();
          advBtn.dataset.gain = settings.gain.toString();
          advBtn.dataset.pan = settings.pan.toString();
          advBtn.dataset.edited = 'true';
          
          // Update the edited indicator
          updateSampleUI(i);
        }
      }
    }

    bulkEditModal.hide();
  });

  updateBulkActionButtons(); // Add this line
});

// Drum key mapping for two octaves
const drumKeyMap = [
  // Lower octave (octave 0)
  {
    // top row (offset like a real keyboard)
    W: { label: "KD2", idx: 2 },
    E: { label: "SD2", idx: 4 },
    R: { label: "CLP", idx: 6 },
    Y: { label: "CH", idx: 9 },
    U: { label: "OH", idx: 11 },
    // bottom row
    A: { label: "KD1", idx: 1 },
    S: { label: "SD1", idx: 3 },
    D: { label: "RIM", idx: 5 },
    F: { label: "TB", idx: 7 },
    G: { label: "SH", idx: 8 },
    H: { label: "CL", idx: 10 },
    J: { label: "CAB", idx: 12 },
  },
  // Upper octave (octave 1)
  {
    // top row (offset like a real keyboard)
    W: { label: "RC", idx: 13 },
    E: { label: "CC", idx: 14 },
    R: { label: "COW", idx: 16 },
    Y: { label: "LC", idx: 19 },
    U: { label: "HC", idx: 20 },
    // bottom row
    A: { label: "LT", idx: 15 },
    S: { label: "MT", idx: 17 },
    D: { label: "HT", idx: 18 },
    F: { label: "TRI", idx: 21 },
    G: { label: "LT", idx: 22 },
    H: { label: "WS", idx: 23 },
    J: { label: "GUI", idx: 24 },
  },
];
let currentOctave = 0;

function updateKeyboardLabels() {
  const map = drumKeyMap[currentOctave];
  Object.entries(map).forEach(([key, { label }]) => {
    const wrapper = document.querySelector(".key-" + key.toLowerCase());
    if (wrapper) {
      let labelDiv = wrapper.querySelector(".small.text-muted");
      if (!labelDiv) {
        labelDiv = document.createElement("div");
        labelDiv.className = "small text-muted";
        wrapper.appendChild(labelDiv);
      }
      labelDiv.textContent = label;
    }
  });
}

// Initial label update
updateKeyboardLabels();

// Octave controls
function setOctave(oct) {
  currentOctave = oct;
  updateKeyboardLabels();
}
document.querySelectorAll(".octave-controls .kbd").forEach((el) => {
  el.addEventListener("click", () => {
    if (el.textContent.trim().toUpperCase() === "Z") setOctave(0);
    if (el.textContent.trim().toUpperCase() === "X") setOctave(1);
  });
});

// === Drum Sample Loader & Playback Logic ===
const NUM_DRUMS = 24;
const drumSamples = new Array(NUM_DRUMS + 1).fill(null); // 1-based indexing
const drumSampleNames = new Array(NUM_DRUMS + 1).fill("");

// Helper: determine if any drum samples have been loaded
function anyDrumSamplesLoaded() {
  return drumSamples.some((s, idx) => idx > 0 && s !== null);
}

// Helper: enable/disable the "generate patch" button based on current state
function updateGeneratePatchBtnState() {
  const generateBtn = Array.from(
    document.querySelectorAll("#drum .accent-btn")
  ).find((btn) => btn.textContent.toLowerCase().includes("generate patch"));
  if (!generateBtn) return;

  const nameInput = document.getElementById("preset-name-drum");
  const presetName = nameInput ? nameInput.value.trim() : "";

  generateBtn.disabled = !anyDrumSamplesLoaded() || presetName.length === 0;
}

// ----------------------------------------------
// Patch size indicator and summary helpers
// ----------------------------------------------
const DRUM_PATCH_LIMIT_BYTES = 8 * 1024 * 1024; // 8 MB

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Calculate approximate patch size and update UI elements
async function updateDrumPatchSize() {
  const rateSelect = document.getElementById("sample-rate-drum");
  const depthSelect = document.getElementById("bit-depth-drum");
  const chSelect = document.getElementById("channels-drum");

  const selectedRate = rateSelect ? rateSelect.value : "0";
  const selectedDepth = depthSelect ? depthSelect.value : "keep";
  const selectedChannels = chSelect ? chSelect.value : "keep";

  // Calculate size asynchronously for all samples in parallel
  const sizePromises = drumSamples.map(async (s) => {
    if (!s) return 0;
    try {
      const bytes = await getActualConvertedSize(
        s,
        selectedRate,
        selectedDepth,
        selectedChannels
      );
      return bytes;
    } catch (e) {
      console.warn("size calc failed", e);
      return s.fileSize || 0;
    }
  });

  const sizes = await Promise.all(sizePromises);
  const totalBytes = sizes.reduce((a, b) => a + b, 0);

  // Update UI elements
  const sizeLabel = document.getElementById("drum-current-patch-size");
  if (sizeLabel) sizeLabel.textContent = formatMB(totalBytes) + " / 8 MB";

  const percent = Math.min(100, (totalBytes / DRUM_PATCH_LIMIT_BYTES) * 100);
  const progress = document.getElementById("drum-patch-size-progress");
  if (progress) {
    progress.style.width = percent.toFixed(1) + "%";
    progress.setAttribute("aria-valuenow", percent.toFixed(0));
  }

  const status = document.getElementById("drum-patch-size-status");
  if (status) {
    status.textContent =
      percent >= 95
        ? "running out of space"
        : percent >= 75
        ? "over 75% capacity"
        : "plenty of space remaining";
  }
}

// Build a simple patch summary (number of samples, total duration)
function updateDrumPatchSummary() {
  let loaded = 0;
  let totalDuration = 0;
  let totalOriginalSize = 0;
  let totalConvertedSize = 0;
  let conversionsNeeded = 0;

  const targetBitDepth = getDrumTargetBitDepth();
  const targetSampleRate = getDrumTargetSampleRate();
  const targetChannels = document.getElementById("channels-drum").value;

  drumSamples.forEach((s) => {
    if (s) {
      loaded += 1;
      totalDuration += s.duration || 0;
      
      // Calculate original size
      const originalSize = s.fileSize || 0;
      totalOriginalSize += originalSize;
      
      // Check if conversion needed and calculate size
      let currentSize = originalSize;
      
      // Calculate mono conversion size
      if (targetChannels === "mono" && s.originalChannels > 1) {
        conversionsNeeded++;
        currentSize = currentSize / 2;
      }
      
      // Calculate bit depth conversion size
      if (targetBitDepth !== "keep") {
        const originalBits = s.originalBitDepth || 16;
        const targetBits = parseInt(targetBitDepth);
        if (targetBits !== originalBits) {
          conversionsNeeded++;
          currentSize = currentSize * (targetBits / originalBits);
        }
      }
      
      // Calculate sample rate conversion size
      if (targetSampleRate !== 0) {
        const originalRate = s.originalSampleRate || 44100;
        if (targetSampleRate !== originalRate) {
          conversionsNeeded++;
          currentSize = currentSize * (targetSampleRate / originalRate);
        }
      }
      
      totalConvertedSize += currentSize;
    }
  });

  const summaryBlock = document.getElementById("drum-patch-summary");
  const stats = document.getElementById("drum-patch-stats");
  if (!summaryBlock || !stats) return;

  if (loaded === 0) {
    summaryBlock.style.display = "none";
    return;
  }

  summaryBlock.style.display = "block";
  
  // Calculate total space savings
  const totalSavings = ((totalOriginalSize - totalConvertedSize) / totalOriginalSize * 100).toFixed(1);
  const savingsText = totalSavings > 0 ? ` · ${totalSavings}% space saved` : '';
  
  // Build summary text
  const conversionText = conversionsNeeded > 0 ? ` · ${conversionsNeeded} conversions needed` : '';
  stats.innerHTML = `${loaded} samples · ${totalDuration.toFixed(1)}s total${conversionText}${savingsText}`;
}

let drumSamplePreviews = {}; // Store preview data for size calculations
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Function to re-encode audio buffer at specified sample rate
function reencodeAudioBuffer(audioBuffer, targetSampleRate) {
  if (targetSampleRate === 0 || audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer; // No change needed
  }

  const ratio = targetSampleRate / audioBuffer.sampleRate;
  const newLength = Math.round(audioBuffer.length * ratio);
  const newBuffer = new AudioBuffer({
    numberOfChannels: audioBuffer.numberOfChannels,
    length: newLength,
    sampleRate: targetSampleRate,
  });

  // Simple linear interpolation resampling
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    for (let i = 0; i < newLength; i++) {
      const oldIndex = i / ratio;
      const index = Math.floor(oldIndex);
      const fraction = oldIndex - index;

      if (index >= oldData.length - 1) {
        newData[i] = oldData[oldData.length - 1];
      } else {
        newData[i] =
          oldData[index] * (1 - fraction) + oldData[index + 1] * fraction;
      }
    }
  }

  return newBuffer;
}

// Function to get target sample rate from dropdown
function getDrumTargetSampleRate() {
  const sampleRateSelect = document.getElementById("sample-rate-drum");
  return sampleRateSelect.value; // Return the string value directly
}

// Function to get target bit depth from dropdown
function getDrumTargetBitDepth() {
  const bitDepthSelect = document.getElementById("bit-depth-drum");
  if (!bitDepthSelect) return "keep";
  return bitDepthSelect.value;
}

function loadSample(idx, file) {
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const metadata = await readWavMetadata(file);
      const buffer = metadata.audioBuffer;
      
      // Store enhanced sample data with metadata
      drumSamples[idx] = {
        audioBuffer: buffer,
        filename: file.name,
        originalBitDepth: metadata.bitDepth,
        originalSampleRate: metadata.sampleRate,
        originalChannels: metadata.channels,
        fileSize: file.size,
        duration: metadata.duration,
        convertedSizes: {} // Cache for converted file sizes
      };
      
      drumSampleNames[idx] = file.name;
      updateSampleUI(idx);
      
      const playBtn = document.getElementById(`play-${idx}`);
      const clearBtn = document.getElementById(`clear-${idx}`);
      const advBtn = document.getElementById(`adv-${idx}`);
      if (playBtn) playBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
      if (advBtn) {
        advBtn.disabled = false;
        advBtn.dataset.edited = "false";
      }
      // Update generate patch button state
      updateGeneratePatchBtnState();
      // Update patch size indicator
      updateDrumPatchSize().catch(err => console.warn('Patch size update failed:', err));
      updateDrumPatchSummary();
      updateChannelsDropdown(); // Add this line
      updateBulkActionButtons(); // Add this line
    } catch (err) {
      console.error('Failed to load sample:', err);
      showImportError('failed to load audio file. make sure it is a valid wav file.');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Enhanced sample UI display
function updateSampleUI(sampleIndex) {
  // Call updateDropdownOptions first
  updateDropdownOptions();

  const sampleNameDiv = document.getElementById(`sample-name-${sampleIndex}`);
  if (!sampleNameDiv) return;

  const sample = drumSamples[sampleIndex];
  if (!sample) {
    sampleNameDiv.innerHTML = "";
    return;
  }

  // Get current conversion settings
  const targetBitDepth = getDrumTargetBitDepth();
  const targetSampleRate = getDrumTargetSampleRate();
  const targetChannels = document.getElementById("channels-drum").value;

  // Calculate effective values after conversion
  const effectiveBitDepth = getEffectiveBitDepth(sample.originalBitDepth, targetBitDepth);
  const effectiveSampleRate = getEffectiveSampleRate(sample.originalSampleRate, targetSampleRate);
  const effectiveChannels = getEffectiveChannels(sample.originalChannels, targetChannels);

  // Get current and converted file sizes
  const originalSize = sample.fileSize;
  let convertedSize = originalSize;

  // Calculate size changes based on conversions
  if (effectiveBitDepth !== sample.originalBitDepth) {
    convertedSize = convertedSize * (effectiveBitDepth / sample.originalBitDepth);
  }
  if (effectiveSampleRate !== sample.originalSampleRate) {
    convertedSize = convertedSize * (effectiveSampleRate / sample.originalSampleRate);
  }
  if (effectiveChannels !== sample.originalChannels) {
    convertedSize = convertedSize * (effectiveChannels / sample.originalChannels);
  }

  // Duration and file size
  const durationText = `<i class="fa fa-clock me-1"></i>${sample.duration < 1 ? 
    `${Math.round(sample.duration * 1000)}ms` : 
    `${sample.duration.toFixed(1)}s`}`;

  const fileSizeText = `<i class="fa fa-hdd me-1"></i>${formatFileSize(originalSize)}${
    convertedSize !== originalSize ? 
    ` <i class="fa fa-arrow-right mx-1"></i> ${formatFileSize(convertedSize)}` : 
    ''}`;

  // Channel info with icons
  let channelIcon = sample.originalChannels === 1 ? 'fa-volume-down' : 'fa-volume-up';
  let channelText = `<i class="fa ${channelIcon} me-1"></i>${sample.originalChannels === 1 ? 'mono' : 'stereo'}`;
  if (effectiveChannels !== sample.originalChannels) {
    const newIcon = effectiveChannels === 1 ? 'fa-volume-down' : 'fa-volume-up';
    const newText = effectiveChannels === 1 ? 'mono' : 'stereo';
    channelText += ` <i class="fa fa-arrow-right mx-1"></i> <i class="fa ${newIcon} me-1"></i>${newText}`;
  }

  // Build conversion indicators with icons
  let bitDepthText = `<i class="fa fa-database me-1"></i>${sample.originalBitDepth}-bit`;
  if (effectiveBitDepth !== sample.originalBitDepth) {
    bitDepthText = `<i class="fa fa-database me-1"></i>${sample.originalBitDepth}-bit <i class="fa fa-arrow-right mx-1"></i> ${effectiveBitDepth}-bit`;
  }

  let sampleRateText = `<i class="fa fa-tachometer-alt me-1"></i>${(sample.originalSampleRate / 1000).toFixed(1)}khz`;
  if (effectiveSampleRate !== sample.originalSampleRate) {
    sampleRateText = `<i class="fa fa-tachometer-alt me-1"></i>${(sample.originalSampleRate / 1000).toFixed(1)}khz <i class="fa fa-arrow-right mx-1"></i> ${(effectiveSampleRate / 1000).toFixed(1)}khz`;
  }

  // Get the advanced settings button to check if sample has been edited
  const advBtn = document.getElementById(`adv-${sampleIndex}`);
  const isEdited = advBtn && advBtn.dataset.edited === "true";
   
  const editedIndicator = isEdited ? 
    `<i class="fa fa-check text-muted ms-2" title="Sample has custom settings"></i>` : 
    '';

  sampleNameDiv.innerHTML = `
    <div class="sample-filename">${sample.filename}${editedIndicator}</div>
    <div class="sample-specs mt-1">
      <div class="specs-row">
        <span class="badge">${durationText}</span>
        <span class="badge">${fileSizeText}</span>
        <span class="badge">${channelText}</span>
      </div>
      <div class="specs-row mt-1">
        <span class="badge">${bitDepthText}</span>
        <span class="badge">${sampleRateText}</span>
      </div>
    </div>
  `;

  // Re-enable buttons
  const playBtn = document.getElementById(`play-${sampleIndex}`);
  const clearBtn = document.getElementById(`clear-${sampleIndex}`);
  if (playBtn) playBtn.disabled = false;
  if (clearBtn) clearBtn.disabled = false;
  if (advBtn) advBtn.disabled = false;
}

function clearSample(idx) {
  drumSamples[idx] = null;
  drumSampleNames[idx] = "";
  document.getElementById(`sample-name-${idx}`).innerHTML = "";
  const playBtn = document.getElementById(`play-${idx}`);
  const clearBtn = document.getElementById(`clear-${idx}`);
  const advBtn = document.getElementById(`adv-${idx}`);
  const fileInput = document.getElementById(`sample-${idx}`);
  if (playBtn) playBtn.disabled = true;
  if (clearBtn) clearBtn.disabled = true;
  if (advBtn) {
    advBtn.disabled = true;
    // Reset all advanced settings to defaults
    advBtn.dataset.playmode = "oneshot";
    advBtn.dataset.reverse = "false";
    advBtn.dataset.tune = "0";
    advBtn.dataset.pan = "0";
    advBtn.dataset.gain = "0";
    advBtn.dataset.sampleStart = "0";
    advBtn.dataset.sampleEnd = "0";
    advBtn.dataset.edited = "false";
  }
  // Reset the file input value so it can be reused
  if (fileInput) fileInput.value = "";
  
  // Update generate patch button state
  updateGeneratePatchBtnState();
  // Update patch size indicator
  updateDrumPatchSize().catch(err => console.warn('Patch size update failed:', err));
  updateDrumPatchSummary();
  updateChannelsDropdown(); // Add this line
  updateBulkActionButtons(); // Add this line
}

function playSample(idx) {
  if (!drumSamples[idx]) return;
  const ctx = getAudioContext();
  const src = ctx.createBufferSource();
  let buffer = drumSamples[idx].audioBuffer;

  // Get Sample options from the button
  const advancedBtn = document.querySelector(
    `.advanced-btn[data-sample-idx='${idx}']`
  );
  const isReverse = advancedBtn && advancedBtn.dataset.reverse === "true";
  let semitones = 0;
  if (advancedBtn && advancedBtn.dataset.tune) {
    semitones = parseInt(advancedBtn.dataset.tune, 10) || 0;
  }
  // === Apply waveform start/end selection ===
  let sampleStart = 0;
  let sampleEnd = buffer.length;
  if (advancedBtn) {
    if (advancedBtn.dataset.sampleStart) {
      sampleStart = Math.max(
        0,
        Math.min(
          parseInt(advancedBtn.dataset.sampleStart, 10) || 0,
          buffer.length - 1
        )
      );
    }
    if (advancedBtn.dataset.sampleEnd) {
      sampleEnd = Math.max(
        sampleStart + 1,
        Math.min(
          parseInt(advancedBtn.dataset.sampleEnd, 10) || buffer.length,
          buffer.length
        )
      );
    }
  }
  // If selection is not the full buffer, create a new buffer for the selection
  if (sampleStart !== 0 || sampleEnd !== buffer.length) {
    const selectionLength = sampleEnd - sampleStart;
    const selectionBuffer = ctx.createBuffer(
      buffer.numberOfChannels,
      selectionLength,
      buffer.sampleRate
    );
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const srcData = buffer.getChannelData(ch);
      const dstData = selectionBuffer.getChannelData(ch);
      for (let i = 0; i < selectionLength; i++) {
        dstData[i] = srcData[sampleStart + i];
      }
    }
    buffer = selectionBuffer;
  }
  // Check reverse state and apply if needed
  if (isReverse) {
    const revBuffer = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const srcData = buffer.getChannelData(ch);
      const dstData = revBuffer.getChannelData(ch);
      for (let i = 0, j = srcData.length - 1; i < srcData.length; i++, j--) {
        dstData[i] = srcData[j];
      }
    }
    buffer = revBuffer;
  }
  src.buffer = buffer;
  // Apply semitone tuning for browser playback
  src.playbackRate.value = Math.pow(2, semitones / 12);

  // === Stereo Panning ===
  let panValue = 0;
  if (advancedBtn && advancedBtn.dataset.pan) {
    panValue = parseInt(advancedBtn.dataset.pan, 10) || 0;
  }
  // === Gain ===
  let gainValue = 0;
  if (
    advancedBtn &&
    typeof advancedBtn.dataset.gain !== "undefined" &&
    advancedBtn.dataset.gain !== null
  ) {
    gainValue = Number(advancedBtn.dataset.gain);
  }
  // If NaN, fallback to 0
  if (isNaN(gainValue)) gainValue = 0;
  gainValue = Math.max(-30, Math.min(20, gainValue));
  // Map -100..100 to -1..1
  const panNode = ctx.createStereoPanner();
  panNode.pan.value = Math.max(-1, Math.min(1, panValue / 100));
  // Gain node: dB to linear
  const gainNode = ctx.createGain();
  gainNode.gain.value = Math.pow(10, gainValue / 20);
  src.connect(panNode).connect(gainNode).connect(ctx.destination);
  src.start(0);
}

function playSampleSlice(idx, startFrame, endFrame, panValue, tune = 0, gain = 0, isReverse = false) {
  if (!drumSamples[idx] || !drumSamples[idx].audioBuffer) return;

  const ctx = getAudioContext();
  const buffer = drumSamples[idx].audioBuffer;
  
  // Create a copy of the buffer for processing
  const tempBuffer = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  // Copy and potentially reverse the buffer
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    const tempData = tempBuffer.getChannelData(channel);
    if (isReverse) {
      for (let i = 0; i < channelData.length; i++) {
        tempData[i] = channelData[channelData.length - 1 - i];
      }
    } else {
      tempData.set(channelData);
    }
  }

  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  const panNode = ctx.createStereoPanner();

  source.buffer = tempBuffer;
  source.playbackRate.value = Math.pow(2, tune / 12); // Semitone tuning
  gainNode.gain.value = Math.pow(10, gain / 20); // Convert dB to linear gain
  panNode.pan.value = Math.max(-1, Math.min(1, panValue / 100)); // Convert pan range (-100 to 100) to -1 to 1

  source.connect(gainNode);
  gainNode.connect(panNode);
  panNode.connect(ctx.destination);

  const startTime = ctx.currentTime;
  source.start(startTime, startFrame / buffer.sampleRate, (endFrame - startFrame) / buffer.sampleRate);
}

// Wire up file inputs, play, clear, and Sample options buttons
const hiHatLabels = ["closed hi-hat", "open hi-hat", "ch", "oh", "hh", "hat"];
for (let i = 1; i <= NUM_DRUMS; i++) {
  const fileInput = document.getElementById(`sample-${i}`);
  const playBtn = document.getElementById(`play-${i}`);
  const clearBtn = document.getElementById(`clear-${i}`);
  const advancedBtn = document.getElementById(`adv-${i}`);
  const label = fileInput?.previousElementSibling;
  const row = advancedBtn?.closest("tr");

  if (fileInput) {
    // Remove the manual click handler since HTML 'for' attribute handles this automatically
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        loadSample(i, e.target.files[0]);
      }
    });
    // === Drag and Drop Support ===
    // Allow drag-and-drop on the file input's parent row or label
    const dropTarget = row || label || fileInput;
    if (dropTarget) {
      dropTarget.addEventListener("dragover", function (e) {
        e.preventDefault();
        dropTarget.classList.add("dragover");
      });
      dropTarget.addEventListener("dragleave", function (e) {
        dropTarget.classList.remove("dragover");
      });
      dropTarget.addEventListener("drop", function (e) {
        e.preventDefault();
        dropTarget.classList.remove("dragover");
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          // Set the file input's files property and trigger change event
          // Note: FileList is read-only, so we call loadSample directly
          loadSample(i, files[0]);
          // Optionally update UI to show file name
          if (fileInput) fileInput.value = "";
        }
      });
    }
  }
  if (playBtn) playBtn.addEventListener("click", () => playSample(i));
  if (clearBtn) clearBtn.addEventListener("click", () => clearSample(i));
  
  // Add record button event handler
  const recordBtn = document.getElementById(`record-${i}`);
  if (recordBtn) {
    recordBtn.addEventListener("click", () => openRecordingModalForDrum(i));
  }

  if (advancedBtn) {
    // Initialize data attributes and set defaults
    const drumLabel = row?.children[0]?.textContent?.toLowerCase() || "";
    if (hiHatLabels.some((hh) => drumLabel.includes(hh))) {
      advancedBtn.dataset.playmode = "group";
    } else {
      advancedBtn.dataset.playmode = "oneshot";
    }
    advancedBtn.dataset.reverse = "false";
    advancedBtn.dataset.tune = "0";
    advancedBtn.dataset.gain = "0"; // Default gain
    advancedBtn.dataset.edited = "false";

    // Disable advanced button until a sample is loaded
    advancedBtn.disabled = true;

    advancedBtn.addEventListener("click", function () {
      const advancedBtn = this;
      const sampleIndex = i;
      const sampleObj = drumSamples[sampleIndex];
      const buffer = sampleObj ? sampleObj.audioBuffer : null;

      // Create a temporary state object to hold changes
      const tempSettings = {
        playmode: advancedBtn.dataset.playmode || "oneshot",
        isReverse: advancedBtn.dataset.reverse === "true",
        tune: parseInt(advancedBtn.dataset.tune, 10) || 0,
        pan: parseInt(advancedBtn.dataset.pan, 10) || 0,
        gain: parseInt(advancedBtn.dataset.gain, 10) || 0,
        sampleStart: parseInt(advancedBtn.dataset.sampleStart, 10),
        sampleEnd: parseInt(advancedBtn.dataset.sampleEnd, 10),
      };

      if (buffer) {
        if (isNaN(tempSettings.sampleStart)) tempSettings.sampleStart = 0;
        if (isNaN(tempSettings.sampleEnd) || tempSettings.sampleEnd <= 0)
          tempSettings.sampleEnd = buffer.length;
      } else {
        if (isNaN(tempSettings.sampleStart)) tempSettings.sampleStart = 0;
        if (isNaN(tempSettings.sampleEnd)) tempSettings.sampleEnd = 0;
      }

      let modal = document.getElementById("advanced-modal");
      if (modal) {
        // Add keyboard event handler for 'p' key in advanced modal
        const advKeyHandler = (e) => {
          if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            modal.querySelector(".adv-play-modal").click();
            e.preventDefault();
          }
        };
        
        // Add keyboard listener when modal is shown
        document.addEventListener("keydown", advKeyHandler);
        
        // Remove keyboard listener when modal is hidden
        const cleanupAdvKeyHandler = () => {
          document.removeEventListener("keydown", advKeyHandler);
          modal.removeEventListener("hidden.bs.modal", cleanupAdvKeyHandler);
        };
        modal.addEventListener("hidden.bs.modal", cleanupAdvKeyHandler);

        // Add play button click handler
        modal.querySelector(".adv-play-modal").onclick = () => {
          const sampleIndex = modal.dataset.sampleIndex;
          const startFrame = parseInt(startInput.value, 10);
          const endFrame = parseInt(endInput.value, 10);
          playSampleSlice(sampleIndex, startFrame, endFrame, tempSettings.pan, tempSettings.tune, tempSettings.gain, tempSettings.isReverse);
        };

        // Reset modal fields to match tempSettings
        modal.querySelector(".adv-playmode").value = tempSettings.playmode;
        modal.querySelector(".adv-reverse-label").textContent =
          tempSettings.isReverse ? "reverse" : "forward";
        modal.querySelector(".adv-tune-slider").value = tempSettings.tune;
        modal.querySelector(".adv-tune").value = tempSettings.tune;
        modal.querySelector(".adv-gain-slider").value = tempSettings.gain;
        modal.querySelector(".adv-gain").value = tempSettings.gain;
        modal.querySelector("#advancedPanSlider").value = tempSettings.pan;
        modal.querySelector("#advancedPanNumber").value = tempSettings.pan;
        // Use Bootstrap API to show modal (manages aria-hidden and backdrop)
        const advModalInstance = bootstrap.Modal.getOrCreateInstance(modal);
        advModalInstance.show();
      }

      // Updated closeModal to animate out
      const advModalInstance = bootstrap.Modal.getOrCreateInstance(modal);
      const closeModal = () => {
        const instance = bootstrap.Modal.getOrCreateInstance(modal);
        instance.hide();
      };
      modal
        .querySelectorAll(".adv-cancel")
        .forEach((el) => (el.onclick = closeModal));

      // === Close modal if clicking outside modal-dialog ===
      modal.addEventListener("mousedown", function (e) {
        if (e.target === modal) {
          closeModal();
        }
      });

      modal.querySelector(".adv-save").onclick = () => {
        const btnToUpdate = document.getElementById(`adv-${sampleIndex}`);
        if (btnToUpdate) {
          btnToUpdate.dataset.playmode = tempSettings.playmode;
          btnToUpdate.dataset.reverse = tempSettings.isReverse.toString();
          btnToUpdate.dataset.tune = tempSettings.tune;
          btnToUpdate.dataset.pan = tempSettings.pan;
          btnToUpdate.dataset.gain = tempSettings.gain;
          btnToUpdate.dataset.sampleStart = tempSettings.sampleStart;
          btnToUpdate.dataset.sampleEnd = tempSettings.sampleEnd;
          btnToUpdate.dataset.edited = "true";
          
          // Update the sample UI to show edit indicator
          updateSampleUI(sampleIndex);
        }
        closeModal();
      };

      modal.querySelector(".adv-playmode").onchange = function () {
        tempSettings.playmode = this.value;
      };

      modal.querySelector(".adv-reverse").onclick = function () {
        const icon = this.querySelector("i");
        const label = this.querySelector(".adv-reverse-label");
        tempSettings.isReverse = !tempSettings.isReverse;
        if (tempSettings.isReverse) {
          icon.style.transform = "scaleX(-1)";
          label.textContent = "reverse";
        } else {
          icon.style.transform = "";
          label.textContent = "forward";
        }
        // Play audio after direction change (debounced)
        if (window.zoomPlayTimeout) clearTimeout(window.zoomPlayTimeout);
        window.zoomPlayTimeout = setTimeout(() => {
          modal.querySelector(".adv-play-modal").click();
        }, 80);
      };

      modal.querySelector("#advancedPanSlider").oninput = function () {
        modal.querySelector("#advancedPanNumber").value = this.value;
        tempSettings.pan = parseInt(this.value, 10);
        // Play audio after pan change (debounced)
        if (window.zoomPlayTimeout) clearTimeout(window.zoomPlayTimeout);
        window.zoomPlayTimeout = setTimeout(() => {
          modal.querySelector(".adv-play-modal").click();
        }, 80);
      };
      modal.querySelector("#advancedPanNumber").oninput = function () {
        modal.querySelector("#advancedPanSlider").value = this.value;
        tempSettings.pan = parseInt(this.value, 10);
        // Play audio after pan change (debounced)
        if (window.zoomPlayTimeout) clearTimeout(window.zoomPlayTimeout);
        window.zoomPlayTimeout = setTimeout(() => {
          modal.querySelector(".adv-play-modal").click();
        }, 80);
      };

      modal.querySelector(".adv-tune-slider").oninput = function () {
        modal.querySelector(".adv-tune").value = this.value;
        tempSettings.tune = parseInt(this.value, 10);
        // Play audio after tune change (debounced)
        if (window.zoomPlayTimeout) clearTimeout(window.zoomPlayTimeout);
        window.zoomPlayTimeout = setTimeout(() => {
          modal.querySelector(".adv-play-modal").click();
        }, 80);
      };
      modal.querySelector(".adv-tune").oninput = function () {
        let val = parseInt(this.value, 10) || 0;
        val = Math.max(-48, Math.min(48, val));
        this.value = val;
        modal.querySelector(".adv-tune-slider").value = val;
        tempSettings.tune = val;
        // Play audio after tune change (debounced)
        if (window.zoomPlayTimeout) clearTimeout(window.zoomPlayTimeout);
        window.zoomPlayTimeout = setTimeout(() => {
          modal.querySelector(".adv-play-modal").click();
        }, 80);
      };

      // === Gain slider logic ===
      modal.querySelector(".adv-gain-slider").oninput = function () {
        modal.querySelector(".adv-gain").value = this.value;
        tempSettings.gain = parseInt(this.value, 10);
      };
      modal.querySelector(".adv-gain").oninput = function () {
        let val = parseInt(this.value, 10) || -30;
        val = Math.max(-30, Math.min(20, val));
        this.value = val;
        modal.querySelector(".adv-gain-slider").value = val;
        tempSettings.gain = val;
      };

      // Create modal instances once and reuse them
      const zoomModalElement = document.getElementById("zoom-modal");
      const advancedModalElement = document.getElementById("advanced-modal");

      let zoomModalInstance = bootstrap.Modal.getInstance(zoomModalElement) || 
                             new bootstrap.Modal(zoomModalElement);
      let advancedModalInstance = bootstrap.Modal.getInstance(advancedModalElement) || 
                                 new bootstrap.Modal(advancedModalElement);

      // Zoom button click handler
      modal.querySelector("#zoom-btn").addEventListener("click", () => {
        const startPoint = modal.querySelector(".adv-sample-start").value;
        const endPoint = modal.querySelector(".adv-sample-end").value;

        // Set up zoom modal data
        zoomModalElement.dataset.sampleIndex = sampleIndex;
        document.getElementById("zoom-start-point").value = startPoint;
        document.getElementById("zoom-end-point").value = endPoint;

        // Proper Bootstrap transition: hide current, show new
        advancedModalInstance.hide();
        
        // Use the 'hidden' event to show zoom modal after advanced is fully hidden
        const showZoomHandler = () => {
          zoomModalInstance.show();
          advancedModalElement.removeEventListener('hidden.bs.modal', showZoomHandler);
        };
        advancedModalElement.addEventListener('hidden.bs.modal', showZoomHandler);
      });

      // Return from zoom to advanced modal - simplified approach
      const returnToAdvancedHandler = () => {
        // Update advanced modal with any changes from zoom modal
        const startInput = advancedModalElement.querySelector(".adv-sample-start");
        const endInput = advancedModalElement.querySelector(".adv-sample-end");
        startInput.value = tempSettings.sampleStart;
        endInput.value = tempSettings.sampleEnd;
        
        // Show the advanced modal
        advancedModalInstance.show();
        
        // Update waveform after modal is shown
        advancedModalElement.addEventListener('shown.bs.modal', () => {
          // Force a redraw of the waveform and markers
          const waveformDiv = advancedModalElement.querySelector("#waveform-container-modal");
          if (waveformDiv && waveformDiv.querySelector("canvas")) {
            const canvas = waveformDiv.querySelector("canvas");
            const ctx = canvas.getContext("2d");
            const width = canvas.width;
            const height = canvas.height;
            const buffer = drumSamples[zoomModalElement.dataset.sampleIndex].audioBuffer;
            
            // Redraw waveform and markers
            drawBuffer(width, height, ctx, buffer);
            if (typeof advancedModalElement.drawMarkers === "function") {
              advancedModalElement.drawMarkers();
            }
          }
        }, { once: true });
      };

      // Set up the return handler only once (not in every 'shown' event)
      if (!zoomModalElement.hasAttribute('data-return-handler-set')) {
        zoomModalElement.setAttribute('data-return-handler-set', 'true');
        zoomModalElement.addEventListener('hidden.bs.modal', returnToAdvancedHandler);
      }

      // Add keyboard event handler for 'p' key in zoom modal
      const zoomKeyHandler = (e) => {
        if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const sampleIndex = zoomModalElement.dataset.sampleIndex;
          const startFrame = parseInt(document.getElementById("zoom-start-point").value, 10);
          const endFrame = parseInt(document.getElementById("zoom-end-point").value, 10);
          playSampleSlice(sampleIndex, startFrame, endFrame, tempSettings.pan, tempSettings.tune, tempSettings.gain, tempSettings.isReverse);
          e.preventDefault();
        }
      };

      zoomModalElement.addEventListener("shown.bs.modal", () => {
        // Add keyboard listener when modal is shown
        document.addEventListener("keydown", zoomKeyHandler);
        
        const sampleIndex = zoomModalElement.dataset.sampleIndex;
        const sample = drumSamples[sampleIndex];
        if (!sample) return;
        
        const buffer = sample.audioBuffer;
        if (!buffer) return;

        const canvas = document.getElementById("zoom-canvas");
        // Clean up any existing event listeners
        const newCanvas = canvas.cloneNode(true);
        canvas.parentNode.replaceChild(newCanvas, canvas);
        
        // Responsive: set canvas width/height to parent width and CSS height
        // Account for modal body padding (Bootstrap default is 1rem = 16px each side)
        const parentWidth = (newCanvas.parentElement.clientWidth || 300) - 32;
        // Get computed height from CSS (or fallback to 60)
        const computedStyle = window.getComputedStyle(newCanvas);
        let cssHeight = parseInt(computedStyle.height, 10);
        if (isNaN(cssHeight) || cssHeight < 10) cssHeight = 60;
        newCanvas.width = parentWidth;
        newCanvas.height = cssHeight;

        const startInput = document.getElementById("zoom-start-point");
        const endInput = document.getElementById("zoom-end-point");
        const width = newCanvas.width;
        const height = newCanvas.height;
        const ctx = newCanvas.getContext("2d");
        const data = buffer.getChannelData(0);

        let startFrame = parseInt(startInput.value, 10);
        let endFrame = parseInt(endInput.value, 10);
        if (isNaN(startFrame)) startFrame = 0;
        if (isNaN(endFrame) || endFrame <= 0) endFrame = buffer.length;

        function drawZoomWaveform() {
          // Use drawBuffer for min-max waveform
          drawBuffer(width, height, ctx, buffer);
          // Draw center line
          const amp = height / 2;
          ctx.strokeStyle = "#333";
          ctx.beginPath();
          ctx.moveTo(0, amp);
          ctx.lineTo(width, amp);
          ctx.stroke();
        }

        // In the zoom modal, update marker colors to greyscale
        function drawZoomMarkers() {
          // Start marker (dark grey vertical line)
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 2;
          const startX = Math.floor((startFrame / data.length) * width);
          ctx.beginPath();
          ctx.moveTo(startX, 0);
          ctx.lineTo(startX, height);
          ctx.stroke();

          // End marker (dark grey vertical line)
          const endX = Math.floor((endFrame / data.length) * width);
          ctx.beginPath();
          ctx.moveTo(endX, 0);
          ctx.lineTo(endX, height);
          ctx.stroke();

          // Triangle markers at bottom (dark grey, consistent with multisample tool)
          ctx.fillStyle = "#333";
          const triangleSize = 10; // Match multisample tool size
          const bottomY = height; // No gap at bottom

          // Start marker triangle (pointing up)
          ctx.beginPath();
          ctx.moveTo(startX - triangleSize / 2, bottomY);
          ctx.lineTo(startX + triangleSize / 2, bottomY);
          ctx.lineTo(startX, bottomY - triangleSize);
          ctx.closePath();
          ctx.fill();

          // End marker triangle (pointing up)
          ctx.beginPath();
          ctx.moveTo(endX - triangleSize / 2, bottomY);
          ctx.lineTo(endX + triangleSize / 2, bottomY);
          ctx.lineTo(endX, bottomY - triangleSize);
          ctx.closePath();
          ctx.fill();
        }

        function updateSampleValueDisplays() {
          const startValueElement = document.getElementById('zoom-start-value');
          const endValueElement = document.getElementById('zoom-end-value');

          function updateValueDisplay(element, frame) {
            if (element && frame >= 0 && frame < data.length) {
              const value = data[frame];
              element.textContent = value.toFixed(3);
              
              if (Math.abs(value) < 0.01) {
                element.classList.add('bg-success');
                element.classList.remove('bg-secondary');
              } else {
                element.classList.remove('bg-success');
                element.classList.add('bg-secondary');
              }
            }
          }

          updateValueDisplay(startValueElement, startFrame);
          updateValueDisplay(endValueElement, endFrame);
        }

        function updateZoomWaveformAndMarkers() {
          drawZoomWaveform();
          drawZoomMarkers();
          updateSampleValueDisplays();
        }

        updateZoomWaveformAndMarkers();

        // Add input event handlers for manual value entry
        startInput.addEventListener('input', () => {
          let newStart = parseInt(startInput.value, 10);
          if (isNaN(newStart)) newStart = 0;
          newStart = Math.max(0, Math.min(newStart, data.length - 1));
          startFrame = newStart;
          startInput.value = newStart;
          tempSettings.sampleStart = newStart;
          
          // Push end marker if start goes past it
          if (newStart >= endFrame) {
            endFrame = Math.min(newStart + 10, data.length);
            endInput.value = endFrame;
            tempSettings.sampleEnd = endFrame;
          }
          
          updateZoomWaveformAndMarkers();
        });

        endInput.addEventListener('input', () => {
          let newEnd = parseInt(endInput.value, 10);
          if (isNaN(newEnd)) newEnd = data.length;
          newEnd = Math.max(startFrame + 10, Math.min(newEnd, data.length));
          endFrame = newEnd;
          endInput.value = newEnd;
          tempSettings.sampleEnd = newEnd;
          
          updateZoomWaveformAndMarkers();
        });

        let dragging = null;

        // Add hover cursor change
        newCanvas.addEventListener("mousemove", function (e) {
          const rect = newCanvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const xNormalized = x / width;
          
          if (dragging) {
            const frame = Math.round((x / width) * data.length);
            const snapToZero = document.getElementById('zero-crossing-snap').checked;
            
            if (dragging === "start") {
              let newStart = Math.max(0, Math.min(frame, data.length - 1));
              
              // Snap to zero crossing if enabled
              if (snapToZero) {
                newStart = findNearestZeroCrossing(data, newStart, 'both');
              }
              
              startFrame = newStart;
              startInput.value = newStart;
              tempSettings.sampleStart = newStart;
              
              // Push end marker if start goes past it
              if (newStart >= endFrame) {
                let newEnd = Math.min(newStart + 10, data.length);
                if (snapToZero) {
                  newEnd = findNearestZeroCrossing(data, newEnd, 'forward');
                }
                endFrame = newEnd;
                endInput.value = newEnd;
                tempSettings.sampleEnd = newEnd;
              }
            } else if (dragging === "end") {
              let newEnd = Math.max(startFrame + 10, Math.min(frame, data.length));
              
              // Snap to zero crossing if enabled
              if (snapToZero) {
                newEnd = findNearestZeroCrossing(data, newEnd, 'both');
              }
              
              endFrame = newEnd;
              endInput.value = newEnd;
              tempSettings.sampleEnd = newEnd;
            }
            
            updateZoomWaveformAndMarkers();
            if (window.zoomPlayTimeout) clearTimeout(window.zoomPlayTimeout);
            window.zoomPlayTimeout = setTimeout(() => {
              playSampleSlice(
                sampleIndex,
                parseInt(startInput.value, 10),
                parseInt(endInput.value, 10),
                tempSettings.pan,
                tempSettings.tune,
                tempSettings.gain,
                tempSettings.isReverse
              );
            }, 80);
          } else {
            const startX = Math.floor((startFrame / data.length) * width);
            const endX = Math.floor((endFrame / data.length) * width);
            const startPos = startX / width;
            const endPos = endX / width;
            
            const tolerance = 40;
            const isNearMarker = Math.abs(x - startX) < tolerance || 
                                Math.abs(x - endX) < tolerance;
            
            newCanvas.style.cursor = isNearMarker ? "ew-resize" : "pointer";
          }
        });

        // Update mousedown handler to use zero crossing
        newCanvas.addEventListener("mousedown", function (e) {
          const rect = newCanvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const xNormalized = x / width;
          
          const startX = Math.floor((startFrame / data.length) * width);
          const endX = Math.floor((endFrame / data.length) * width);
          const startPos = startX / width;
          const endPos = endX / width;
          
          const tolerance = 40;
          const snapToZero = document.getElementById('zero-crossing-snap').checked;
          
          if (Math.abs(x - startX) < tolerance) {
            dragging = "start";
            newCanvas.style.cursor = "grabbing";
          } else if (Math.abs(x - endX) < tolerance) {
            dragging = "end";
            newCanvas.style.cursor = "grabbing";
          } else {
            const frame = Math.round(xNormalized * data.length);
            const distanceToStart = Math.abs(xNormalized - startPos);
            const distanceToEnd = Math.abs(xNormalized - endPos);
            
            if (distanceToStart < distanceToEnd) {
              let newStart = Math.max(0, Math.min(frame, data.length - 1));
              
              // Snap to zero crossing if enabled
              if (snapToZero) {
                newStart = findNearestZeroCrossing(data, newStart, 'both');
              }
              
              startFrame = newStart;
              startInput.value = newStart;
              tempSettings.sampleStart = newStart;
              
              if (newStart >= endFrame) {
                let newEnd = Math.min(newStart + 10, data.length);
                if (snapToZero) {
                  newEnd = findNearestZeroCrossing(data, newEnd, 'forward');
                }
                endFrame = newEnd;
                endInput.value = newEnd;
                tempSettings.sampleEnd = newEnd;
              }
            } else {
              let newEnd = Math.max(startFrame + 10, Math.min(frame, data.length));
              
              // Snap to zero crossing if enabled
              if (snapToZero) {
                newEnd = findNearestZeroCrossing(data, newEnd, 'both');
              }
              
              endFrame = newEnd;
              endInput.value = newEnd;
              tempSettings.sampleEnd = newEnd;
            }
            
            updateZoomWaveformAndMarkers();
            if (window.zoomPlayTimeout) clearTimeout(window.zoomPlayTimeout);
            window.zoomPlayTimeout = setTimeout(() => {
              playSampleSlice(
                sampleIndex,
                parseInt(startInput.value, 10),
                parseInt(endInput.value, 10),
                tempSettings.pan,
                tempSettings.tune,
                tempSettings.gain,
                tempSettings.isReverse
              );
            }, 80);
          }
        });

        // Add mouseup/mouseleave handlers to document to handle dragging outside canvas
        const mouseUpHandler = function () {
          if (dragging) {
          dragging = null;
            newCanvas.style.cursor = "pointer";
          }
        };

        document.addEventListener("mouseup", mouseUpHandler);
        document.addEventListener("mouseleave", mouseUpHandler);

        // Clean up event listeners when modal is hidden
        zoomModalElement.addEventListener("hidden.bs.modal", function cleanup() {
          document.removeEventListener("mouseup", mouseUpHandler);
          document.removeEventListener("mouseleave", mouseUpHandler);
          document.removeEventListener("keydown", zoomKeyHandler);
          zoomModalElement.removeEventListener("hidden.bs.modal", cleanup);
        });

        document.getElementById("zoom-play-button").onclick = () => {
          const sampleIndex = zoomModalElement.dataset.sampleIndex;
          const startFrame = parseInt(
            document.getElementById("zoom-start-point").value,
            10
          );
          const endFrame = parseInt(
            document.getElementById("zoom-end-point").value,
            10
          );

          // Use the same playSampleSlice function that the advanced modal uses
          playSampleSlice(sampleIndex, startFrame, endFrame, tempSettings.pan, tempSettings.tune, tempSettings.gain, tempSettings.isReverse);
        };

        document.getElementById("zoom-save-button").onclick = () => {
          const startFrame = document.getElementById("zoom-start-point").value;
          const endFrame = document.getElementById("zoom-end-point").value;

          // Update tempSettings
          tempSettings.sampleStart = parseInt(startFrame, 10);
          tempSettings.sampleEnd = parseInt(endFrame, 10);

          // Also update the inputs in the (currently hidden) advanced modal if it exists
          const advancedModal = document.getElementById("advanced-modal");
          if (advancedModal) {
            const startInput = advancedModal.querySelector(".adv-sample-start");
            const endInput = advancedModal.querySelector(".adv-sample-end");
            startInput.value = startFrame;
            endInput.value = endFrame;

            // Force a redraw of the waveform and markers
            const waveformDiv = advancedModal.querySelector("#waveform-container-modal");
            if (waveformDiv && waveformDiv.querySelector("canvas")) {
              const canvas = waveformDiv.querySelector("canvas");
              const ctx = canvas.getContext("2d");
              const width = canvas.width;
              const height = canvas.height;
              const buffer = drumSamples[zoomModalElement.dataset.sampleIndex].audioBuffer;
              
              // Redraw waveform and markers
              drawBuffer(width, height, ctx, buffer);
              if (typeof advancedModal.drawMarkers === "function") {
                advancedModal.drawMarkers();
              }
            }
          }

          const zoomModal = bootstrap.Modal.getInstance(zoomModalElement);
          zoomModal.hide();
        };
      });

      // Sample Editor logic
      const waveformDiv = modal.querySelector("#waveform-container-modal");
      // --- FIX: Remove any old canvases before drawing a new one ---
      while (waveformDiv.firstChild)
        waveformDiv.removeChild(waveformDiv.firstChild);
      const startInput = modal.querySelector(".adv-sample-start");
      const endInput = modal.querySelector(".adv-sample-end");
      const lengthLabel = modal.querySelector(".adv-sample-length");
      if (buffer) {
        // Draw waveform (min-max, mono only) - updated sizing logic
        const height = 60;
        const canvas = document.createElement("canvas");
        // Make the canvas fill the container horizontally
        canvas.style.width = "100%";
        // After it is in the DOM we can read the actual rendered width
        waveformDiv.appendChild(canvas);
        const width = waveformDiv.clientWidth || 300;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        drawBuffer(canvas.width, canvas.height, ctx, buffer);
        // Markers
        let startFrame = tempSettings.sampleStart;
        let endFrame = tempSettings.sampleEnd;
        if (isNaN(startFrame)) startFrame = 0;
        if (isNaN(endFrame) || endFrame <= 0) endFrame = buffer.length;
        startInput.value = startFrame;
        endInput.value = endFrame;
        lengthLabel.textContent = `/ ${buffer.length} frames`;
        // Draw marker lines
        function drawMarkers() {
          // Redraw waveform first - use canvas actual dimensions
          drawBuffer(canvas.width, canvas.height, ctx, buffer);

          // Start marker (dark grey vertical line)
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 2;
          const sx = Math.floor((startInput.value / buffer.length) * canvas.width);
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, canvas.height);
          ctx.stroke();

          // End marker (dark grey vertical line)
          const ex = Math.floor((endInput.value / buffer.length) * canvas.width);
          ctx.beginPath();
          ctx.moveTo(ex, 0);
          ctx.lineTo(ex, canvas.height);
          ctx.stroke();

          // Triangle markers at bottom (dark grey, consistent with multisample tool)
          ctx.fillStyle = "#333";
          const triangleSize = 10; // Match multisample tool size
          const bottomY = canvas.height; // No gap at bottom

          // Start marker triangle (pointing up)
          ctx.beginPath();
          ctx.moveTo(sx - triangleSize / 2, bottomY);
          ctx.lineTo(sx + triangleSize / 2, bottomY);
          ctx.lineTo(sx, bottomY - triangleSize);
          ctx.closePath();
          ctx.fill();

          // End marker triangle (pointing up)
          ctx.beginPath();
          ctx.moveTo(ex - triangleSize / 2, bottomY);
          ctx.lineTo(ex + triangleSize / 2, bottomY);
          ctx.lineTo(ex, bottomY - triangleSize);
          ctx.closePath();
          ctx.fill();
        }
        // --- expose for external calls (e.g., when returning from zoom modal) ---
        modal.drawMarkers = drawMarkers;
        drawMarkers();

        let playTimeout;
        startInput.oninput = endInput.oninput = function () {
          const MIN_DISTANCE = 10;
          function clampMarkers() {
            let s = Math.max(
              0,
              Math.min(parseInt(startInput.value, 10) || 0, buffer.length - 1)
            );
            let e = Math.max(
              s + MIN_DISTANCE,
              Math.min(
                parseInt(endInput.value, 10) || buffer.length,
                buffer.length
              )
            );
            startInput.value = s;
            endInput.value = e;
          }
          clampMarkers();
          drawMarkers();
          tempSettings.sampleStart = parseInt(startInput.value, 10);
          tempSettings.sampleEnd = parseInt(endInput.value, 10);
          if (playTimeout) clearTimeout(playTimeout);
          playTimeout = setTimeout(() => {
            modal.querySelector(".adv-play-modal").click();
          }, 80);
        };
        // --- FIXED DRAG LOGIC ---
        let draggingMarker = null;
        let dragMoveHandler = null;
        let dragUpHandler = null;

        // Add hover cursor change
        canvas.addEventListener("mousemove", function (e) {
          if (draggingMarker) return; // Don't change cursor while dragging
          
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const xNormalized = x / rect.width;  // Use rendered width, not canvas.width
          const sx = Math.floor((startInput.value / buffer.length) * canvas.width);
          const ex = Math.floor((endInput.value / buffer.length) * canvas.width);
          
          const tolerance = 0.08; // Match multisample tool tolerance (8% of width)
          const startPos = sx / canvas.width;
          const endPos = ex / canvas.width;
          
          const isNearMarker = Math.abs(xNormalized - startPos) < tolerance || 
                              Math.abs(xNormalized - endPos) < tolerance;
          
          canvas.style.cursor = isNearMarker ? "ew-resize" : "pointer";
        });

        canvas.addEventListener("mousedown", function (e) {
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const xNormalized = x / rect.width;  // Use rendered width, not canvas.width
          
          const sx = Math.floor((startInput.value / buffer.length) * canvas.width);
          const ex = Math.floor((endInput.value / buffer.length) * canvas.width);
          const startPos = sx / canvas.width;
          const endPos = ex / canvas.width;
          
          const tolerance = 0.08; // Match multisample tool tolerance
          
          // Zone-based marker selection (bottom 20% prioritizes markers)
          const bottomZone = canvas.height * 0.8;
          let candidateMarkers = [];
          
          // Check which markers are within horizontal tolerance
          if (Math.abs(xNormalized - startPos) < tolerance) {
            candidateMarkers.push({ marker: "start", distance: Math.abs(xNormalized - startPos) });
          }
          if (Math.abs(xNormalized - endPos) < tolerance) {
            candidateMarkers.push({ marker: "end", distance: Math.abs(xNormalized - endPos) });
          }
          
          if (candidateMarkers.length > 0) {
            // If in bottom zone or only one candidate, pick closest
            if (y >= bottomZone || candidateMarkers.length === 1) {
              draggingMarker = candidateMarkers.reduce((a, b) => 
                a.distance < b.distance ? a : b).marker;
            } else {
              // In top/middle zone, still pick closest
              draggingMarker = candidateMarkers.reduce((a, b) => 
                a.distance < b.distance ? a : b).marker;
            }
            canvas.style.cursor = "grabbing";
          } else {
            // Click on waveform - move nearest marker with constraints
            const distances = {
              start: Math.abs(xNormalized - startPos),
              end: Math.abs(xNormalized - endPos)
            };
            
            const nearestMarker = Object.keys(distances).reduce((a, b) =>
              distances[a] < distances[b] ? a : b
            );
            
            const newFrame = Math.round(xNormalized * buffer.length);
            
            if (nearestMarker === "start") {
              // Start marker can push end marker if needed
              const newStart = Math.max(0, Math.min(newFrame, buffer.length - 1));
              startInput.value = newStart;
              tempSettings.sampleStart = newStart;
              
              // Push end marker if start goes past it
              if (newStart >= parseInt(endInput.value, 10)) {
                const newEnd = Math.min(newStart + 10, buffer.length);
                endInput.value = newEnd;
                tempSettings.sampleEnd = newEnd;
              }
            } else {
              // End marker cannot move past start
              const newEnd = Math.max(
                parseInt(startInput.value, 10) + 10,
                Math.min(newFrame, buffer.length)
              );
              endInput.value = newEnd;
              tempSettings.sampleEnd = newEnd;
            }
            
            drawMarkers();
            if (playTimeout) clearTimeout(playTimeout);
            playTimeout = setTimeout(
              () => modal.querySelector(".adv-play-modal").click(),
              80
            );
            return;
          }
          // Attach move and up listeners only when dragging
          dragMoveHandler = function (e) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const frame = Math.round((x / rect.width) * buffer.length);  // Use rendered width

            if (draggingMarker === "start") {
              const newStart = Math.max(0, Math.min(frame, buffer.length - 1));
              startInput.value = newStart;
              tempSettings.sampleStart = newStart;
              
              // Push end marker if start goes past it
              if (newStart >= parseInt(endInput.value, 10)) {
                const newEnd = Math.min(newStart + 10, buffer.length);
                endInput.value = newEnd;
                tempSettings.sampleEnd = newEnd;
              }
            } else if (draggingMarker === "end") {
              const newEnd = Math.max(
                parseInt(startInput.value, 10) + 10,
                Math.min(frame, buffer.length)
              );
              endInput.value = newEnd;
              tempSettings.sampleEnd = newEnd;
            }
            drawMarkers();
            if (playTimeout) clearTimeout(playTimeout);
            playTimeout = setTimeout(
              () => modal.querySelector(".adv-play-modal").click(),
              80
            );
          };
          dragUpHandler = function () {
            draggingMarker = null;
            canvas.style.cursor = "pointer";
            window.removeEventListener("mousemove", dragMoveHandler);
            window.removeEventListener("mouseup", dragUpHandler);
          };
          window.addEventListener("mousemove", dragMoveHandler);
          window.addEventListener("mouseup", dragUpHandler);
        });
      } else {
        waveformDiv.innerHTML =
          '<div class="text-muted small">no sample loaded</div>';
        startInput.value = 0;
        endInput.value = 0;
        lengthLabel.textContent = "";
      }

      // === FIX: Attach play button handler here, in correct scope ===
      modal.querySelector(".adv-play-modal").onclick = () => {
        if (!buffer) return;
        const ctx = getAudioContext();
        const src = ctx.createBufferSource();
        let playBuffer = buffer;

        // Get modal settings from tempSettings
        let sampleStart = tempSettings.sampleStart;
        let sampleEnd = tempSettings.sampleEnd;

        sampleStart = Math.max(0, Math.min(sampleStart, buffer.length - 1));
        sampleEnd = Math.max(
          sampleStart + 1,
          Math.min(sampleEnd, buffer.length)
        );

        if (sampleStart !== 0 || sampleEnd !== buffer.length) {
          const selectionLength = sampleEnd - sampleStart;
          const selectionBuffer = ctx.createBuffer(
            buffer.numberOfChannels,
            selectionLength,
            buffer.sampleRate
          );
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const srcData = buffer.getChannelData(ch);
            const dstData = selectionBuffer.getChannelData(ch);
            for (let j = 0; j < selectionLength; j++) {
              dstData[j] = srcData[sampleStart + j];
            }
          }
          playBuffer = selectionBuffer;
        }

        // Reverse
        if (tempSettings.isReverse) {
          const revBuffer = ctx.createBuffer(
            playBuffer.numberOfChannels,
            playBuffer.length,
            playBuffer.sampleRate
          );
          for (let ch = 0; ch < playBuffer.numberOfChannels; ch++) {
            const srcData = playBuffer.getChannelData(ch);
            const dstData = revBuffer.getChannelData(ch);
            for (
              let j = 0, k = srcData.length - 1;
              j < srcData.length;
              j++, k--
            ) {
              dstData[j] = srcData[k];
            }
          }
          playBuffer = revBuffer;
        }

        // Tuning
        src.buffer = playBuffer;
        src.playbackRate.value = Math.pow(2, tempSettings.tune / 12);

        // Panning
        const panNode = ctx.createStereoPanner();
        panNode.pan.value = Math.max(-1, Math.min(1, tempSettings.pan / 100));

        // Gain (dB to linear)
        let gainValue = Number(tempSettings.gain);
        if (isNaN(gainValue)) gainValue = 0;
        gainValue = Math.max(-30, Math.min(20, gainValue));
        const gainNode = ctx.createGain();
        gainNode.gain.value = Math.pow(10, gainValue / 20);

        src.connect(panNode).connect(gainNode).connect(ctx.destination);
        src.start(0);
      };

      
    });
  }
}

// Use the already-declared drumKeyMap and currentOctave for keyboard trigger logic
function getDrumIdxForKey(key) {
  const mapping = drumKeyMap[currentOctave][key];
  return mapping ? mapping.idx : null;
}

document.addEventListener("keydown", (e) => {
  if (document.getElementById("drum-tab").classList.contains("active")) {
    // Check if user is typing in an input field, textarea, or contenteditable element
    const activeElement = document.activeElement;
    const isTyping = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true' ||
      activeElement.isContentEditable
    );
    
    // Don't trigger sample playback if user is typing
    if (isTyping) {
      return;
    }
    
    const key = e.key.toUpperCase();
    let octaveSwitched = false;
    if (key === "Z") {
      currentOctave = 0;
      updateKeyboardLabels();
      octaveSwitched = true;
    }
    if (key === "X") {
      currentOctave = 1;
      updateKeyboardLabels();
      octaveSwitched = true;
    }
    if (!octaveSwitched) {
      const idx = getDrumIdxForKey(key);
      if (idx && drumSamples[idx]) {
        playSample(idx);
      }
      const keyEl = Array.from(document.querySelectorAll("#drum .kbd")).find(
        (k) => k.textContent.trim().toUpperCase() === key
      );
      if (keyEl) keyEl.classList.add("kbd-pressed");
    }
  }
});
document.addEventListener("keyup", (e) => {
  if (document.getElementById("drum-tab").classList.contains("active")) {
    // Check if user is typing in an input field, textarea, or contenteditable element
    const activeElement = document.activeElement;
    const isTyping = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true' ||
      activeElement.isContentEditable
    );
    
    // Don't trigger visual feedback if user is typing
    if (isTyping) {
      return;
    }
    
    const key = e.key.toUpperCase();
    const keyEl = Array.from(document.querySelectorAll("#drum .kbd")).find(
      (k) => k.textContent.trim().toUpperCase() === key
    );
    if (keyEl) keyEl.classList.remove("kbd-pressed");
  }
});

// Helper: Sanitize filename for OP-XY compatibility
function sanitizeName(name) {
  // Remove file extension
  name = name.replace(/\.[^/.]+$/, "");
  // Replace spaces and special chars with underscores
  name = name.replace(/[^a-zA-Z0-9]/g, "_");
  // Ensure it starts with a letter
  if (!/^[a-zA-Z]/.test(name)) name = "s_" + name;
  // Truncate to reasonable length
  name = name.substring(0, 30);
  // Add .wav extension
  return name + ".wav";
}

// === Drum Patch Generation (Generate Patch Button) ===
const drumGenerateBtn = Array.from(
  document.querySelectorAll("#drum .accent-btn")
).find((btn) => btn.textContent.toLowerCase().includes("generate patch"));
if (drumGenerateBtn) {
  // Wait for JSZip to be loaded before enabling the button
  function enableGenerateBtnWhenReady() {
    jsZipLoadPromise.then(() => {
    if (typeof JSZip !== "undefined") {
      // Don't directly enable - let updateGeneratePatchBtnState handle the enable/disable logic
      updateGeneratePatchBtnState();
      drumGenerateBtn.title = "";
    } else {
      drumGenerateBtn.disabled = true;
      drumGenerateBtn.title = "Loading JSZip...";
      setTimeout(enableGenerateBtnWhenReady, 200);
    }
    }).catch(() => {
      drumGenerateBtn.disabled = true;
      drumGenerateBtn.title = "Failed to load JSZip";
    });
  }
  enableGenerateBtnWhenReady();

  drumGenerateBtn.addEventListener("click", async () => {
    try {
      await jsZipLoadPromise;
    if (typeof JSZip === "undefined") {
      alert("JSZip library not loaded. Please wait and try again.");
      return;
    }
    if (typeof baseDrumJson === "undefined") {
      alert("baseDrumJson is missing. Patch generation cannot continue.");
      return;
    }
    drumGenerateBtn.disabled = true;
    drumGenerateBtn.textContent = "Generating...";
      const presetName =
        document.getElementById("preset-name-drum").value || "Drums";
      const sampleRateIdx =
        document.getElementById("sample-rate-drum").selectedIndex;
      const targetSampleRate = [null, 11025, 22050, 44100][sampleRateIdx];
      const targetBitDepth = document.getElementById("bit-depth-drum").value;
      const targetChannels = document.getElementById("channels-drum").value;
      
      const zip = new JSZip();
      // Deep copy baseDrumJson
      const patchJson = JSON.parse(JSON.stringify(baseDrumJson));
      patchJson.name = presetName;
      patchJson.regions = [];

      // If user imported a preset json earlier, deep-merge its settings (except regions/name)
      if (window.importedPresetJsonDrum) {
        const imported = window.importedPresetJsonDrum;
        const sections = ["engine", "envelope", "fx", "lfo", "octave"];
        sections.forEach((sec) => {
          if (imported[sec]) {
            if (!patchJson[sec]) patchJson[sec] = {};
            deepMerge(patchJson[sec], imported[sec]);
          }
        });
      }

      // If advanced preset settings exist, update engine section
      if (window.advancedPresetSettings) {
        const adv = window.advancedPresetSettings;
        if (patchJson.engine) {
          if (adv.playmode) patchJson.engine.playmode = adv.playmode;
          if (!isNaN(adv.transpose)) patchJson.engine.transpose = adv.transpose;
          if (!isNaN(adv.velocity))
            patchJson.engine["velocity.sensitivity"] = Math.round((adv.velocity / 100) * 32767);
          if (!isNaN(adv.volume)) patchJson.engine.volume = Math.round((adv.volume / 100) * 32767);
          if (!isNaN(adv.width)) patchJson.engine.width = Math.round((adv.width / 100) * 32767);
        }
      }
      const fileReadPromises = [];
      let midiNoteCounter = 53;
      for (let i = 1; i <= NUM_DRUMS; i++) {
        if (drumSamples[i]) {
          const fileInput = document.getElementById(`sample-${i}`);
          let file = fileInput && fileInput.files && fileInput.files[0];
          
          // If file input is empty (e.g. after drag-and-drop), create WAV from buffer
          if (!file && drumSampleNames[i]) {
            const buffer = drumSamples[i];
            
            // Apply mono conversion if needed
            let processedBuffer = buffer.audioBuffer;
            if (targetChannels === "mono" && processedBuffer.numberOfChannels > 1) {
              const ctx = new OfflineAudioContext(1, processedBuffer.length, processedBuffer.sampleRate);
              const monoBuffer = ctx.createBuffer(1, processedBuffer.length, processedBuffer.sampleRate);
              const monoData = monoBuffer.getChannelData(0);
              
              // Mix down to mono
              for (let i = 0; i < processedBuffer.length; i++) {
                let sum = 0;
                for (let ch = 0; ch < processedBuffer.numberOfChannels; ch++) {
                  sum += processedBuffer.getChannelData(ch)[i];
                }
                monoData[i] = sum / processedBuffer.numberOfChannels;
              }
              processedBuffer = monoBuffer;
            }
            
            const wavBlob = bufferToWavBlob(processedBuffer);
            file = new File([wavBlob], drumSampleNames[i], {
              type: "audio/wav",
            });
          }
          
          if (file) {
            let outputName = sanitizeName(file.name);
            let sampleRate = drumSamples[i].sampleRate || 44100;
            let duration =
              drumSamples[i].duration ||
              drumSamples[i].length / drumSamples[i].sampleRate;
            const advancedBtn = document.querySelector(
              `.advanced-btn[data-sample-idx='${i}']`
            );
            const playmode = advancedBtn
              ? advancedBtn.dataset.playmode || "oneshot"
              : "oneshot";
            const reverse =
              advancedBtn && advancedBtn.dataset.reverse === "true";
            let tune = 0;
            if (advancedBtn && advancedBtn.dataset.tune) {
              tune = parseInt(advancedBtn.dataset.tune, 10) || 0;
            }
            let pan = 0;
            if (advancedBtn && advancedBtn.dataset.pan) {
              pan = parseInt(advancedBtn.dataset.pan, 10) || 0;
            }
            
            // Build region object in correct OP-XY format
            const midiNote = midiNoteCounter++;
            const region = {
              "fade.in": 0,
              "fade.out": 0,
              framecount: Math.floor(
                duration * (targetSampleRate || sampleRate)
              ),
              hikey: midiNote,
              lokey: midiNote,
              pan: pan,
              "pitch.keycenter": 60,
              playmode: playmode,
              reverse: reverse,
              sample: outputName,
              transpose: 0,
              tune: tune,
            };
            if (advancedBtn && advancedBtn.dataset.sampleStart)
              region["sample.start"] =
                parseInt(advancedBtn.dataset.sampleStart, 10) || 0;
            if (advancedBtn && advancedBtn.dataset.sampleEnd)
              region["sample.end"] =
                parseInt(advancedBtn.dataset.sampleEnd, 10) || 0;
                
            // Handle all conversions together
            if ((targetSampleRate && sampleRate !== targetSampleRate) || 
                (targetChannels === "mono" && drumSamples[i].audioBuffer.numberOfChannels > 1)) {
              fileReadPromises.push(
                (async () => {
                  let processedBuffer = drumSamples[i].audioBuffer;
                  
                  // Apply mono conversion if needed
                  if (targetChannels === "mono" && processedBuffer.numberOfChannels > 1) {
                    const ctx = new OfflineAudioContext(1, processedBuffer.length, processedBuffer.sampleRate);
                    const monoBuffer = ctx.createBuffer(1, processedBuffer.length, processedBuffer.sampleRate);
                    const monoData = monoBuffer.getChannelData(0);
                    
                    // Mix down to mono
                    for (let i = 0; i < processedBuffer.length; i++) {
                      let sum = 0;
                      for (let ch = 0; ch < processedBuffer.numberOfChannels; ch++) {
                        sum += processedBuffer.getChannelData(ch)[i];
                      }
                      monoData[i] = sum / processedBuffer.numberOfChannels;
                    }
                    processedBuffer = monoBuffer;
                  }
                  
                  // Apply sample rate conversion if needed
                  if (targetSampleRate && processedBuffer.sampleRate !== targetSampleRate) {
                    const wavBlob = await resampleAudio(
                      new File([bufferToWavBlob(processedBuffer)], "temp.wav", { type: "audio/wav" }),
                      targetSampleRate
                    );
                  zip.file(outputName, wavBlob);
                  } else {
                    zip.file(outputName, bufferToWavBlob(processedBuffer));
                  }
                  patchJson.regions.push(region);
                })()
              );
            } else {
              fileReadPromises.push(
                new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    zip.file(outputName, e.target.result);
                    patchJson.regions.push(region);
                    resolve();
                  };
                  reader.onerror = (err) => reject(err);
                  reader.readAsArrayBuffer(file);
                })
              );
            }
          }
        }
      }
      await Promise.all(fileReadPromises);
      zip.file("patch.json", JSON.stringify(patchJson, null, 2));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presetName}.preset.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 100);
    } catch (err) {
      alert(
        "Patch generation failed: " + (err && err.message ? err.message : err)
      );
    } finally {
      drumGenerateBtn.disabled = false;
      drumGenerateBtn.textContent = "generate patch";
    }
  });
}

// Helper: Convert AudioBuffer to WAV Blob
function bufferToWavBlob(buffer) {
  // Only supports mono or stereo
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const numFrames = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = numFrames * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate = SampleRate * NumChannels * BitsPerSample/8
  view.setUint16(32, blockAlign, true); // BlockAlign = NumChannels * BitsPerSample/8
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Write interleaved audio data
  let offset = 44;
  const channelData = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData[ch] = buffer.getChannelData(ch);
  }

  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i];
      // Clamp samples to [-1, 1]
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit PCM
      const pcmValue = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, pcmValue, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/x-wav" });
}

function drawBuffer(width, height, context, buffer) {
  // Handle the new buffer structure
  const audioBuffer = buffer.audioBuffer || buffer;
  const data = audioBuffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const amp = height / 2;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ececec";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#333";
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    for (let j = 0; j < step; j++) {
      const datum = data[i * step + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    context.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
  }
  
  // Draw center line
  context.strokeStyle = "#333";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
}

// ---- Unified Bootstrap alert (monochrome) ----
function ensureAlertCSS() {
  if (document.getElementById('mono-alert-css')) return;
  const style = document.createElement('style');
  style.id = 'mono-alert-css';
  style.textContent = `
    .mono-alert-container{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:1060;width:100%;max-width:540px;padding:0 12px;pointer-events:none;}
    .mono-alert-container .alert{pointer-events:auto;border:1px solid #222;background:#fff;color:#222;font-family:inherit}
  `;
  document.head.appendChild(style);
}

function showBootstrapMonoAlert(message, variant='info', autoDismiss=4000){
  ensureAlertCSS();
  let container=document.querySelector('.mono-alert-container');
  if(!container){
    container=document.createElement('div');
    container.className='mono-alert-container';
    document.body.appendChild(container);
  }

  const div=document.createElement('div');
  const alertClass= variant==='error'? 'alert-danger' : 'alert-dark';
  div.className=`alert ${alertClass} alert-dismissible fade show`; 
  div.role='alert';
  div.innerHTML=`${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
  container.appendChild(div);

  const bsAlert=new bootstrap.Alert(div);
  if(autoDismiss){
    setTimeout(()=>{ bsAlert.close();}, autoDismiss);
  }
}

function showImportSuccess(msg){showBootstrapMonoAlert(msg,'info',3000);} 
function showImportError(msg){showBootstrapMonoAlert(msg,'error',null);}

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

// === GLOBAL MODAL CLEAN-UP ===
// Ensure body scrolling is restored when all Bootstrap modals are closed.
document.addEventListener('hidden.bs.modal', () => {
  const anyOpen = document.querySelector('.modal.show');
  if (!anyOpen) {
    document.body.classList.remove('modal-open');
    // In case Bootstrap left inline padding or overflow styles
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
});

const drumRecordingContext = { targetIndex: null };
function openRecordingModalForDrum(sampleIndex){
  drumRecordingContext.targetIndex = sampleIndex;
  if (typeof openRecordingModal === 'function') {
    openRecordingModal();
  } else {
    // fallback: open the modal directly if multisample script hasn't loaded yet
    const m = new bootstrap.Modal(document.getElementById('audio-recording-modal'));
    resetRecordingModal && resetRecordingModal();
    m.show();
  }
  // Attach one-off save handler specific to drum slot
  const saveBtn = document.getElementById('save-recording-btn');
  const handler = async () => {
    if (!audioRecording || !audioRecording.recordedBuffer) return;
    const buffer = audioRecording.recordedBuffer;
    const filename = document.getElementById('recorded-sample-name').value.trim() || 'mic-sample';
    // Save into drumSamples
    drumSamples[sampleIndex] = {
      audioBuffer: buffer,
      fileName: filename,
      filename: filename, // Maintain both variants for compatibility
      duration: buffer.duration,
      fileSize: buffer.length * buffer.numberOfChannels * 2, // Approx size for 16-bit PCM
      // Use property names expected by updateSampleUI
      originalBitDepth: 16,
      originalSampleRate: buffer.sampleRate,
      originalChannels: buffer.numberOfChannels,
      convertedSizes: {} // Initialize conversion size cache
    };
    updateSampleUI(sampleIndex);
    
    // Refresh generate button and patch size
    updateGeneratePatchBtnState && updateGeneratePatchBtnState();
    if (typeof updateDrumPatchSize === 'function') {
      updateDrumPatchSize().catch(err => console.warn('Patch size update failed:', err));
    }
    if (typeof updateDrumPatchSummary === 'function') {
      updateDrumPatchSummary();
    }
    
    // Enable the sample buttons
    const playBtn = document.getElementById(`play-${sampleIndex}`);
    const clearBtn = document.getElementById(`clear-${sampleIndex}`);
    const advBtn = document.getElementById(`adv-${sampleIndex}`);
    if (playBtn) playBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
    if (advBtn) advBtn.disabled = false;
    
    // Close modal
    const modalInst = bootstrap.Modal.getInstance(document.getElementById('audio-recording-modal'));
    modalInst && modalInst.hide();
    // clean listener
    saveBtn.removeEventListener('click', handler);
  };
  // Ensure previous handler removed first to prevent multiple adds
  saveBtn.addEventListener('click', handler, { once: true });
}
// Expose globally
window.openRecordingModalForDrum = openRecordingModalForDrum;

// --- Responsive waveform canvas resize ---
 window.addEventListener("resize", function () {
   // Modal waveform
   const modal = document.getElementById("advanced-modal");
   if (modal && modal.classList.contains("show")) {
     const waveformDiv = modal.querySelector("#waveform-container-modal");
     const canvas = waveformDiv && waveformDiv.querySelector("canvas");
     const buffer =
       window.drumSamples && window.drumSamples[modal.dataset.sampleIndex];
     if (canvas && waveformDiv && buffer) {
       // Set canvas width to container's clientWidth for accuracy
       const width = waveformDiv.clientWidth || 300;
       const height = canvas.offsetHeight || 60;
       canvas.style.width = "100%";
       canvas.width = width;
       canvas.height = height;
       const ctx = canvas.getContext("2d");
       drawBuffer(width, height, ctx, buffer);
       // Redraw markers if needed
       if (typeof window.drawMarkers === "function") window.drawMarkers();
     }
   }
 });

function updateChannelsDropdown() {
  const channelsSelect = document.getElementById('channels-drum');
  if (!channelsSelect) return;

  // Check if any samples are loaded and if they're all mono
  let hasLoadedSamples = false;
  let allMono = true;
  
  for (let i = 1; i <= NUM_DRUMS; i++) {
    if (drumSamples[i] && drumSamples[i].audioBuffer) {
      hasLoadedSamples = true;
      if (drumSamples[i].audioBuffer.numberOfChannels > 1) {
        allMono = false;
        break;
      }
    }
  }

  // If we have samples and they're all mono, disable the mono conversion option
  const monoOption = channelsSelect.querySelector('option[value="mono"]');
  if (monoOption) {
    monoOption.disabled = hasLoadedSamples && allMono;
    if (hasLoadedSamples && allMono) {
      channelsSelect.value = 'keep';
    }
  }
}

// Add this function near the top with other utility functions
function updateBulkActionButtons() {
  const hasLoadedSamples = drumSamples.some(sample => sample !== null);
  document.getElementById('drum-bulk-edit-btn').disabled = !hasLoadedSamples;
  document.getElementById('drum-clear-all-btn').disabled = !hasLoadedSamples;
}

// Helper function to find nearest zero crossing
function findNearestZeroCrossing(data, frame, direction = 'both', maxDistance = 1000) {
  // Don't process if frame is out of bounds
  if (frame < 0 || frame >= data.length) return frame;
  
  let forward = frame;
  let backward = frame;
  
  // Only search forward
  if (direction === 'forward') {
    for (let i = 0; i < maxDistance && forward < data.length - 1; i++) {
      if (data[forward] * data[forward + 1] <= 0) return forward;
      forward++;
    }
    return frame;
  }
  
  // Only search backward
  if (direction === 'backward') {
    for (let i = 0; i < maxDistance && backward > 0; i++) {
      if (data[backward - 1] * data[backward] <= 0) return backward;
      backward--;
    }
    return frame;
  }
  
  // Search both directions
  for (let i = 0; i < maxDistance; i++) {
    // Check forward
    if (forward < data.length - 1) {
      if (data[forward] * data[forward + 1] <= 0) return forward;
      forward++;
    }
    
    // Check backward
    if (backward > 0) {
      if (data[backward - 1] * data[backward] <= 0) return backward;
      backward--;
    }
    
    // Stop if we've reached both ends
    if (forward >= data.length - 1 && backward <= 0) break;
  }
  
  return frame;
}

function updateDropdownOptions() {
  const bitDepthSelect = document.getElementById('bit-depth-drum');
  const sampleRateSelect = document.getElementById('sample-rate-drum');
  const channelsSelect = document.getElementById('channels-drum');
  
  // Find the highest quality among all loaded samples
  let maxBitDepth = 0;
  let maxSampleRate = 0;
  let hasAnyStereo = false;
  let allSameBitDepth = true;
  let allSameSampleRate = true;
  let firstBitDepth = null;
  let firstSampleRate = null;
  
  // Check all loaded samples
  for (const s of drumSamples) {
    if (s) {
      maxBitDepth = Math.max(maxBitDepth, s.originalBitDepth);
      maxSampleRate = Math.max(maxSampleRate, s.originalSampleRate);
      if (s.originalChannels > 1) hasAnyStereo = true;
      
      // Check if all samples have the same bit depth
      if (firstBitDepth === null) {
        firstBitDepth = s.originalBitDepth;
      } else if (s.originalBitDepth !== firstBitDepth) {
        allSameBitDepth = false;
      }
      
      // Check if all samples have the same sample rate
      if (firstSampleRate === null) {
        firstSampleRate = s.originalSampleRate;
      } else if (s.originalSampleRate !== firstSampleRate) {
        allSameSampleRate = false;
      }
    }
  }
  
  // Update dropdown options based on highest quality found
  if (bitDepthSelect) {
    // Enable all options first
    Array.from(bitDepthSelect.options).forEach(option => {
      option.disabled = false;
    });
    
    // Disable 24-bit if ALL samples are 16-bit or lower
    if (maxBitDepth <= 16) {
      Array.from(bitDepthSelect.options).forEach(option => {
        if (option.value === "24") {
          option.disabled = true;
        }
      });
      // If currently selected option is disabled, switch to "keep original"
      if (bitDepthSelect.value === "24") {
        bitDepthSelect.value = "keep";
      }
    }
    
    // If all samples are the same bit depth, disable that conversion option
    if (allSameBitDepth && firstBitDepth) {
      Array.from(bitDepthSelect.options).forEach(option => {
        if (option.value === firstBitDepth.toString()) {
          option.disabled = true;
        }
      });
      // If currently selected option is disabled, switch to "keep original"
      if (bitDepthSelect.value === firstBitDepth.toString()) {
        bitDepthSelect.value = "keep";
      }
    }
  }
  
  if (sampleRateSelect) {
    // Enable all options first
    Array.from(sampleRateSelect.options).forEach(option => {
      option.disabled = false;
    });
    
    // Get the numerical sample rate for comparison
    const rateMap = {
      "1": 11025,
      "2": 22050,
      "3": 44100
    };
    
    // Create reverse mapping for sample rates to option values
    const reverseRateMap = {};
    Object.entries(rateMap).forEach(([key, value]) => {
      reverseRateMap[value] = key;
    });
    
    // Disable options that would upsample ALL samples
    Array.from(sampleRateSelect.options).forEach(option => {
      if (option.value !== "0" && rateMap[option.value] > maxSampleRate) {
        option.disabled = true;
      }
    });
    
    // If all samples are the same sample rate, disable that conversion option
    if (allSameSampleRate && firstSampleRate) {
      const matchingOption = reverseRateMap[firstSampleRate];
      if (matchingOption) {
        Array.from(sampleRateSelect.options).forEach(option => {
          if (option.value === matchingOption) {
            option.disabled = true;
          }
        });
        // If currently selected option is disabled, switch to "keep original"
        if (sampleRateSelect.value === matchingOption) {
          sampleRateSelect.value = "0";
        }
      }
    }
    
    // If currently selected option is disabled, switch to "keep original"
    if (sampleRateSelect.selectedOptions[0].disabled) {
      sampleRateSelect.value = "0";
    }
  }

  if (channelsSelect) {
    // Enable all options first
    Array.from(channelsSelect.options).forEach(option => {
      option.disabled = false;
    });

    // If all samples are mono, disable mono conversion
    if (!hasAnyStereo) {
      Array.from(channelsSelect.options).forEach(option => {
        if (option.value === "mono") {
          option.disabled = true;
        }
      });
      // If currently selected option is disabled, switch to "keep original"
      if (channelsSelect.value === "mono") {
        channelsSelect.value = "keep";
      }
    }
  }
}

