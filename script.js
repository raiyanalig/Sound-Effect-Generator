
const playBtn = document.getElementById('play-btn');
const freqSlider = document.getElementById('frequency');
const durSlider = document.getElementById('duration');
const freqValue = document.getElementById('freq-value');
const durValue = document.getElementById('dur-value');
const waveformSelect = document.getElementById('waveform');
const volumeSlider = document.getElementById('volume');
const volumeValue = document.getElementById('vol-value');
const canvas = document.getElementById('visualizer');
const recordBtn = document.getElementById('record-btn');
const downloadLink = document.getElementById('download-link');
const searchResults = document.getElementById('search-results');

let chunks = [];
let mediaRecorder;


freqSlider.oninput = () => freqValue.textContent = freqSlider.value;
durSlider.oninput = () => durValue.textContent = durSlider.value;
volumeSlider.oninput = () => volumeValue.textContent = volumeSlider.value;


playBtn.addEventListener('click', () => {
  playSound(
    parseFloat(freqSlider.value),
    parseFloat(durSlider.value),
    waveformSelect.value,
    parseFloat(volumeSlider.value)
  );
});

function playSound(frequency, duration, type = 'sine', volume = 0.5) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  const dest = audioCtx.createMediaStreamDestination();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gainNode.gain.value = volume;

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  gainNode.connect(dest);

  mediaRecorder = new MediaRecorder(dest.stream);
  chunks = [];
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/wav' });
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'sound.wav';
    downloadLink.style.display = 'inline-block';
  };
  mediaRecorder.start();

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);

  setTimeout(() => mediaRecorder.stop(), duration * 1000);
  visualize(audioCtx, gainNode);
}

function playPreset(freq, dur, type) {
  playSound(freq, dur, type, parseFloat(volumeSlider.value));
}

function visualize(audioCtx, source) {
  const analyser = audioCtx.createAnalyser();
  source.connect(analyser);
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const ctx = canvas.getContext('2d');

  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i];
      ctx.fillStyle = `rgb(${barHeight + 50},100,200)`;
      ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
      x += barWidth + 1;
    }
  }
  draw();
}

const apiKey = 'yeXT4zxMyiJYNqexEsD1SZZOVAxP1IqUbMP4o9y0';

async function searchFreesound() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) return;
  const endpoint = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&fields=id,name,previews&token=${apiKey}`;
  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!data.results.length) {
      searchResults.innerHTML = '<p>No results found.</p>';
      return;
    }
    searchResults.innerHTML = '<div class="search-result-list"></div>';
    const list = searchResults.querySelector('.search-result-list');
    data.results.slice(0, 5).forEach((sound) => {
      const item = document.createElement('div');
      item.className = 'search-item';
      item.textContent = sound.name;
      item.onclick = () => loadSoundPlayer(sound);
      list.appendChild(item);
    });
  } catch (err) {
    console.error('Fetch error:', err);
    searchResults.innerHTML = '<p>Error fetching sounds.</p>';
  }
}

function loadSoundPlayer(sound) {
  searchResults.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'sound-card';
  const title = document.createElement('h3');
  title.textContent = sound.name;
  const audio = document.createElement('audio');
  audio.controls = true;
  const source = document.createElement('source');
  source.src = sound.previews['preview-lq-mp3'];
  source.type = 'audio/mpeg';
  audio.appendChild(source);

  const customizeBtn = document.createElement('button');
  customizeBtn.textContent = '▶️ Play with Custom Settings';
  customizeBtn.onclick = () => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    fetch(source.src)
      .then(res => res.arrayBuffer())
      .then(buf => audioCtx.decodeAudioData(buf))
      .then(decoded => {
        const bufferSource = audioCtx.createBufferSource();
        const gainNode = audioCtx.createGain();

        bufferSource.buffer = decoded;
        gainNode.gain.value = parseFloat(volumeSlider.value);
        bufferSource.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const duration = parseFloat(durSlider.value);
        bufferSource.start(0);
        bufferSource.stop(audioCtx.currentTime + duration);

        visualize(audioCtx, gainNode);
      });
  };

  card.appendChild(title);
  card.appendChild(audio);
  card.appendChild(customizeBtn);
  searchResults.appendChild(card);
}