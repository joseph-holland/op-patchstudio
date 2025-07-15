// test/aif-import-debug.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Setup jsdom and mock AudioContext
const { window } = new JSDOM('', { url: 'http://localhost/' });
global.window = window;
global.document = window.document;

global.Blob = window.Blob;
global.File = window.File;

global.AudioContext = class {
  constructor() {
    this.sampleRate = 44100;
  }
  async decodeAudioData(buffer) {
    // Return a mock AudioBuffer
    return {
      duration: 1.0,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(44100)
    };
  }
};

global.webkitAudioContext = global.AudioContext;

// Import the audioFormats module
const audioFormats = require('../dist/assets/index-DRnh0QFV.js');

(async () => {
  const filePath = path.resolve(__dirname, '../ambient guitar-C1-V127-N2LN.aif');
  const fileBuffer = fs.readFileSync(filePath);
  const file = new window.File([fileBuffer], 'ambient guitar-C1-V127-N2LN.aif');
  try {
    const meta = await audioFormats.readAudioMetadata(file);
    console.log('AIF Import Result:', meta);
  } catch (err) {
    console.error('AIF Import Error:', err);
  }
})(); 