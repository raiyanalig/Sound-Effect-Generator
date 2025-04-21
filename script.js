// Web Audio API Setup
let audioContext;
let oscillator;
let gainNode;
let mediaRecorder;
let chunks = [];
let isPlaying = false;
let isRecording = false;
let analyser;
let visualizerCanvas;
let visualizerCanvasCtx;
let visualizerAnimation;
let customWaveform;
let reverbNode;
let delayNode;
let distortionNode;
let eqNodes = {};

// Effects state
let reverbLevel = 0;
let delayLevel = 0;
let distortionLevel = 0;

// Track management
let track1, track2;
let track1GainNode, track2GainNode;

// Initialize when the document is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get UI Elements
  const freqSlider = document.getElementById('frequency');
  const durSlider = document.getElementById('duration');
  const volSlider = document.getElementById('volume');
  const waveformSelector = document.getElementById('waveform');
  const freqValue = document.getElementById('freq-value');
  const durValue = document.getElementById('dur-value');
  const volValue = document.getElementById('vol-value');
  const playButton = document.getElementById('play-btn');
  const stopButton = document.getElementById('stop-btn');
  const recordButton = document.getElementById('record-btn');
  const downloadLink = document.getElementById('download-link');
  
  // Visualizer setup
  visualizerCanvas = document.getElementById('visualizer');
  visualizerCanvasCtx = visualizerCanvas.getContext('2d');
  
  // Track controls
  const track1FreqSlider = document.getElementById('track1-freq');
  const track1VolSlider = document.getElementById('track1-vol');
  const track1WaveformSelector = document.getElementById('track1-waveform');
  const track1FreqValue = document.getElementById('track1-freq-value');
  const track1VolValue = document.getElementById('track1-vol-value');
  
  const track2FreqSlider = document.getElementById('track2-freq');
  const track2VolSlider = document.getElementById('track2-vol');
  const track2WaveformSelector = document.getElementById('track2-waveform');
  const track2FreqValue = document.getElementById('track2-freq-value');
  const track2VolValue = document.getElementById('track2-vol-value');
  
  // Mixer controls
  const playSyncButton = document.getElementById('play-sync-btn');
  const recordSyncButton = document.getElementById('record-sync-btn');
  
  // Effects controls
  const reverbSlider = document.getElementById('reverb');
  const delaySlider = document.getElementById('delay');
  const distortionSlider = document.getElementById('distortion');
  const reverbValueDisplay = document.getElementById('reverb-value');
  const delayValueDisplay = document.getElementById('delay-value');
  const distortionValueDisplay = document.getElementById('distortion-value');
  
  // EQ sliders
  const eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000];
  
  // Initialize audio context when user interacts
  const initAudio = () => {
    if (audioContext) return; // Already initialized
    
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      
      // Setup EQ nodes
      eqFrequencies.forEach(freq => {
        const eqNode = audioContext.createBiquadFilter();
        eqNode.type = 'peaking';
        eqNode.frequency.value = freq;
        eqNode.Q.value = 1;
        eqNode.gain.value = 0;
        eqNodes[freq] = eqNode;
        
        // Connect EQ slider
        const eqSlider = document.getElementById(`eq-${freq === 1000 ? '1k' : 
                                                freq === 3000 ? '3k' : 
                                                freq === 6000 ? '6k' : 
                                                freq === 12000 ? '12k' : freq}`);
        if (eqSlider) {
          eqSlider.addEventListener('input', function() {
            eqNode.gain.value = parseFloat(this.value);
          });
        }
      });
      
      // Create reverb node
      reverbNode = createReverb();
      
      // Create delay node
      delayNode = audioContext.createDelay(5.0);
      delayNode.delayTime.value = 0.5;
      const delayFeedback = audioContext.createGain();
      delayFeedback.gain.value = 0.4;
      
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      
      // Create distortion node
      distortionNode = audioContext.createWaveShaper();
      
      // Setup tracks for deck mixing
      setupTracks();
      
      // Remove initialization event listeners after setup
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      
      // Start visualizer
      drawVisualizer();
      
    } catch (e) {
      console.error("Web Audio API is not supported in this browser", e);
      alert("Sorry, Web Audio API is not supported in your browser. Please try a different browser.");
    }
  };
  
  // Add event listeners for initialization
  document.addEventListener('click', initAudio);
  document.addEventListener('keydown', initAudio);
  
  // Create a reverb effect
  function createReverb() {
    const convolver = audioContext.createConvolver();
    
    // Generate impulse response for reverb
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * 3; // 3 seconds
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const channelData = impulse.getChannelData(channel);
      
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2);
        channelData[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    
    convolver.buffer = impulse;
    return convolver;
  }
  
  // Create distortion curve for the distortion effect
  function createDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; ++i) {
      const x = i * 2 / samples - 1;
      curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }
    
    return curve;
  }
  
  // Setup multiple tracks for DJ mixing
  function setupTracks() {
    // Track 1 setup
    track1GainNode = audioContext.createGain();
    track1GainNode.gain.value = parseFloat(track1VolSlider.value);
    
    // Track 2 setup
    track2GainNode = audioContext.createGain();
    track2GainNode.gain.value = parseFloat(track2VolSlider.value);
    
    // Connect track volume sliders
    track1VolSlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      if (track1GainNode) track1GainNode.gain.value = value;
      track1VolValue.textContent = value.toFixed(2);
    });
    
    track2VolSlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      if (track2GainNode) track2GainNode.gain.value = value;
      track2VolValue.textContent = value.toFixed(2);
    });
    
    // Connect track frequency sliders
    track1FreqSlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      if (track1) track1.frequency.value = value;
      track1FreqValue.textContent = value;
    });
    
    track2FreqSlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      if (track2) track2.frequency.value = value;
      track2FreqValue.textContent = value;
    });
    
    // Connect track waveform selectors
    track1WaveformSelector.addEventListener('change', function() {
      if (track1) track1.type = this.value;
    });
    
    track2WaveformSelector.addEventListener('change', function() {
      if (track2) track2.type = this.value;
    });
    
    // Connect mixer play button
    playSyncButton.addEventListener('click', playMixedTracks);
    
    // Connect mixer record button
    recordSyncButton.addEventListener('click', recordMix);
  }
  
  // Update UI value displays
  freqSlider.addEventListener('input', function() {
    freqValue.textContent = this.value;
  });
  
  durSlider.addEventListener('input', function() {
    durValue.textContent = this.value;
  });
  
  volSlider.addEventListener('input', function() {
    volValue.textContent = this.value;
  });
  
  // Connect effects sliders
  reverbSlider.addEventListener('input', function() {
    reverbLevel = parseFloat(this.value);
    reverbValueDisplay.textContent = reverbLevel.toFixed(2);
  });
  
  delaySlider.addEventListener('input', function() {
    delayLevel = parseFloat(this.value);
    delayValueDisplay.textContent = delayLevel.toFixed(2);
  });
  
  distortionSlider.addEventListener('input', function() {
    distortionLevel = parseFloat(this.value);
    distortionValueDisplay.textContent = distortionLevel;
    
    if (distortionNode) {
      distortionNode.curve = createDistortionCurve(distortionLevel);
      distortionNode.oversample = '4x';
    }
  });
  
  // Play button functionality
  playButton.addEventListener('click', function() {
    initAudio();
    
    if (isPlaying) {
      stopSound();
    } else {
      playSound();
    }
  });
  
  // Stop button functionality
  stopButton.addEventListener('click', stopSound);
  
  // Record button functionality
  recordButton.addEventListener('click', function() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
      playSound();
    }
  });
  
  // Play the main sound with selected parameters
  function playSound() {
    if (!audioContext) initAudio();
    
    if (isPlaying) stopSound();
    
    isPlaying = true;
    playButton.innerHTML = '<i class="fas fa-pause"></i> Pause';
    
    // Create gain node for volume control
    gainNode = audioContext.createGain();
    gainNode.gain.value = parseFloat(volSlider.value);
    
    // Create oscillator
    oscillator = audioContext.createOscillator();
    oscillator.type = waveformSelector.value;
    oscillator.frequency.value = parseInt(freqSlider.value);
    
    // Custom waveform handling
    if (waveformSelector.value === 'custom' && customWaveform) {
      const real = new Float32Array(customWaveform.real);
      const imag = new Float32Array(customWaveform.imag);
      const wave = audioContext.createPeriodicWave(real, imag);
      oscillator.setPeriodicWave(wave);
    }
    
    // Create audio processing chain
    let sourceNode = oscillator;
    
    // Connect through effects chain if needed
    if (distortionLevel > 0) {
      distortionNode.curve = createDistortionCurve(distortionLevel);
      sourceNode.connect(distortionNode);
      sourceNode = distortionNode;
    }
    
    if (delayLevel > 0) {
      const delayGain = audioContext.createGain();
      delayGain.gain.value = delayLevel;
      
      sourceNode.connect(gainNode); // Direct path
      sourceNode.connect(delayNode); // Delay path
      delayNode.connect(delayGain);
      delayGain.connect(gainNode);
    } else {
      sourceNode.connect(gainNode);
    }
    
    if (reverbLevel > 0) {
      const reverbGain = audioContext.createGain();
      reverbGain.gain.value = reverbLevel;
      
      gainNode.connect(reverbNode);
      reverbNode.connect(reverbGain);
      reverbGain.connect(audioContext.destination);
    }
    
    // Connect through EQ nodes
    let currentNode = gainNode;
    Object.values(eqNodes).forEach(eqNode => {
      currentNode.connect(eqNode);
      currentNode = eqNode;
    });
    
    // Connect to analyzer for visualization
    currentNode.connect(analyser);
    analyser.connect(audioContext.destination);
    
    // Start oscillator
    oscillator.start();
    
    // Schedule automatic stop if duration is set
    const duration = parseFloat(durSlider.value);
    if (duration > 0 && duration < 60) { // Safety limit of 60 seconds
      setTimeout(() => {
        if (isPlaying) stopSound();
      }, duration * 1000);
    }
  }
  
  // Play mixed tracks (both decks together)
  function playMixedTracks() {
    if (!audioContext) initAudio();
    
    if (track1 || track2) {
      stopMixedTracks();
    }
    
    // Setup track 1
    track1 = audioContext.createOscillator();
    track1.type = track1WaveformSelector.value;
    track1.frequency.value = parseFloat(track1FreqSlider.value);
    
    // Setup track 2
    track2 = audioContext.createOscillator();
    track2.type = track2WaveformSelector.value;
    track2.frequency.value = parseFloat(track2FreqSlider.value);
    
    // Create main output gain
    const mainOutput = audioContext.createGain();
    
    // Connect tracks
    track1.connect(track1GainNode);
    track2.connect(track2GainNode);
    
    // Apply effects to both tracks
    track1GainNode.connect(mainOutput);
    track2GainNode.connect(mainOutput);
    
    // Connect to analyzer and destination
    mainOutput.connect(analyser);
    mainOutput.connect(audioContext.destination);
    
    // Start both tracks
    track1.start();
    track2.start();
    
    // Update UI
    playSyncButton.innerHTML = '<i class="fas fa-stop"></i> Stop Mix';
    playSyncButton.classList.add('stop-button');
    playSyncButton.classList.remove('play-button');
    
    // Make LEDs blink
    const statusLEDs = [
      document.getElementById('status-led-1'),
      document.getElementById('status-led-2'),
      document.getElementById('status-led-3'),
      document.getElementById('status-led-4'),
      document.getElementById('status-led-5'),
      document.getElementById('status-led-6')
    ];
    
    const blink = () => {
      statusLEDs.forEach(led => {
        if (Math.random() > 0.5) {
          led.classList.add('active');
        } else {
          led.classList.remove('active');
        }
      });
    };
    
    // Blink LEDs continuously while playing
    const blinkInterval = setInterval(blink, 100);
    
    // Store the interval to clear it later
    playSyncButton.dataset.blinkInterval = blinkInterval;
  }
  
  // Stop the mixed tracks
  function stopMixedTracks() {
    if (track1) {
      track1.stop();
      track1 = null;
    }
    
    if (track2) {
      track2.stop();
      track2 = null;
    }
    
    // Update UI
    playSyncButton.innerHTML = '<i class="fas fa-sync"></i> Mix Decks';
    playSyncButton.classList.remove('stop-button');
    playSyncButton.classList.add('play-button');
    
    // Stop LED blinking
    if (playSyncButton.dataset.blinkInterval) {
      clearInterval(playSyncButton.dataset.blinkInterval);
    }
    
    // Turn off all LEDs
    const statusLEDs = document.querySelectorAll('.led');
    statusLEDs.forEach(led => led.classList.remove('active'));
  }
  
  // Stop the sound
  function stopSound() {
    if (oscillator) {
      oscillator.stop();
      oscillator = null;
    }
    
    isPlaying = false;
    playButton.innerHTML = '<i class="fas fa-play"></i> Play';
  }
  
  // Start recording audio
  function startRecording() {
    if (!audioContext) initAudio();
    
    chunks = [];
    isRecording = true;
    recordButton.innerHTML = '<i class="fas fa-square"></i> Stop Rec';
    recordButton.style.backgroundColor = '#ef4444';
    
    // Create a recording stream from the audio context destination
    const dest = audioContext.createMediaStreamDestination();
    
    // Connect to the destination
    if (analyser) {
      analyser.connect(dest);
    }
    
    // Create MediaRecorder
    mediaRecorder = new MediaRecorder(dest.stream);
    
    // Handle data chunks
    mediaRecorder.ondataavailable = (evt) => {
      chunks.push(evt.data);
    };
    
    // Handle recording completion
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = `sound-effect-${new Date().toISOString().slice(0, 10)}.webm`;
      downloadLink.style.display = 'inline-block';
      downloadLink.classList.add('pulse-animation');
    };
    
    // Start recording
    mediaRecorder.start();
  }
  
  // Record the current mix
  function recordMix() {
    if (isRecording) {
      stopRecording();
      stopMixedTracks();
    } else {
      startRecording();
      playMixedTracks();
      
      recordSyncButton.innerHTML = '<i class="fas fa-square"></i> Stop Rec';
      recordSyncButton.style.backgroundColor = '#ef4444';
    }
  }
  
  // Stop recording
  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    
    isRecording = false;
    recordButton.innerHTML = '<i class="fas fa-circle"></i> Record';
    recordButton.style.backgroundColor = '';
    recordSyncButton.innerHTML = '<i class="fas fa-record-vinyl"></i> Record Mix';
    recordSyncButton.style.backgroundColor = '';
  }
  
  // Draw the visualizer
  function drawVisualizer() {
    if (!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const width = visualizerCanvas.width;
    const height = visualizerCanvas.height;
    
    visualizerCanvasCtx.clearRect(0, 0, width, height);
    
    function draw() {
      visualizerAnimation = requestAnimationFrame(draw);
      
      analyser.getByteTimeDomainData(dataArray);
      
      visualizerCanvasCtx.fillStyle = 'rgb(5, 7, 21)';
      visualizerCanvasCtx.fillRect(0, 0, width, height);
      
      visualizerCanvasCtx.lineWidth = 2;
      visualizerCanvasCtx.strokeStyle = 'rgb(34, 211, 238)';
      visualizerCanvasCtx.beginPath();
      
      const sliceWidth = width * 1.0 / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;
        
        if (i === 0) {
          visualizerCanvasCtx.moveTo(x, y);
        } else {
          visualizerCanvasCtx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      visualizerCanvasCtx.lineTo(width, height / 2);
      visualizerCanvasCtx.stroke();
      
      // Draw FFT frequency data
      analyser.getByteFrequencyData(dataArray);
      
      visualizerCanvasCtx.fillStyle = 'rgba(99, 102, 241, 0.3)';
      
      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        visualizerCanvasCtx.fillStyle = 'rgba(34, 211, 238, ' + (barHeight / 100) + ')';
        visualizerCanvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    }
    
    draw();
  }
  
  // Preset sound effects
  function playPreset(type) {
    initAudio();
    
    let settings = {};
    
    // Define presets
    switch (type) {
      case 'beep':
        settings = { wave: 'sine', freq: 880, dur: 0.3, vol: 0.5 };
        break;
      case 'chime':
        settings = { wave: 'sine', freq: 1320, dur: 1.5, vol: 0.4, reverb: 0.8 };
        break;
      case 'alert':
        settings = { wave: 'square', freq: 220, dur: 0.8, vol: 0.3 };
        break;
      case 'laser':
        settings = { wave: 'sawtooth', freq: 880, dur: 0.2, vol: 0.3, distortion: 50 };
        break;
      case 'explosion':
        settings = { wave: 'square', freq: 40, dur: 1, vol: 1, distortion: 80 };
        break;
      case 'rain':
        settings = { wave: 'sawtooth', freq: 800, dur: 2, vol: 0.2, delay: 0.8 };
        break;
      case 'wind':
        settings = { wave: 'triangle', freq: 80, dur: 3, vol: 0.4, reverb: 0.7 };
        break;
      case 'powerUp':
        settings = { wave: 'sine', freq: 440, dur: 1, vol: 0.5, custom: true };
        break;
      default:
        settings = { wave: 'sine', freq: 440, dur: 1, vol: 0.5 };
    }
    
    // Apply settings to UI
    waveformSelector.value = settings.wave;
    freqSlider.value = settings.freq;
    durSlider.value = settings.dur;
    volSlider.value = settings.vol;
    reverbSlider.value = settings.reverb || 0;
    delaySlider.value = settings.delay || 0;
    distortionSlider.value = settings.distortion || 0;
    
    // Update displays
    freqValue.textContent = settings.freq;
    durValue.textContent = settings.dur;
    volValue.textContent = settings.vol;
    reverbValueDisplay.textContent = settings.reverb || 0;
    delayValueDisplay.textContent = settings.delay || 0;
    distortionValueDisplay.textContent = settings.distortion || 0;
    
    // Set effect levels
    reverbLevel = settings.reverb || 0;
    delayLevel = settings.delay || 0;
    distortionLevel = settings.distortion || 0;
    
    // Special case for power up (frequency sweep)
    if (settings.custom && type === 'powerUp') {
      playPowerUpEffect();
    } else {
      // Play the sound with preset settings
      playSound();
    }
    
    // Update fader positions visually
    document.querySelectorAll('.fader-container').forEach(fader => {
      const rangeId = fader.querySelector('input[type="range"]').id;
      const input = document.getElementById(rangeId);
      input.dispatchEvent(new Event('input'));
    });
    
    // Update knob positions visually
    document.querySelectorAll('.knob').forEach(knob => {
      const knobId = knob.id;
      const input = document.getElementById(knobId.replace('-knob', ''));
      if (input) input.dispatchEvent(new Event('input'));
    });
  }
  
  // Special effect for power up (frequency sweep)
  function playPowerUpEffect() {
    if (!audioContext) initAudio();
    
    if (isPlaying) stopSound();
    
    isPlaying = true;
    playButton.innerHTML = '<i class="fas fa-pause"></i> Pause';
    
    // Create gain node for volume control
    gainNode = audioContext.createGain();
    gainNode.gain.value = parseFloat(volSlider.value);
    
    // Create oscillator
    oscillator = audioContext.createOscillator();
    oscillator.type = waveformSelector.value;
    oscillator.frequency.value = 100; // Start at low frequency
    
    // Frequency sweep
    oscillator.frequency.exponentialRampToValueAtTime(
      2000, // Target frequency
      audioContext.currentTime + 1 // Ramp over 1 second
    );
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);
    
    // Start oscillator
    oscillator.start();
    
    // Stop after 1 second
    setTimeout(() => {
      if (isPlaying) stopSound();
    }, 1000);
  }
  
  // Search Freesound API for samples (placeholder - would need API key for actual implementation)
  window.searchFreesound = function() {
    const query = document.getElementById('search-input').value;
    
    if (!query) {
      alert("Please enter a search term");
      return;
    }
    
    // Simulate search results
    const results = document.getElementById('search-results');
    results.innerHTML = '<div class="digital-display">Loading results...</div>';
    
    setTimeout(() => {
      const sampleResults = [
        { name: "Drum Loop", duration: "2s" },
        { name: "Bass Drop", duration: "1s" },
        { name: "Synth Lead", duration: "3s" },
        { name: "Vocal Sample", duration: "2s" },
        { name: "Ambient Pad", duration: "5s" },
        { name: "Kick Drum", duration: "0.5s" },
        { name: "Hi-Hat", duration: "0.2s" },
        { name: "Clap", duration: "0.3s" }
      ];
      
      const resultList = document.createElement('div');
      resultList.className = 'search-result-list';
      
      sampleResults.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.innerHTML = `
          ${result.name}<br>
          <small>${result.duration}</small>
        `;
        item.style.animationDelay = (index * 0.1) + 's';
        item.style.opacity = 1;
        
        // Add click handler
        item.addEventListener('click', () => loadSample(result.name));
        
        resultList.appendChild(item);
      });
      
      results.innerHTML = '';
      results.appendChild(resultList);
    }, 1000);
  };
  
  // Simulate loading a sample (in a real app, this would load audio from an API)
  function loadSample(name) {
    const results = document.getElementById('search-results');
    
    const soundCard = document.createElement('div');
    soundCard.className = 'sound-card';
    
    soundCard.innerHTML = `
      <h3>${name}</h3>
      <div class="custom-audio-player">
        <audio controls src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"></audio>
      </div>
      <div class="dj-controls-buttons">
        <button onclick="playPreset('beep')"><i class="fas fa-play"></i> Add to Mix</button>
        <button onclick="playPreset('chime')"><i class="fas fa-sliders-h"></i> Edit</button>
      </div>
      <div class="applied-effects">
        <p>Applied Effects</p>
        <div class="effects-tags">
          <span class="effect-tag reverb">Reverb 0.3</span>
          <span class="effect-tag delay">Delay 0.2</span>
        </div>
      </div>
    `;
    
    results.innerHTML = '';
    results.appendChild(soundCard);
  }
});

// Custom waveform data (can be expanded)
customWaveform = {
  real: [0, 0.5, 0.2, 0.3, 0, -0.1, 0, 0.1],
  imag: [0, 0, 0, 0, 0, 0, 0, 0]
};
