var HEADER_LENGTH = 44;
var MAX_AMPLITUDE = 0x7fff;

async function resampleAudio(file, targetSampleRate) {
  const audioContext = new AudioContext();

  try {
    // Read the file as an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Create an OfflineAudioContext with the target sample rate
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    // Create a buffer source and connect it to the offline context
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);

    // Start playback in the offline context
    const duration =
      Math.ceil(audioBuffer.duration * targetSampleRate) / targetSampleRate;
    bufferSource.start(0, 0, duration);

    // Render the audio
    const renderedBuffer = await offlineContext.startRendering();

    // Convert the rendered buffer to a WAV file and return it
    return audioBufferToWav(renderedBuffer);
  } catch (error) {
    console.error("Error during audio resampling:", error);
    throw error; // Propagate the error for handling outside the function
  }
}

// Function to convert AudioBuffer to WAV format
function audioBufferToWav(audioBuffer) {
  const nChannels = audioBuffer.numberOfChannels;
  if (nChannels !== 1 && nChannels !== 2) {
    throw new Error("Expecting mono or stereo audioBuffer");
  }

  const bufferLength = audioBuffer.length;
  const arrayBuffer = new ArrayBuffer(
    HEADER_LENGTH + 2 * bufferLength * nChannels
  );
  const int16 = new Int16Array(arrayBuffer);
  const uint8 = new Uint8Array(arrayBuffer);

  const sr = audioBuffer.sampleRate;
  const l2 = bufferLength * nChannels * 2; // subchunk2 = numSamples * numChannels * BitsPerSample / 8
  const l1 = l2 + 36; // chunkSize = subchunk + 36
  const br = sr * nChannels * 2; // bitrate = SampleRate * NumChannels * BitsPerSample / 8

  uint8.set([
    0x52,
    0x49,
    0x46,
    0x46, // R I F F
    l1 & 255,
    (l1 >> 8) & 255,
    (l1 >> 16) & 255,
    (l1 >> 24) & 255, // chunk size
    0x57,
    0x41,
    0x56,
    0x45, // W A V E
    0x66,
    0x6d,
    0x74,
    0x20, // F T M █
    0x10,
    0x00,
    0x00,
    0x00, // sub chunk size = 16
    0x01,
    0x00, // audio format = 1 (PCM, linear quantization)
    nChannels,
    0x00, // number of channels
    sr & 255,
    (sr >> 8) & 255,
    (sr >> 16) & 255,
    (sr >> 24) & 255, // sample rate
    br & 255,
    (br >> 8) & 255,
    (br >> 16) & 255,
    (br >> 24) & 255, // byte rate
    0x04,
    0x00, // block align = 4
    0x10,
    0x00, // bit per sample = 16
    0x64,
    0x61,
    0x74,
    0x61, // d a t a
    l2 & 255,
    (l2 >> 8) & 255,
    (l2 >> 16) & 255,
    (l2 >> 24) & 255, // sub chunk 2 size
  ]);

  const buffers = [];
  for (let channel = 0; channel < nChannels; channel++) {
    buffers.push(audioBuffer.getChannelData(channel));
  }

  for (let i = 0, index = HEADER_LENGTH / 2; i < bufferLength; i++) {
    for (let channel = 0; channel < nChannels; channel++) {
      let sample = buffers[channel][i];
      sample = Math.min(1, Math.max(-1, sample));
      sample = Math.round(sample * MAX_AMPLITUDE);

      int16[index++] = sample;
    }
  }

  return new Blob([uint8], { type: "audio/x-wav" });
}

// Sanitize a string to allow only valid characters for filenames and folder names
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9 #\-().]+/g, "");
}

// Parse the filename to extract the base name and key
function parseFilename(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  // Match: everything up to last space/dash, then note or number at end
  const match = nameWithoutExt.match(/(.+?)[\s\-]*([A-G](?:b|#)?\d|\d{1,3})$/i);
  if (!match) {
    throw new Error(
      `Filename '${filename}' does not match the expected pattern.`
    );
  }
  const baseName = sanitizeName(match[1]);
  const noteOrNumber = match[2];
  // Try to parse as note first
  if (/^[A-G](?:b|#)?\d$/i.test(noteOrNumber)) {
    return [baseName, noteStringToMidiValue(noteOrNumber)];
  }
  // Otherwise, treat as number
  return [baseName, parseInt(noteOrNumber, 10)];
}

const NOTE_OFFSET = [33, 35, 24, 26, 28, 29, 31];
const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

// Convert MIDI note value to note string
function midiNoteToString(value) {
  const octave = Math.floor(value / 12);
  const noteNumber = value % 12;
  return `${NOTE_NAMES[noteNumber]}${octave - 2}`;
}

// Convert note string to MIDI value
function noteStringToMidiValue(note) {
  const string = note.replace(" ", "");
  if (string.length < 2) {
    throw new Error("Bad note format");
  }

  const noteIdx = string[0].toUpperCase().charCodeAt(0) - 65;
  if (noteIdx < 0 || noteIdx > 6) {
    throw new Error("Bad note");
  }

  let sharpen = 0;
  if (string[1] === "#") {
    sharpen = 1;
  } else if (string[1].toLowerCase() === "b") {
    sharpen = -1;
  }
  return (
    parseInt(string.slice(1 + Math.abs(sharpen)), 10) * 12 +
    NOTE_OFFSET[noteIdx] +
    sharpen
  );
}

const baseMultisampleJson = {
  engine: {
    bendrange: 13653,
    highpass: 0,
    modulation: {
      aftertouch: {
        amount: 0,
        target: 0,
      },
      modwheel: {
        amount: 0,
        target: 0,
      },
      pitchbend: {
        amount: 0,
        target: 0,
      },
      velocity: {
        amount: 0,
        target: 0,
      },
    },
    params: [16384, 16384, 16384, 16384, 16384, 16384, 16384, 16384],
    playmode: "poly",
    "portamento.amount": 0,
    "portamento.type": 32767,
    transpose: 0,
    "tuning.root": 0,
    "tuning.scale": 0,
    "velocity.sensitivity": 10240,
    volume: 16466,
    width: 0,
  },
  envelope: {
    amp: {
      attack: 0,
      decay: 0,
      release: 0,
      sustain: 0,
    },
    filter: {
      attack: 0,
      decay: 0,
      release: 0,
      sustain: 0,
    },
  },
  fx: {
    active: false,
    params: [0, 0, 0, 0, 0, 0, 0, 0],
    type: "svf",
  },
  lfo: {
    active: false,
    params: [0, 0, 0, 0, 0, 0, 0, 0],
    type: "element",
  },
  octave: 0,
  platform: "OP-XY",
  regions: [],
  type: "multisampler",
  version: 4,
};

const baseDrumJson = {
  engine: {
    bendrange: 8191,
    highpass: 0,
    modulation: {
      aftertouch: { amount: 16383, target: 0 },
      modwheel: { amount: 16383, target: 0 },
      pitchbend: { amount: 16383, target: 0 },
      velocity: { amount: 16383, target: 0 },
    },
    params: Array(8).fill(16384),
    playmode: "poly",
    "portamento.amount": 0,
    "portamento.type": 32767,
    transpose: 0,
    "tuning.root": 0,
    "tuning.scale": 0,
    "velocity.sensitivity": 19660,
    volume: 18348,
    width: 0,
  },
  envelope: {
    amp: { attack: 0, decay: 0, release: 1000, sustain: 32767 },
    filter: { attack: 0, decay: 3276, release: 23757, sustain: 983 },
  },
  fx: {
    active: false,
    params: [22014, 0, 30285, 11880, 0, 32767, 0, 0],
    type: "ladder",
  },
  lfo: {
    active: false,
    params: [20309, 5679, 19114, 15807, 0, 0, 0, 12287],
    type: "random",
  },
  octave: 0,
  platform: "OP-XY",
  regions: [],
  type: "drum",
  version: 4,
};

// WAV metadata reading functionality
// Parse WAV SMPL chunk to extract MIDI root note and loop points
async function readWavMetadata(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const dataView = new DataView(arrayBuffer);

        // -------------------------------------------------------------
        // 1. Parse RIFF chunks to obtain reliable header information
        // -------------------------------------------------------------
        let fmtChunkOffset = -1;
        let fmtChunkSize = 0;
        let smplChunkOffset = -1;
        let smplChunkSize = 0;

        let offset = 12; // Skip the RIFF header (4 bytes "RIFF", 4 bytes size, 4 bytes "WAVE")
        while (offset < arrayBuffer.byteLength - 8) {
          const chunkId = String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
          );
          const chunkSize = dataView.getUint32(offset + 4, true);

          if (chunkId === "fmt ") {
            fmtChunkOffset = offset + 8; // Start of the fmt chunk payload
            fmtChunkSize = chunkSize;
          } else if (chunkId === "smpl") {
            smplChunkOffset = offset + 8;
            smplChunkSize = chunkSize;
          }

          // Move to next chunk (account for padding to even boundary)
          offset += 8 + chunkSize + (chunkSize % 2);
        }

        if (fmtChunkOffset === -1) {
          throw new Error("WAV file is missing fmt chunk");
        }

        // Extract key information from fmt chunk
        const audioFormat = dataView.getUint16(fmtChunkOffset + 0, true);
        const numChannels = dataView.getUint16(fmtChunkOffset + 2, true);
        const sampleRateHeader = dataView.getUint32(fmtChunkOffset + 4, true);
        const bitsPerSample = dataView.getUint16(fmtChunkOffset + 14, true);

        // -------------------------------------------------------------
        // 2. Decode the audio data using Web Audio API (may resample)
        // -------------------------------------------------------------
        const tmpCtx = new AudioContext();
        let decodedBuffer = await tmpCtx.decodeAudioData(arrayBuffer.slice());

        // If the decoded buffer was resampled by the browser, resample it back
        if (decodedBuffer.sampleRate !== sampleRateHeader) {
          decodedBuffer = await resampleAudioBuffer(decodedBuffer, sampleRateHeader);
        }

        // -------------------------------------------------------------
        // 3. Parse additional metadata from the smpl chunk (if present)
        // -------------------------------------------------------------
        let midiNote = -1;
        let loopStart = decodedBuffer.duration * 0.1;
        let loopEnd = decodedBuffer.duration * 0.9;
        let hasLoopData = false;

        if (smplChunkOffset !== -1) {
          const numLoops = dataView.getUint32(smplChunkOffset + 28, true);
          if (numLoops > 0 && smplChunkOffset + 36 + 24 <= arrayBuffer.byteLength) {
            midiNote = dataView.getUint32(smplChunkOffset + 20, true);
            const loopOffset = smplChunkOffset + 36; // First loop descriptor
            const loopStartFrames = dataView.getUint32(loopOffset + 8, true);
            const loopEndFrames = dataView.getUint32(loopOffset + 12, true);
            loopStart = loopStartFrames / sampleRateHeader;
            loopEnd = loopEndFrames / sampleRateHeader;
            hasLoopData = true;
          }
        }

        // Fallback: parse root note from filename
        if (midiNote < 0) {
          try {
            const parsed = parseFilename(file.name);
            if (parsed && parsed.length > 1) midiNote = parsed[1];
          } catch (_) {
            // ignore
          }
        }

        resolve({
          audioBuffer: decodedBuffer,
          duration: decodedBuffer.duration,
          sampleRate: sampleRateHeader,
          bitDepth: bitsPerSample,
          channels: numChannels,
          midiNote,
          loopStart,
          loopEnd,
          hasLoopData,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert an AudioBuffer by channel count, sample rate, and bit depth
 * Returns a Promise resolving to a Blob (final WAV).
 */
async function convertAudioBuffer(audioBuffer, newSampleRate, newBitDepth, newChannels) {
  // 1) Convert channels first (e.g. stereo->mono downmix if needed)
  let converted = audioBuffer;
  if (newChannels === 1 && audioBuffer.numberOfChannels > 1) {
    converted = convertChannels(audioBuffer);
  }

  // 2) Resample if needed
  if (converted.sampleRate !== newSampleRate) {
    converted = await resampleAudioBuffer(converted, newSampleRate);
  }

  // 3) Convert to final WAV with the desired bit depth
  return audioBufferToWavWithBitDepth(converted, newBitDepth);
}

/**
 * Downmix to mono with proper gain compensation
 */
function convertChannels(audioBuffer) {
  if (audioBuffer.numberOfChannels <= 1) {
    return audioBuffer;
  }
  const length = audioBuffer.length;
  const rate = audioBuffer.sampleRate;
  const offlineCtx = new OfflineAudioContext(1, length, rate);
  const tmp = offlineCtx.createBuffer(1, length, rate);
  const monoData = tmp.getChannelData(0);

  // Find peak for proper scaling
  let peak = 0;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      sum += audioBuffer.getChannelData(ch)[i];
    }
    const avg = sum / audioBuffer.numberOfChannels;
    peak = Math.max(peak, Math.abs(avg));
  }

  // Apply downmix with proper scaling
  const scale = peak > 1 ? 1/peak : 1;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      sum += audioBuffer.getChannelData(ch)[i];
    }
    monoData[i] = (sum / audioBuffer.numberOfChannels) * scale;
  }

  return tmp;
}

/**
 * Resample via an OfflineAudioContext
 */
async function resampleAudioBuffer(audioBuffer, targetSampleRate) {
  if (audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer;
  }
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const newBuffer = await offlineCtx.startRendering();
  return newBuffer;
}

/**
 * Convert AudioBuffer to WAV with the chosen bit depth
 */
function audioBufferToWavWithBitDepth(audioBuffer, requestedBitDepth) {
  // If "keep", fallback to 16 as a default
  let finalDepth = parseInt(requestedBitDepth);
  if (isNaN(finalDepth) || requestedBitDepth === "keep") {
    finalDepth = 16;
  }
  return encodeAudioBufferAsWavBlob(audioBuffer, finalDepth);
}

function encodeAudioBufferAsWavBlob(audioBuffer, bitDepth) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = (bitDepth === 24) ? 3 : 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  // Create buffer with 44-byte header
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // 1) Write WAV header - optimized for mono/stereo
  // "RIFF"
  writeUint32(view, 0, 0x52494646);
  // File size - 8
  writeUint32LE(view, 4, 36 + dataSize);
  // "WAVE"
  writeUint32(view, 8, 0x57415645);
  // "fmt "
  writeUint32(view, 12, 0x666d7420);
  // Subchunk1Size = 16
  writeUint32LE(view, 16, 16);
  // Audio format = 1 (PCM)
  writeUint16LE(view, 20, 1);
  // NumChannels
  writeUint16LE(view, 22, numChannels);
  // SampleRate
  writeUint32LE(view, 24, sampleRate);
  // ByteRate
  writeUint32LE(view, 28, byteRate);
  // BlockAlign
  writeUint16LE(view, 32, blockAlign);
  // BitsPerSample
  writeUint16LE(view, 34, bitDepth);
  // "data"
  writeUint32(view, 36, 0x64617461);
  // Subchunk2Size
  writeUint32LE(view, 40, dataSize);

  // 2) Write samples with proper scaling
  let offset = 44;
  const scale = bitDepth === 24 ? 0x7fffff : 0x7fff;
  
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = audioBuffer.getChannelData(ch)[i];
      // Clamp without expanding dynamic range
      sample = Math.max(-1, Math.min(1, sample));
      
      if (bitDepth === 16) {
        const intSample = Math.round(sample * scale);
        writeInt16LE(view, offset, intSample);
        offset += 2;
      } else {
        // 24-bit
        const intSample = Math.round(sample * scale);
        writeInt24LE(view, offset, intSample);
        offset += 3;
      }
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

// Below are the helper writers
function writeUint32(view, offset, value) {
  view.setUint32(offset, value, false);
}
function writeUint32LE(view, offset, value) {
  view.setUint32(offset, value, true);
}
function writeUint16LE(view, offset, value) {
  view.setUint16(offset, value, true);
}
function writeInt16LE(view, offset, value) {
  view.setInt16(offset, value, true);
}
/** Write a 24-bit signed int, done manually */
function writeInt24LE(view, offset, value) {
  // Clamp value to the range of a 24-bit signed integer
  const clampedValue = Math.max(-8388608, Math.min(8388607, value));
  view.setInt8(offset, clampedValue & 0xff);
  view.setInt8(offset + 1, (clampedValue >> 8) & 0xff);
  view.setInt8(offset + 2, (clampedValue >> 16) & 0xff);
}

/**
 * Get the effective sample rate (NO upsampling)
 * e.g. user dropdown values: "0"=keep original, "1"=11025, "2"=22050, "3"=44100
 */
function getEffectiveSampleRate(originalSampleRate, selectedRate) {
  const map = {
    "0": null,
    "1": 11025,
    "2": 22050,
    "3": 44100
  };
  
  // Convert selectedRate to string to handle both string and numeric values
  const selected = selectedRate.toString();
  
  if (!map[selected]) {
    // "0" or invalid means keep
    return originalSampleRate;
  }

  const targetRate = map[selected];
  
  // If original is 48kHz, allow conversion to any standard rate
  if (originalSampleRate === 48000) {
    return targetRate;
  }
  
  // For other rates, prevent upsampling
  return Math.min(originalSampleRate, targetRate);
}

/**
 * Get the effective bit depth (NO up‐biting)
 * valid dropdown choices: "keep", "16", "24"
 */
function getEffectiveBitDepth(originalBitDepth, selectedBitDepth) {
  if (selectedBitDepth === "keep") {
    return originalBitDepth;
  }
  if (selectedBitDepth === "16") {
    return (originalBitDepth >= 16) ? 16 : originalBitDepth;
  }
  if (selectedBitDepth === "24") {
    return (originalBitDepth >= 24) ? 24 : originalBitDepth;
  }
  // Fallback
  return originalBitDepth;
}

/**
 * Get the effective channel count (NO mono->stereo)
 * valid dropdown choices: "keep", "mono"
 */
function getEffectiveChannels(originalChannels, selectedChannels) {
  if (selectedChannels === "mono") {
    return 1;
  }
  // keep
  return originalChannels;
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Calculate the final sample count after conversion
 * @param {AudioBuffer} audioBuffer - Original audio buffer  
 * @param {number} targetSampleRate - Target sample rate
 * @param {number} originalSampleRate - Original sample rate
 * @returns {number} - Final sample count after conversion
 */
function calculateConvertedSampleCount(audioBuffer, targetSampleRate, originalSampleRate) {
  if (targetSampleRate === originalSampleRate) {
    return audioBuffer.length;
  }
  
  const ratio = targetSampleRate / originalSampleRate;
  return Math.round(audioBuffer.length * ratio);
}

/**
 * Check if any conversion will actually happen
 * @param {Object} sample - Sample object with metadata
 * @param {string} targetBitDepth - Target bit depth
 * @param {number} targetSampleRate - Target sample rate  
 * @param {string} targetChannels - Target channels
 * @returns {boolean} - True if any conversion will happen
 */
function willConvert(sample, targetBitDepth, targetSampleRate, targetChannels) {
  const bitDepthChanged = targetBitDepth !== "keep" && parseInt(targetBitDepth) !== sample.originalBitDepth;
  const sampleRateChanged = targetSampleRate !== sample.originalSampleRate;
  const channelsChanged = targetChannels === "mono" && sample.originalChannels > 1;
  
  return bitDepthChanged || sampleRateChanged || channelsChanged;
}

/**
 * Perform the combined conversion, return the new file size (bytes).
 * Caches by "sampleRate-bitDepth-channels" to avoid repeated conversions.
 */
async function getActualConvertedSize(sample, selectedRate, selectedDepth, selectedChannels) {
  // Prepare a unique key
  const cacheKey = `${selectedRate}-${selectedDepth}-${selectedChannels}`;
  if (!sample.convertedSizes) {
    sample.convertedSizes = {};
  }

  // If size for this exact combo is known, return it
  if (sample.convertedSizes[cacheKey] != null) {
    return sample.convertedSizes[cacheKey];
  }

  // 1) figure out final effective settings
  const finalRate = getEffectiveSampleRate(sample.originalSampleRate, selectedRate);
  const finalDepth = getEffectiveBitDepth(sample.originalBitDepth, selectedDepth);
  const finalCh = getEffectiveChannels(sample.originalChannels, selectedChannels);

  // If no changes needed, return original size
  const conversionNeeded = !(
    finalRate === sample.originalSampleRate &&
    finalDepth === sample.originalBitDepth &&
    finalCh === sample.originalChannels
  );

  if (!conversionNeeded) {
    sample.convertedSizes[cacheKey] = sample.fileSize;
    return sample.fileSize;
  }

  // 2) Actually do the conversion
  const wavBlob = await convertAudioBuffer(
    sample.audioBuffer,
    finalRate,
    finalDepth,
    finalCh
  );
  const newSize = wavBlob.size;

  // 3) Cache it
  sample.convertedSizes[cacheKey] = newSize;

  return newSize;
}
