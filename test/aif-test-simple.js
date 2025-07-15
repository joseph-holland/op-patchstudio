// Simple AIF test using Node.js built-in modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple AIF header parser for testing
function parseAifHeader(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  const textDecoder = new TextDecoder('ascii');
  
  // Check FORM header
  const form = textDecoder.decode(new Uint8Array(arrayBuffer, 0, 4));
  if (form !== 'FORM') {
    throw new Error('Invalid AIF file: missing FORM header');
  }

  // Check AIFF/AIFC format
  const format = textDecoder.decode(new Uint8Array(arrayBuffer, 8, 4));
  console.log('Format:', format);
  
  // Parse IEEE 80-bit float for sample rate
  function parseIeee80BitFloat(offset) {
    const signBit = (dataView.getUint8(offset) & 0x80) !== 0;
    const exponent = ((dataView.getUint8(offset) & 0x7F) << 8) | dataView.getUint8(offset + 1);
    
    let mantissa = 0;
    for (let i = 2; i < 10; i++) {
      mantissa = mantissa * 256 + dataView.getUint8(offset + i);
    }
    
    if (exponent === 0) return 0;
    if (exponent === 0x7FFF) return signBit ? -Infinity : Infinity;
    
    const biasedExponent = exponent - 16383;
    const normalizedMantissa = 1 + mantissa / Math.pow(2, 63);
    const result = Math.pow(2, biasedExponent) * normalizedMantissa;
    
    return signBit ? -result : result;
  }
  
  // Parse chunks
  let offset = 12;
  let commChunk = null;
  let instChunk = null;
  
  while (offset + 8 < dataView.byteLength) {
    const chunkId = textDecoder.decode(new Uint8Array(arrayBuffer, offset, 4));
    const chunkSize = dataView.getUint32(offset + 4, false);
    const chunkDataOffset = offset + 8;
    
    console.log(`Chunk: ${chunkId}, Size: ${chunkSize}`);
    
    if (chunkId === 'COMM') {
      const channels = dataView.getUint16(chunkDataOffset, false);
      const numSampleFrames = dataView.getUint32(chunkDataOffset + 2, false);
      const bitDepth = dataView.getUint16(chunkDataOffset + 6, false);
      const sampleRate = parseIeee80BitFloat(chunkDataOffset + 8);
      
      commChunk = { channels, numSampleFrames, bitDepth, sampleRate };
      console.log('COMM chunk:', commChunk);
    }
    
    if (chunkId === 'INST') {
      const baseNote = dataView.getUint8(chunkDataOffset);
      const detune = dataView.getInt8(chunkDataOffset + 1);
      
      instChunk = { baseNote, detune };
      console.log('INST chunk:', instChunk);
    }
    
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  
  return { commChunk, instChunk };
}

// Test the AIF file
const filePath = path.resolve(__dirname, '../ambient guitar-C1-V127-N2LN.aif');
console.log('Testing AIF file:', filePath);

try {
  const fileBuffer = fs.readFileSync(filePath);
  const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
  
  console.log('File size:', arrayBuffer.byteLength);
  const result = parseAifHeader(arrayBuffer);
  
  console.log('\n=== AIF PARSING RESULT ===');
  console.log('COMM chunk:', result.commChunk);
  console.log('INST chunk:', result.instChunk);
  
  if (result.instChunk) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(result.instChunk.baseNote / 12) - 2;
    const noteName = noteNames[result.instChunk.baseNote % 12];
    console.log(`Root note: ${noteName}${octave} (MIDI ${result.instChunk.baseNote})`);
  }
  
} catch (err) {
  console.error('Error parsing AIF file:', err);
} 