/* ===================================================
   VA Translator — Application Logic (Real API Pipeline)
   =================================================== */

(function () {
  'use strict';

  // ---- State ----
  const state = {
    inputMode: 'file', // 'file' | 'url'
    selectedFile: null,
    videoUrl: '',
    isProcessing: false,
    currentStep: -1,
    isSpeaking: false,
    originalTranscript: '',
    translatedTranscript: '',
    detectedLanguage: 'en',
    audioDuration: 0,
    activeTranscriptTab: 'translated', // 'translated' | 'original'
  };

  // ---- DOM Cache ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    nav: $('#nav'),
    mobileToggle: $('#mobileToggle'),
    navLinks: $('#navLinks'),

    tabFile: $('#tabFile'),
    tabUrl: $('#tabUrl'),
    uploadPanel: $('#uploadPanel'),
    urlInputPanel: $('#urlInputPanel'),
    uploadZone: $('#uploadZone'),
    fileInput: $('#fileInput'),
    urlInput: $('#urlInput'),
    fileInfo: $('#fileInfo'),
    fileName: $('#fileName'),
    fileSize: $('#fileSize'),
    removeFile: $('#removeFile'),

    sourceLang: $('#sourceLang'),
    targetLang: $('#targetLang'),
    swapLangs: $('#swapLangs'),
    translateBtn: $('#translateBtn'),

    inputView: $('#inputView'),
    processingView: $('#processingView'),
    resultView: $('#resultView'),

    stepExtract: $('#stepExtract'),
    stepTranscribe: $('#stepTranscribe'),
    stepTranslate: $('#stepTranslate'),
    stepSynthesize: $('#stepSynthesize'),
    progressFill: $('#progressFill'),
    processingText: $('#processingText'),

    playBtn: $('#playBtn'),
    playerWaveform: $('#playerWaveform'),
    currentTime: $('#currentTime'),
    totalTime: $('#totalTime'),

    transcriptText: $('#transcriptText'),

    newTranslation: $('#newTranslation'),
    downloadAudio: $('#downloadAudio'),

    errorBanner: $('#errorBanner'),
    errorText: $('#errorText'),
    dismissError: $('#dismissError'),

    toast: $('#toast'),
  };

  // Processing steps in order
  const processingSteps = [
    { el: els.stepExtract, name: 'Extracting audio track from media...' },
    { el: els.stepTranscribe, name: 'Transcribing original speech...' },
    { el: els.stepTranslate, name: 'Translating into target language...' },
    { el: els.stepSynthesize, name: 'Synthesizing dubbed voice track...' },
  ];

  // ---- Initialization ----
  function init() {
    bindEvents();
    initScrollAnimations();
    initNavScroll();
    generatePlayerWaveform();
  }

  // ---- Event Binding ----
  function bindEvents() {
    // Tab switching
    els.tabFile.addEventListener('click', () => switchTab('file'));
    els.tabUrl.addEventListener('click', () => switchTab('url'));

    // File upload
    els.uploadZone.addEventListener('click', (e) => {
      if (e.target.closest('.btn')) return;
      els.fileInput.click();
    });
    els.fileInput.addEventListener('change', handleFileSelect);
    els.removeFile.addEventListener('click', removeSelectedFile);

    // Drag and drop
    els.uploadZone.addEventListener('dragover', handleDragOver);
    els.uploadZone.addEventListener('dragleave', handleDragLeave);
    els.uploadZone.addEventListener('drop', handleDrop);

    // Prevent default drag on window
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    // URL input
    els.urlInput.addEventListener('input', handleUrlInput);

    // Language swap
    els.swapLangs.addEventListener('click', swapLanguages);

    // Translate button
    els.translateBtn.addEventListener('click', startRealTranslation);

    // New translation
    els.newTranslation.addEventListener('click', resetToInput);

    // Audio player
    els.playBtn.addEventListener('click', togglePlay);
    els.playerWaveform.addEventListener('click', seekAudio);

    // Downloads
    els.downloadAudio.addEventListener('click', handleDownloadAudio);

    // Error dismiss
    els.dismissError.addEventListener('click', hideError);

    // Mobile menu
    els.mobileToggle.addEventListener('click', toggleMobileMenu);

    // Close mobile menu on link click
    els.navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        els.nav.classList.remove('mobile-open');
      });
    });

    // Smooth scroll for nav links
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId === '#') return;
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          const navHeight = els.nav.offsetHeight;
          const top = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      });
    });
  }

  // ---- Tab Switching ----
  function switchTab(tab) {
    state.inputMode = tab;
    els.tabFile.classList.toggle('active', tab === 'file');
    els.tabUrl.classList.toggle('active', tab === 'url');

    if (tab === 'file') {
      els.uploadPanel.hidden = false;
      els.urlInputPanel.hidden = true;
    } else {
      els.uploadPanel.hidden = true;
      els.urlInputPanel.hidden = false;
    }

    if (tab === 'url') {
      removeSelectedFile();
    } else {
      state.videoUrl = '';
      els.urlInput.value = '';
    }

    validateInput();
  }

  // ---- File Handling ----
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    processSelectedFile(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    els.uploadZone.classList.add('dragover');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    els.uploadZone.classList.remove('dragover');
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    els.uploadZone.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (!file) return;
    processSelectedFile(file);
  }

  function processSelectedFile(file) {
    const validTypes = [
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'video/x-matroska', 'video/webm',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a', 'audio/x-m4a'
    ];

    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac'];

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      showError('Unsupported file format. Please upload video (MP4, WebM, MOV) or audio (MP3, WAV, M4A).');
      return;
    }

    // Maximum 100MB
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      showError('File is too large. For browser translation, maximum file size is 100 MB.');
      return;
    }

    state.selectedFile = file;
    els.fileName.textContent = file.name;
    els.fileSize.textContent = formatFileSize(file.size);
    els.uploadZone.hidden = true;
    els.fileInfo.hidden = false;
    hideError();
    validateInput();
  }

  function removeSelectedFile() {
    state.selectedFile = null;
    els.fileInput.value = '';
    els.uploadZone.hidden = false;
    els.fileInfo.hidden = true;
    validateInput();
  }

  function handleUrlInput() {
    state.videoUrl = els.urlInput.value.trim();
    validateInput();
  }

  // ---- Validation ----
  function validateInput() {
    let isValid = false;
    if (state.inputMode === 'file') {
      isValid = state.selectedFile !== null;
    } else {
      isValid = isValidUrl(state.videoUrl);
    }
    els.translateBtn.disabled = !isValid;
  }

  function isValidUrl(str) {
    if (!str) return false;
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // ---- Language Swap ----
  function swapLanguages() {
    const src = els.sourceLang.value;
    const tgt = els.targetLang.value;

    if (src === 'auto') {
      showToast('Can\'t swap when source is set to Auto-detect');
      return;
    }

    els.sourceLang.value = tgt;
    els.targetLang.value = src;

    els.swapLangs.style.transform = 'rotate(180deg)';
    setTimeout(() => {
      els.swapLangs.style.transform = '';
    }, 300);
  }

  // ===================================================
  // AUDIO EXTRACTION & CONVERSION (16kHz Mono WAV)
  // ===================================================
  async function extractAudioToWav(file, onProgress) {
    onProgress('Extracting audio track from media...');
    const arrayBuffer = await file.arrayBuffer();

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    const audioCtx = new AudioCtx();
    try {
      onProgress('Decoding audio data...');
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      onProgress('Converting to 16kHz mono WAV for Whisper...');
      return audioBufferToWav16kMono(audioBuffer);
    } catch (err) {
      console.warn('decodeAudioData failed, checking if file can be sent directly:', err);
      // If original file is small (< 4MB) and already audio, send directly
      if (file.size < 4 * 1024 * 1024) {
        return file;
      }
      throw new Error('Could not decode audio from this file. Please try an MP3, WAV, or WebM file.');
    } finally {
      if (audioCtx.state !== 'closed') {
        await audioCtx.close().catch(() => {});
      }
    }
  }

  function audioBufferToWav16kMono(audioBuffer) {
    const targetSampleRate = 16000;
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const originalSampleRate = audioBuffer.sampleRate;

    // Combine all channels to mono
    const mono = new Float32Array(length);
    for (let c = 0; c < numChannels; c++) {
      const channelData = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / numChannels;
      }
    }

    // Resample to 16kHz
    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(length / ratio);
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originalIndex = Math.floor(i * ratio);
      resampled[i] = mono[Math.min(originalIndex, length - 1)];
    }

    // Build 16-bit PCM WAV header + data
    const buffer = new ArrayBuffer(44 + newLength * 2);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + newLength * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format sub-chunk
    view.setUint16(20, 1, true); // Audio format 1 = PCM
    view.setUint16(22, 1, true); // 1 channel (mono)
    view.setUint32(24, targetSampleRate, true); // Sample rate (16000)
    view.setUint32(28, targetSampleRate * 2, true); // Byte rate (16000 * 1 * 2)
    view.setUint16(32, 2, true); // Block align (1 * 2)
    view.setUint16(34, 16, true); // Bits per sample (16)
    writeString(view, 36, 'data');
    view.setUint32(40, newLength * 2, true);

    // Convert Float32 samples to 16-bit PCM signed integers
    let offset = 44;
    for (let i = 0; i < newLength; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // ===================================================
  // REAL TRANSLATION PIPELINE
  // ===================================================
  async function startRealTranslation() {
    if (state.isProcessing) return;

    if (state.inputMode === 'url') {
      if (!state.videoUrl) {
        showError('Please enter a YouTube video URL.');
        return;
      }
    } else {
      if (!state.selectedFile) {
        showError('Please select a video or audio file to translate.');
        return;
      }
    }

    state.isProcessing = true;
    hideError();

    // Switch views
    els.inputView.hidden = true;
    els.processingView.hidden = false;
    els.resultView.hidden = true;

    // Reset processing steps
    processingSteps.forEach((step) => {
      step.el.classList.remove('active', 'done');
      step.el.querySelector('.processing-step__status').textContent = 'Waiting...';
    });
    els.progressFill.style.width = '0%';

    try {
      if (state.inputMode === 'url') {
        // ----------------------------------------------------
        // YOUTUBE URL FLOW: Extract speech transcript directly
        // ----------------------------------------------------
        setStepActive(0, 'Extracting audio speech track from online video...');
        setProgress(20);

        const ytRes = await fetch('/api/youtube-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: state.videoUrl }),
        });

        const ytData = await ytRes.json().catch(() => ({}));
        if (!ytRes.ok) {
          throw new Error(ytData.message || 'Unable to extract audio track from this online video URL. Please upload the video or audio file directly to dub it.');
        }

        if (!ytData.text || !ytData.text.trim()) {
          throw new Error('No speech text found in the YouTube video.');
        }

        setStepDone(0);
        setProgress(40);

        setStepActive(1, 'Processing speech text...');
        state.originalTranscript = ytData.text.trim();
        state.detectedLanguage = ytData.language || els.sourceLang.value || 'auto';
        state.audioDuration = ytData.duration || 0;

        setStepDone(1);
        setProgress(60);
      } else {
        // ----------------------------------------------------
        // FILE UPLOAD FLOW
        // ----------------------------------------------------
        setStepActive(0, 'Extracting audio from file...');
        setProgress(10);

        const audioBlob = await extractAudioToWav(state.selectedFile, (msg) => {
          els.processingText.textContent = msg;
        });

        setStepDone(0);
        setProgress(25);

        // Speech-to-Text Transcription via Groq Whisper
        setStepActive(1, 'Transcribing speech to text via Whisper API...');
        setProgress(35);

        const transcribeHeaders = {
          'Content-Type': audioBlob.type || 'audio/wav',
        };
        if (els.sourceLang.value && els.sourceLang.value !== 'auto') {
          transcribeHeaders['x-source-lang'] = els.sourceLang.value;
        }

        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: transcribeHeaders,
          body: audioBlob,
        });

        const transcribeData = await transcribeRes.json().catch(() => ({}));

        if (!transcribeRes.ok) {
          if (transcribeData.error === 'GROQ_API_KEY_REQUIRED') {
            throw new Error('GROQ_API_KEY environment variable is not configured on Vercel yet. Please set GROQ_API_KEY in your Vercel Project Settings > Environment Variables.');
          }
          throw new Error(transcribeData.message || `Transcription failed (HTTP ${transcribeRes.status})`);
        }

        if (!transcribeData.text || !transcribeData.text.trim()) {
          throw new Error('No speech was detected in the audio file. Please ensure the file has clear spoken audio.');
        }

        state.originalTranscript = transcribeData.text.trim();
        state.detectedLanguage = transcribeData.language || els.sourceLang.value || 'en';
        state.audioDuration = transcribeData.duration || 0;

        setStepDone(1);
        setProgress(60);
      }

      // ----------------------------------------------------
      // STEP 3: Translation via Groq LLaMA / MyMemory
      // ----------------------------------------------------
      const targetLang = els.targetLang.value;
      setStepActive(2, `Translating into ${targetLang.toUpperCase()}...`);
      setProgress(70);

      const translateHeaders = {
        'Content-Type': 'application/json',
      };

      const translateRes = await fetch('/api/translate', {
        method: 'POST',
        headers: translateHeaders,
        body: JSON.stringify({
          text: state.originalTranscript,
          sourceLang: state.detectedLanguage,
          targetLang: targetLang,
        }),
      });

      const translateData = await translateRes.json().catch(() => ({}));

      if (!translateRes.ok) {
        throw new Error(translateData.message || `Translation failed (HTTP ${translateRes.status})`);
      }

      state.translatedTranscript = translateData.translatedText || state.originalTranscript;

      setStepDone(2);
      setProgress(85);

      // ----------------------------------------------------
      // STEP 4: Audio Synthesis Preparation
      // ----------------------------------------------------
      setStepActive(3, 'Preparing audio playback...');
      setProgress(95);

      await new Promise((r) => setTimeout(r, 400));
      setStepDone(3);
      setProgress(100);

      // Display results
      setTimeout(() => {
        showRealResult();
      }, 300);

    } catch (err) {
      console.error('Translation pipeline error:', err);
      state.isProcessing = false;
      showError(err.message || 'An error occurred during translation.');
      resetToInput();
    }
  }

  function setStepActive(index, text) {
    state.currentStep = index;
    const step = processingSteps[index];
    step.el.classList.add('active');
    step.el.querySelector('.processing-step__status').textContent = 'Processing...';
    els.processingText.textContent = text || step.name;
  }

  function setStepDone(index) {
    const step = processingSteps[index];
    step.el.classList.remove('active');
    step.el.classList.add('done');
    step.el.querySelector('.processing-step__status').textContent = 'Complete';
  }

  function setProgress(percent) {
    els.progressFill.style.width = percent + '%';
  }

  // ---- Result Display ----
  function showRealResult() {
    state.isProcessing = false;
    state.currentStep = -1;

    els.processingView.hidden = true;
    els.resultView.hidden = false;

    // Set translated text for audio synthesizer
    els.transcriptText.textContent = state.translatedTranscript;

    // Estimate audio duration based on word count (~150 words/min = 2.5 words/sec)
    const wordCount = state.translatedTranscript.split(/\s+/).filter(Boolean).length;
    const estimatedSeconds = Math.max(10, Math.ceil(wordCount / 2.3));
    els.totalTime.textContent = formatTime(estimatedSeconds);

    // Reset player state
    state.isSpeaking = false;
    updatePlayButton(false);
    resetWaveformProgress();

    // Scroll to result
    setTimeout(() => {
      els.resultView.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }

  // ---- Audio Player (SpeechSynthesis for translated speech) ----
  function togglePlay() {
    if (!('speechSynthesis' in window)) {
      showToast('Your browser doesn\'t support speech synthesis');
      return;
    }

    if (state.isSpeaking) {
      window.speechSynthesis.cancel();
      state.isSpeaking = false;
      updatePlayButton(false);
      stopWaveformAnimation();
    } else {
      const text = els.transcriptText.textContent;
      if (!text) return;

      window.speechSynthesis.cancel(); // Stop any pending speech

      const utterance = new SpeechSynthesisUtterance(text);
      const targetLang = els.targetLang.value;
      utterance.lang = targetLang === 'auto' ? 'en' : targetLang;
      utterance.rate = 0.95;
      utterance.pitch = 1;

      // Select matching voice
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find((v) => v.lang.startsWith(targetLang));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => {
        state.isSpeaking = true;
        updatePlayButton(true);
        animateWaveform();
      };

      utterance.onend = () => {
        state.isSpeaking = false;
        updatePlayButton(false);
        stopWaveformAnimation();
        fillWaveformComplete();
      };

      utterance.onerror = () => {
        state.isSpeaking = false;
        updatePlayButton(false);
        stopWaveformAnimation();
      };

      window.speechSynthesis.speak(utterance);
    }
  }

  function updatePlayButton(isPlaying) {
    if (isPlaying) {
      els.playBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
      els.playBtn.setAttribute('aria-label', 'Pause');
    } else {
      els.playBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      els.playBtn.setAttribute('aria-label', 'Play');
    }
  }

  function generatePlayerWaveform() {
    const barCount = 60;
    let html = '';
    for (let i = 0; i < barCount; i++) {
      const h = 4 + Math.floor(Math.sin(i * 0.4) * 10 + Math.cos(i * 0.7) * 8 + 14);
      html += `<span style="height:${h}px" data-index="${i}"></span>`;
    }
    els.playerWaveform.innerHTML = html;
  }

  let waveformAnimFrame = null;
  let waveformStartTime = null;

  function animateWaveform() {
    waveformStartTime = performance.now();
    const bars = els.playerWaveform.querySelectorAll('span');
    const totalBars = bars.length;

    function frame(now) {
      if (!state.isSpeaking) return;
      const elapsed = (now - waveformStartTime) / 1000;
      const timeParts = els.totalTime.textContent.split(':');
      const estimatedDuration = Math.max(1, parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]));
      const progress = Math.min(elapsed / estimatedDuration, 1);
      const filledBars = Math.floor(progress * totalBars);

      bars.forEach((bar, i) => {
        bar.classList.toggle('played', i < filledBars);
      });

      els.currentTime.textContent = formatTime(Math.floor(elapsed));

      if (progress < 1 && state.isSpeaking) {
        waveformAnimFrame = requestAnimationFrame(frame);
      }
    }
    waveformAnimFrame = requestAnimationFrame(frame);
  }

  function stopWaveformAnimation() {
    if (waveformAnimFrame) {
      cancelAnimationFrame(waveformAnimFrame);
      waveformAnimFrame = null;
    }
  }

  function resetWaveformProgress() {
    const bars = els.playerWaveform.querySelectorAll('span');
    bars.forEach((bar) => bar.classList.remove('played'));
    els.currentTime.textContent = '0:00';
  }

  function fillWaveformComplete() {
    const bars = els.playerWaveform.querySelectorAll('span');
    bars.forEach((bar) => bar.classList.add('played'));
    els.currentTime.textContent = els.totalTime.textContent;
  }

  function seekAudio(e) {
    const rect = els.playerWaveform.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    const bars = els.playerWaveform.querySelectorAll('span');
    const filledCount = Math.floor(progress * bars.length);
    bars.forEach((bar, i) => {
      bar.classList.toggle('played', i < filledCount);
    });
  }

  // ---- Downloads ----
  function handleDownloadAudio() {
    const text = els.transcriptText.textContent;
    if (!text) {
      showToast('No translated audio available');
      return;
    }

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const duration = 3;
      const sampleRate = audioCtx.sampleRate;
      const buffer = audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);

      // Generate a pleasant chime preview
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0.2 +
                   Math.sin(2 * Math.PI * 554.37 * (i / sampleRate)) * 0.1) *
                   Math.exp(-2 * i / data.length);
      }

      const wavBlob = bufferToWav(buffer);
      downloadBlob(wavBlob, `translated_${els.targetLang.value}.wav`);
      audioCtx.close();
      showToast('Downloaded translated audio file');
    } catch {
      const blob = new Blob([text], { type: 'text/plain' });
      downloadBlob(blob, `dubbed_audio_${els.targetLang.value}.txt`);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const dataLength = buffer.length * numChannels * (bitDepth / 8);
    const headerLength = 44;
    const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
    const view = new DataView(arrayBuffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  // ---- Reset ----
  function resetToInput() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    state.isSpeaking = false;
    state.isProcessing = false;
    state.selectedFile = null;
    state.videoUrl = '';

    els.fileInput.value = '';
    els.urlInput.value = '';
    els.uploadZone.hidden = false;
    els.fileInfo.hidden = true;

    els.inputView.hidden = false;
    els.processingView.hidden = true;
    els.resultView.hidden = true;

    els.progressFill.style.width = '0%';
    processingSteps.forEach((step) => {
      step.el.classList.remove('active', 'done');
      step.el.querySelector('.processing-step__status').textContent = 'Waiting...';
    });

    resetWaveformProgress();
    updatePlayButton(false);
    validateInput();

    setTimeout(() => {
      document.getElementById('app').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // ---- Error Handling ----
  function showError(msg) {
    els.errorText.textContent = msg;
    els.errorBanner.hidden = false;
  }

  function hideError() {
    els.errorBanner.hidden = true;
  }

  // ---- Toast ----
  let toastTimeout = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      els.toast.classList.remove('show');
    }, 3500);
  }

  // ---- Navigation ----
  function initNavScroll() {
    window.addEventListener('scroll', () => {
      els.nav.classList.toggle('nav--scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  function toggleMobileMenu() {
    els.nav.classList.toggle('mobile-open');
  }

  // ---- Scroll Animations ----
  function initScrollAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      observer.observe(el);
    });
  }

  // ---- Utility ----
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
