// Patch generation utilities for OP-XY drum and multisample presets
import JSZip from 'jszip';
import { convertAudioFormat, sanitizeName } from './audio';
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
  targetChannels?: string
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
  let midiNoteCounter = 53; // Start from F#3 like legacy

  // Process loaded drum samples
  for (let i = 0; i < state.drumSamples.length; i++) {
    const sample = state.drumSamples[i];
    if (!sample.isLoaded || !sample.file || !sample.audioBuffer) continue;

    const outputName = sanitizeName(sample.file.name);
    const sampleRate = sample.audioBuffer.sampleRate;
    const duration = sample.audioBuffer.duration;

    // Create region object in correct OP-XY format
    const midiNote = midiNoteCounter++;
    const effectiveSampleRate = targetSampleRate || sampleRate;
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
      pan: 0, // TODO: Get from advanced settings when implemented
      "pitch.keycenter": 60,
      playmode: "oneshot", // TODO: Get from advanced settings when implemented
      reverse: false, // TODO: Get from advanced settings when implemented
      sample: outputName,
      transpose: 0,
      tune: 0, // TODO: Get from advanced settings when implemented
      "sample.start": sampleStart,
      "sample.end": sampleEnd,
    };

    // Handle audio conversions if needed
    const needsConversion = 
      (targetSampleRate && sampleRate !== targetSampleRate) ||
      (targetBitDepth && targetBitDepth !== sample.originalBitDepth) ||
      (targetChannels === "mono" && sample.audioBuffer.numberOfChannels > 1);

    if (needsConversion) {
      fileReadPromises.push(
        (async () => {
          try {
            const convertedBuffer = await convertAudioFormat(sample.audioBuffer!, {
              sampleRate: targetSampleRate || sampleRate,
              bitDepth: targetBitDepth || sample.originalBitDepth || 16,
              channels: targetChannels === "mono" ? 1 : sample.audioBuffer!.numberOfChannels
            });
            
            // Validate that converted buffer frame count matches our calculation
            const expectedFramecount = Math.floor(duration * (targetSampleRate || sampleRate));
            validateFrameCount(sample.name, expectedFramecount, convertedBuffer.length, region);
            
            // Convert to WAV blob
            const { audioBufferToWav } = await import('./audio');
            const wavBlob = audioBufferToWav(convertedBuffer, targetBitDepth || 16);
            zip.file(outputName, wavBlob);
            patchJson.regions.push(region);
          } catch (error) {
            console.error(`Failed to convert sample ${sample.name}:`, error);
          }
        })()
      );
    } else {
      // No conversion needed, use original file
      fileReadPromises.push(
        new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              zip.file(outputName, e.target.result);
              patchJson.regions.push(region);
            }
            resolve();
          };
          reader.onerror = () => reject(new Error(`Failed to read ${sample.name}`));
          reader.readAsArrayBuffer(sample.file!);
        })
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
  multisampleGain: number = 0
): Promise<Blob> {
  const zip = new JSZip();
  const sanitizedName = sanitizeName(patchName);
  
  // Deep copy base multisample JSON
  const patchJson: MultisampleJson = JSON.parse(JSON.stringify(baseMultisampleJson));
  patchJson.name = sanitizedName;
  patchJson.regions = [];

  // Merge imported preset settings if they exist
  mergeImportedMultisampleSettings(patchJson, (state as any).importedMultisamplePresetJson);

  // Apply multisample preset settings
  // TODO: Add multisample advanced settings when implemented
  // For now, use defaults similar to legacy implementation

  const fileReadPromises: Promise<void>[] = [];
  
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
  for (const sample of validSamples) {
    if (!sample.file || !sample.audioBuffer) continue;

    const outputName = sanitizeName(sample.file.name);
    const sampleRate = sample.audioBuffer.sampleRate;
    const duration = sample.audioBuffer.duration;
    const sampleNote = sample.rootNote >= 0 ? sample.rootNote : 60 + sample.originalIndex;
    const effectiveSampleRate = targetSampleRate || sampleRate;
    const framecount = Math.floor(duration * effectiveSampleRate);

    // Calculate key ranges (matching working implementation)
    const lowKey = lastKey;
    const hiKey = sampleNote;
    lastKey = sampleNote + 1;

    // Debug logging
    console.log(`Processing sample: ${outputName}, MIDI: ${sampleNote}, lokey: ${lowKey}, hikey: ${hiKey}, framecount: ${framecount}`);

    // Calculate proportional points
    const getClamped = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));
    const prop = (point: number | undefined, fallback: number) => (typeof point === 'number' ? point : fallback);
    const loopStart = getClamped(Math.floor(framecount * (prop(sample.loopStart, 0) / duration)), 0, framecount - 1);
    const loopEnd = getClamped(Math.floor(framecount * (prop(sample.loopEnd, duration) / duration)), loopStart + 1, framecount);
    const sampleStart = getClamped(Math.floor(framecount * (prop(sample.inPoint, 0) / duration)), 0, framecount - 1);
    const sampleEnd = getClamped(Math.floor(framecount * (prop(sample.outPoint, duration) / duration)), sampleStart + 1, framecount);

    const region: MultisampleRegion = {
      framecount: framecount,
      gain: multisampleGain || 0,
      hikey: hiKey,
      lokey: lowKey,
      "loop.crossfade": 0,
      "loop.end": loopEnd,
      "loop.onrelease": false, // TODO: Get from advanced settings
      "loop.enabled": false, // TODO: Get from advanced settings
      "loop.start": loopStart,
      "pitch.keycenter": sampleNote,
      reverse: false,
      sample: outputName,
      "sample.end": sampleEnd,
      "sample.start": sampleStart,
      tune: 0,
    };

    // Handle audio conversions if needed
    const needsConversion = 
      (targetSampleRate && sampleRate !== targetSampleRate) ||
      (targetBitDepth && targetBitDepth !== sample.originalBitDepth) ||
      (targetChannels === "mono" && sample.audioBuffer.numberOfChannels > 1) ||
      state.multisampleSettings.normalize ||
      multisampleGain !== 0;

    if (needsConversion) {
      fileReadPromises.push(
        (async () => {
          try {
            const convertedBuffer = await convertAudioFormat(sample.audioBuffer!, {
              sampleRate: targetSampleRate || sampleRate,
              bitDepth: targetBitDepth || sample.originalBitDepth || 16,
              channels: targetChannels === "mono" ? 1 : sample.audioBuffer!.numberOfChannels,
              normalize: state.multisampleSettings.normalize,
              normalizeLevel: state.multisampleSettings.normalizeLevel,
              gain: multisampleGain
            });
            
            // Validate that converted buffer frame count matches our calculation
            const expectedFramecount = Math.floor(duration * effectiveSampleRate);
            validateFrameCount(sample.name, expectedFramecount, convertedBuffer.length, region);
            
            // Convert to WAV blob
            const { audioBufferToWav } = await import('./audio');
            const wavBlob = audioBufferToWav(convertedBuffer, targetBitDepth || 16);
            zip.file(outputName, wavBlob);
            patchJson.regions.push(region);
          } catch (error) {
            console.error(`Failed to convert sample ${sample.name}:`, error);
          }
        })()
      );
    } else {
      // No conversion needed, use original file
      fileReadPromises.push(
        new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              zip.file(outputName, e.target.result);
              patchJson.regions.push(region);
            }
            resolve();
          };
          reader.onerror = () => reject(new Error(`Failed to read ${sample.name}`));
          reader.readAsArrayBuffer(sample.file!);
        })
      );
    }
  }

  // Set the last region's hikey to 127 (matching working implementation)
  if (patchJson.regions.length > 0) {
    patchJson.regions[patchJson.regions.length - 1].hikey = 127;
  }

  await Promise.all(fileReadPromises);

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