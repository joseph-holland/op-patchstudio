// Patch generation utilities for OP-XY drum and multisample presets
import JSZip from 'jszip';
import { convertAudioFormat, sanitizeName, LOOP_END_PADDING, generateFilename } from './audio';
import { exportAudioBuffer, getAudioFileExtension, type AudioFormat } from './audioExport';
import { baseDrumJson } from '../components/drum/baseDrumJson';
import { baseMultisampleJson } from '../components/multisample/baseMultisampleJson';
import { percentToInternal } from './valueConversions';
import { mergeImportedDrumSettings, mergeImportedMultisampleSettings } from './jsonImport';
import type { AppState, MultisampleFile } from '../context/AppContext';

// Extended MultisampleFile type for key range calculations
interface ExtendedMultisampleFile extends MultisampleFile {
  originalIndex: number;
  lokey?: number;
  hikey?: number;
}

// Types for OP-XY patch structure
interface DrumRegion {
  "fade.in": number;
  "fade.out": number;
  framecount: number;
  hikey: number;
  lokey: number;
  pan: number;
  "pitch.keycenter": number;
  playmode: string;
  reverse: boolean;
  sample: string;
  transpose: number;
  tune: number;
  gain?: number;
  "sample.start"?: number;
  "sample.end"?: number;
}

interface MultisampleRegion {
  framecount: number;
  gain: number;
  hikey: number;
  lokey: number;
  "loop.crossfade": number;
  "loop.end": number;
  "loop.onrelease": boolean;
  "loop.enabled": boolean;
  "loop.start": number;
  "pitch.keycenter": number;
  reverse: boolean;
  sample: string;
  "sample.end": number;
  "sample.start": number;
  tune: number;
}

interface DrumJson {
  name?: string;
  engine: any;
  envelope: any;
  fx: any;
  lfo: any;
  octave: number;
  platform: string;
  regions: DrumRegion[];
  type: string;
  version: number;
}

interface MultisampleJson {
  name?: string;
  engine: any;
  envelope: any;
  fx: any;
  lfo: any;
  octave: number;
  platform: string;
  regions: MultisampleRegion[];
  type: string;
  version: number;
}

// Utility function to validate frame counts and log warnings
function validateFrameCount(
  sampleName: string,
  expectedFramecount: number,
  actualFramecount: number,
  region: any
): void {
  if (actualFramecount !== expectedFramecount) {
    console.warn(`Frame count mismatch for ${sampleName}:`, {
      expected: expectedFramecount,
      actual: actualFramecount,
      difference: actualFramecount - expectedFramecount
    });
    
    // Update the region with the actual frame count
    region.framecount = actualFramecount;
    if (region["sample.end"] !== undefined) {
      region["sample.end"] = actualFramecount;
    }
  }
}

// Generate drum patch ZIP file
export async function generateDrumPatch(
  state: AppState, 
  patchName: string = 'drum_patch',
  targetSampleRate?: number,
  targetBitDepth?: number,
  targetChannels?: string,
  audioFormat: AudioFormat = 'wav'
): Promise<Blob> {
  const zip = new JSZip();
  const sanitizedName = sanitizeName(patchName);
  
  // Deep copy base drum JSON
  const patchJson: DrumJson = JSON.parse(JSON.stringify(baseDrumJson));
  patchJson.name = sanitizedName;
  patchJson.regions = [];

  // Merge imported preset settings if they exist
  mergeImportedDrumSettings(patchJson, (state as any).importedDrumPresetJson);

  // Apply drum preset settings (convert from 0-100% to 0-32767)
  if (patchJson.engine && state.drumSettings.presetSettings) {
    const settings = state.drumSettings.presetSettings;
    
    if (settings.playmode) patchJson.engine.playmode = settings.playmode;
    if (!isNaN(settings.transpose)) patchJson.engine.transpose = settings.transpose;
    if (!isNaN(settings.velocity)) {
      patchJson.engine["velocity.sensitivity"] = percentToInternal(settings.velocity);
    }
    if (!isNaN(settings.volume)) {
      patchJson.engine.volume = percentToInternal(settings.volume);
    }
    if (!isNaN(settings.width)) {
      patchJson.engine.width = percentToInternal(settings.width);
    }
  }

  const fileReadPromises: Promise<void>[] = [];
  // Only include the first 24 assigned samples in patch.json
  const assignedSamples = state.drumSamples
    .map((sample, index) => ({ ...sample, originalIndex: index }))
    .filter(sample => 
      sample.isLoaded && 
      sample.file && 
      sample.audioBuffer && 
      (
        // Either explicitly assigned
        (sample.isAssigned && typeof sample.assignedKey === 'number' && sample.assignedKey >= 0 && sample.assignedKey < 24) ||
        // Or in the first 24 slots and not explicitly unassigned
        (sample.originalIndex < 24 && sample.isAssigned !== false)
      )
    )
    .sort((a, b) => {
      // Sort by assignedKey if available, otherwise by originalIndex
      const aKey = a.assignedKey ?? a.originalIndex;
      const bKey = b.assignedKey ?? b.originalIndex;
      return aKey - bKey;
    })
    .slice(0, 24);

  let midiNoteCounter = 53; // Start from F#3 like legacy

  // Build patch.json regions strictly from assignedSamples
  for (let i = 0; i < assignedSamples.length; i++) {
    const sample = assignedSamples[i];
    const sampleKey = sample.assignedKey ?? sample.originalIndex;
    const fileExtension = getAudioFileExtension(audioFormat);
    const outputName = state.drumSettings.renameFiles 
      ? generateFilename(state.drumSettings.presetName, state.drumSettings.filenameSeparator, 'drum', sampleKey, sample.file!.name, state.midiNoteMapping, fileExtension)
      : sanitizeName(sample.file!.name).replace(/\.[^/.]+$/, `.${fileExtension}`);
    const originalSampleRate = sample.originalSampleRate || sample.audioBuffer!.sampleRate;
    const duration = sample.audioBuffer!.duration;
    const midiNote = midiNoteCounter++;
    const effectiveSampleRate = targetSampleRate || originalSampleRate;
    const framecount = Math.floor(duration * effectiveSampleRate);
    const getClamped = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));
    const sampleStart = 0;
    const sampleEnd = getClamped(framecount, 1, framecount);
    const region: DrumRegion = {
      "fade.in": 0,
      "fade.out": 0,
      framecount: framecount,
      hikey: midiNote,
      lokey: midiNote,
      pan: sample.pan,
      "pitch.keycenter": 60,
      playmode: sample.playmode,
      reverse: sample.reverse,
      sample: outputName,
      transpose: sample.transpose, // Apply individual sample transpose setting to region transpose
      tune: 0, // Keep tune at 0 since we don't have a tune slider
      gain: sample.gain,
      "sample.start": sampleStart,
      "sample.end": sampleEnd,
    };
    patchJson.regions.push(region);
  }

  // Still add all loaded samples to the ZIP as before
  for (let i = 0; i < state.drumSamples.length; i++) {
    const sample = state.drumSamples[i];
    if (!sample.isLoaded || !sample.file || !sample.audioBuffer) continue;
    const fileExtension = getAudioFileExtension(audioFormat);
    const outputName = state.drumSettings.renameFiles 
      ? generateFilename(state.drumSettings.presetName, state.drumSettings.filenameSeparator, 'drum', sample.assignedKey ?? i, sample.file.name, state.midiNoteMapping, fileExtension)
      : sanitizeName(sample.file.name).replace(/\.[^/.]+$/, `.${fileExtension}`);
    const originalSampleRate = sample.originalSampleRate || sample.audioBuffer.sampleRate;
    const duration = sample.audioBuffer.duration;
    const needsConversion = 
      (targetSampleRate && originalSampleRate !== targetSampleRate) ||
      (targetBitDepth && targetBitDepth !== sample.originalBitDepth) ||
      (targetChannels === "mono" && sample.audioBuffer.numberOfChannels > 1) ||
      state.drumSettings.normalize;
    if (needsConversion) {
      fileReadPromises.push(
        (async () => {
          try {
            const convertedBuffer = await convertAudioFormat(sample.audioBuffer!, {
              sampleRate: targetSampleRate || originalSampleRate,
              bitDepth: targetBitDepth || sample.originalBitDepth || 16,
              channels: targetChannels === "mono" ? 1 : sample.audioBuffer!.numberOfChannels,
              normalize: state.drumSettings.normalize,
              normalizeLevel: state.drumSettings.normalizeLevel,
              sampleName: sample.name
            });
            const audioBlob = exportAudioBuffer(convertedBuffer, {
              format: audioFormat,
              bitDepth: targetBitDepth || 16,
              isFloat: audioFormat === 'aiff' && targetBitDepth === 32,
              rootNote: 60, // Not used for ZIP-only samples
              loopStart: 0,
              loopEnd: Math.floor(duration * (targetSampleRate || originalSampleRate)) - 1
            });
            zip.file(outputName, audioBlob);
          } catch (error) {
            console.error(`Failed to convert sample ${sample.name}:`, error);
          }
        })()
      );
    } else {
      fileReadPromises.push(
        (async () => {
          try {
            const audioBlob = exportAudioBuffer(sample.audioBuffer!, {
              format: audioFormat,
              bitDepth: targetBitDepth || sample.originalBitDepth || 16,
              isFloat: audioFormat === 'aiff' && (targetBitDepth === 32 || sample.originalBitDepth === 32),
              rootNote: 60,
              loopStart: 0,
              loopEnd: Math.floor(duration * originalSampleRate) - 1
            });
            zip.file(outputName, audioBlob);
          } catch (error) {
            throw new Error(`Failed to create audio file with metadata for ${sample.name}: ${error instanceof Error ? error.message : error}`);
          }
        })()
      );
    }
  }

  await Promise.all(fileReadPromises);

  // Add patch.json to ZIP
  zip.file("patch.json", JSON.stringify(patchJson, null, 2));

  // Generate ZIP
  return await zip.generateAsync({ type: 'blob' });
}

// Generate multisample patch ZIP file
export async function generateMultisamplePatch(
  state: AppState, 
  patchName: string = 'multisample_patch',
  targetSampleRate?: number,
  targetBitDepth?: number,
  targetChannels?: string,
  multisampleGain: number = 0,
  audioFormat: AudioFormat = 'wav'
): Promise<Blob> {
  const zip = new JSZip();
  const sanitizedName = sanitizeName(patchName);
  
  // Deep copy base multisample JSON
  const patchJson: MultisampleJson = JSON.parse(JSON.stringify(baseMultisampleJson));
  patchJson.name = sanitizedName;
  patchJson.regions = [];

  // Merge imported preset settings if they exist
  mergeImportedMultisampleSettings(patchJson, (state as any).importedMultisamplePreset);

  // Apply multisample preset settings
  if (patchJson.engine && state.multisampleSettings) {
    const settings = state.multisampleSettings;
    
    if (!isNaN(settings.transpose)) patchJson.engine.transpose = settings.transpose;
    if (!isNaN(settings.velocitySensitivity)) {
      patchJson.engine["velocity.sensitivity"] = percentToInternal(settings.velocitySensitivity);
    }
    if (!isNaN(settings.volume)) {
      patchJson.engine.volume = percentToInternal(settings.volume);
    }
    if (!isNaN(settings.width)) {
      patchJson.engine.width = percentToInternal(settings.width);
    }
    if (!isNaN(settings.highpass)) {
      patchJson.engine.highpass = percentToInternal(settings.highpass);
    }
    if (settings.portamentoType) {
      patchJson.engine["portamento.type"] = settings.portamentoType === 'linear' ? 0 : 32767;
    }
    if (!isNaN(settings.portamentoAmount)) {
      patchJson.engine["portamento.amount"] = percentToInternal(settings.portamentoAmount);
    }
    if (!isNaN(settings.tuningRoot)) {
      patchJson.engine["tuning.root"] = settings.tuningRoot;
    }
  }

  const fileReadPromises: Promise<void>[] = [];
  const regionsInOrder: MultisampleRegion[] = [];
  
  // Get valid samples (with MIDI notes)
  const validSamples: ExtendedMultisampleFile[] = state.multisampleFiles
    .map((sample, index) => ({ ...sample, originalIndex: index }))
    .filter(sample => sample.file && sample.audioBuffer);

  // Sort samples by MIDI note for proper key range distribution
  validSamples.sort((a, b) => {
    const aMidiNote = a.rootNote >= 0 ? a.rootNote : 60 + a.originalIndex;
    const bMidiNote = b.rootNote >= 0 ? b.rootNote : 60 + b.originalIndex;
    return aMidiNote - bMidiNote;
  });

  // Calculate key ranges and create regions in the same loop (matching working implementation)
  let lastKey = 0;
  for (let i = 0; i < validSamples.length; i++) {
    const sample = validSamples[i];
    if (!sample.file || !sample.audioBuffer) continue;

    const fileExtension = getAudioFileExtension(audioFormat);
    const outputName = state.multisampleSettings.renameFiles 
      ? generateFilename(state.multisampleSettings.presetName, state.multisampleSettings.filenameSeparator, 'multisample', sample.rootNote, sample.file.name, state.midiNoteMapping, fileExtension)
      : sanitizeName(sample.file.name).replace(/\.[^/.]+$/, `.${fileExtension}`);
    const originalSampleRate = sample.originalSampleRate || sample.audioBuffer.sampleRate;
    const duration = sample.audioBuffer.duration;
    const sampleNote = sample.rootNote >= 0 ? sample.rootNote : 60 + sample.originalIndex;
    const effectiveSampleRate = targetSampleRate || originalSampleRate;
    const framecount = Math.floor(duration * effectiveSampleRate);

    // Calculate key ranges (matching working implementation)
    const lowKey = lastKey;
    const hiKey = sampleNote;
    lastKey = sampleNote + 1;

    // Calculate proportional points
    const getClamped = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));
    const prop = (point: number | undefined, fallback: number) => (typeof point === 'number' ? point : fallback);
    
    // Use original sample rate and duration for loop point calculations to match legacy behavior
    const originalDuration = sample.duration || duration;
    const originalFramecount = Math.floor(originalDuration * originalSampleRate);
    
    // Calculate loop points - convert from seconds to frames
    // sample.loopStart and sample.loopEnd are in seconds, so multiply by sample rate to get frames
    const loopStartFrames = prop(sample.loopStart, originalDuration * 0.1) * originalSampleRate;
    const loopEndFrames = prop(sample.loopEnd, originalDuration * 0.9) * originalSampleRate;
    
    const loopStart = getClamped(Math.floor(loopStartFrames), 0, originalFramecount - 1);
    const loopEnd = getClamped(Math.floor(loopEndFrames), loopStart + 1, originalFramecount);
    
    // Scale loop points to target sample rate if resampling
    const scaleFactor = effectiveSampleRate / originalSampleRate;
    const scaledLoopStart = Math.floor(loopStart * scaleFactor);
    const scaledLoopEnd = Math.floor(loopEnd * scaleFactor);
    
    // Calculate sample start/end points using target sample rate
    const sampleStart = getClamped(Math.floor(framecount * (prop(sample.inPoint, 0) / duration)), 0, framecount - 1);
    const sampleEnd = getClamped(Math.floor(framecount * (prop(sample.outPoint, duration) / duration)), sampleStart + 1, framecount);

    // Calculate the actual framecount for the region (accounting for cut at loop end)
    const actualFramecount = state.multisampleSettings.cutAtLoopEnd 
      ? scaledLoopEnd + LOOP_END_PADDING 
      : framecount;
    
    const region: MultisampleRegion = {
      framecount: actualFramecount,
      gain: multisampleGain,
      hikey: hiKey,
      lokey: lowKey,
      "loop.crossfade": 0,
      "loop.end": scaledLoopEnd,
      "loop.onrelease": state.multisampleSettings.loopOnRelease,
      "loop.enabled": state.multisampleSettings.loopEnabled,
      "loop.start": scaledLoopStart,
      "pitch.keycenter": sampleNote,
      reverse: false,
      sample: outputName,
      "sample.end": state.multisampleSettings.cutAtLoopEnd ? actualFramecount : sampleEnd,
      "sample.start": sampleStart,
      tune: 0,
    };

    // Handle audio conversions if needed
    const needsConversion = 
      (targetSampleRate && originalSampleRate !== targetSampleRate) ||
      (targetBitDepth && targetBitDepth !== sample.originalBitDepth) ||
      (targetChannels === "mono" && sample.audioBuffer.numberOfChannels > 1) ||
      state.multisampleSettings.normalize ||
      state.multisampleSettings.cutAtLoopEnd ||
      multisampleGain !== 0;

    if (needsConversion) {
      fileReadPromises.push(
        (async () => {
          try {
            const convertedBuffer = await convertAudioFormat(sample.audioBuffer!, {
              sampleRate: targetSampleRate || originalSampleRate,
              bitDepth: targetBitDepth || sample.originalBitDepth || 16,
              channels: targetChannels === "mono" ? 1 : sample.audioBuffer!.numberOfChannels,
              normalize: state.multisampleSettings.normalize,
              normalizeLevel: state.multisampleSettings.normalizeLevel,
              gain: multisampleGain,
              cutAtLoopEnd: state.multisampleSettings.cutAtLoopEnd,
              loopEnd: loopEnd, // Use original loop end in frames at original sample rate
              sampleName: sample.name
            });
            // Validate that converted buffer frame count matches our calculation
            const expectedFramecount = state.multisampleSettings.cutAtLoopEnd 
              ? scaledLoopEnd + LOOP_END_PADDING 
              : Math.floor(duration * effectiveSampleRate);
            validateFrameCount(sample.name, expectedFramecount, convertedBuffer.length, region);
            // Convert to audio blob with metadata
            const audioBlob = exportAudioBuffer(convertedBuffer, {
              format: audioFormat,
              bitDepth: targetBitDepth || 16,
              isFloat: audioFormat === 'aiff' && targetBitDepth === 32,
              rootNote: sampleNote,
              loopStart: scaledLoopStart,
              loopEnd: scaledLoopEnd
            });
            zip.file(outputName, audioBlob);
            regionsInOrder[i] = region;
          } catch (error) {
            throw new Error(`Failed to convert sample ${sample.name} to audio file: ${error instanceof Error ? error.message : error}`);
          }
        })()
      );
    } else {
      // No conversion needed, but still create WAV with SMPL metadata
      fileReadPromises.push(
        (async () => {
          try {
            const audioBlob = exportAudioBuffer(sample.audioBuffer!, {
              format: audioFormat,
              bitDepth: targetBitDepth || sample.originalBitDepth || 16,
              isFloat: audioFormat === 'aiff' && (targetBitDepth === 32 || sample.originalBitDepth === 32),
              rootNote: sampleNote,
              loopStart: scaledLoopStart,
              loopEnd: scaledLoopEnd
            });
            zip.file(outputName, audioBlob);
            regionsInOrder[i] = region;
          } catch (error) {
            throw new Error(`Failed to create WAV with metadata for ${sample.name}: ${error instanceof Error ? error.message : error}`);
          }
        })()
      );
    }
  }

  await Promise.all(fileReadPromises);

  // Add regions in the correct order to patchJson
  patchJson.regions = regionsInOrder.filter(region => region !== undefined);

  // Set the last region's hikey to 127 (matching working implementation)
  if (patchJson.regions.length > 0) {
    patchJson.regions[patchJson.regions.length - 1].hikey = 127;
  }

  // Add patch.json to ZIP
  zip.file("patch.json", JSON.stringify(patchJson, null, 2));

  // Generate ZIP
  return await zip.generateAsync({ type: 'blob' });
}

// Download a blob as a file
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}