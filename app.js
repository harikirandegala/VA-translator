/* ===================================================
   VA Translator — Application Logic
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
    downloadTranscript: $('#downloadTranscript'),

    errorBanner: $('#errorBanner'),
    errorText: $('#errorText'),
    dismissError: $('#dismissError'),

    toast: $('#toast'),
  };

  // Processing steps in order
  const processingSteps = [
    { el: els.stepExtract, name: 'Extracting audio from video...', duration: 2000 },
    { el: els.stepTranscribe, name: 'Transcribing speech to text...', duration: 3500 },
    { el: els.stepTranslate, name: 'Translating to target language...', duration: 2500 },
    { el: els.stepSynthesize, name: 'Generating translated audio...', duration: 3000 },
  ];

  // Demo transcript data
  const demoTranscripts = {
    en: "Welcome to this video tutorial. Today we'll explore the fundamentals of web development, including HTML structure, CSS styling, and JavaScript interactivity. These three technologies form the backbone of every modern website you visit. Let's get started with the basics and build something together.",
    es: "Bienvenidos a este tutorial en video. Hoy exploraremos los fundamentos del desarrollo web, incluyendo la estructura HTML, el estilo CSS y la interactividad JavaScript. Estas tres tecnologías forman la columna vertebral de cada sitio web moderno que visitas. Empecemos con lo básico y construyamos algo juntos.",
    fr: "Bienvenue dans ce tutoriel vidéo. Aujourd'hui, nous allons explorer les fondamentaux du développement web, y compris la structure HTML, le style CSS et l'interactivité JavaScript. Ces trois technologies forment l'épine dorsale de chaque site web moderne que vous visitez. Commençons par les bases et construisons quelque chose ensemble.",
    de: "Willkommen zu diesem Video-Tutorial. Heute werden wir die Grundlagen der Webentwicklung erkunden, einschließlich HTML-Struktur, CSS-Styling und JavaScript-Interaktivität. Diese drei Technologien bilden das Rückgrat jeder modernen Website, die Sie besuchen. Fangen wir mit den Grundlagen an und bauen etwas zusammen.",
    hi: "इस वीडियो ट्यूटोरियल में आपका स्वागत है। आज हम वेब डेवलपमेंट की मूल बातें जानेंगे, जिसमें HTML संरचना, CSS स्टाइलिंग और JavaScript इंटरैक्टिविटी शामिल है। ये तीन तकनीकें हर आधुनिक वेबसाइट की रीढ़ हैं जो आप देखते हैं। चलिए बुनियादी बातों से शुरू करते हैं और साथ मिलकर कुछ बनाते हैं।",
    ja: "このビデオチュートリアルへようこそ。今日はHTML構造、CSSスタイリング、JavaScriptのインタラクティビティなど、ウェブ開発の基礎を探ります。これら三つの技術は、あなたが訪れるすべてのモダンなウェブサイトの基盤を形成しています。基本から始めて、一緒に何かを作りましょう。",
    ko: "이 비디오 튜토리얼에 오신 것을 환영합니다. 오늘은 HTML 구조, CSS 스타일링, JavaScript 상호작용을 포함한 웹 개발의 기초를 살펴보겠습니다. 이 세 가지 기술은 여러분이 방문하는 모든 현대 웹사이트의 근간을 이룹니다. 기본부터 시작하여 함께 무언가를 만들어 봅시다.",
    ar: "مرحبًا بكم في هذا الدرس التعليمي المرئي. سنستكشف اليوم أساسيات تطوير الويب، بما في ذلك بنية HTML وتنسيق CSS وتفاعل JavaScript. تشكل هذه التقنيات الثلاث العمود الفقري لكل موقع ويب حديث تزوره. لنبدأ بالأساسيات ونبني شيئًا معًا.",
    zh: "欢迎来到本视频教程。今天我们将探索网页开发的基础知识，包括HTML结构、CSS样式和JavaScript交互性。这三种技术构成了您访问的每个现代网站的基础。让我们从基础开始，一起构建一些东西。",
    pt: "Bem-vindos a este tutorial em vídeo. Hoje vamos explorar os fundamentos do desenvolvimento web, incluindo estrutura HTML, estilização CSS e interatividade JavaScript. Essas três tecnologias formam a espinha dorsal de cada site moderno que você visita. Vamos começar com o básico e construir algo juntos.",
    it: "Benvenuti in questo tutorial video. Oggi esploreremo i fondamenti dello sviluppo web, tra cui la struttura HTML, lo stile CSS e l'interattività JavaScript. Queste tre tecnologie costituiscono la spina dorsale di ogni sito web moderno che visitate. Iniziamo con le basi e costruiamo qualcosa insieme.",
    ru: "Добро пожаловать в этот видеоурок. Сегодня мы рассмотрим основы веб-разработки, включая структуру HTML, стилизацию CSS и интерактивность JavaScript. Эти три технологии составляют основу каждого современного веб-сайта, который вы посещаете. Давайте начнём с основ и создадим что-нибудь вместе.",
    tr: "Bu video eğitimine hoş geldiniz. Bugün HTML yapısı, CSS stillendirmesi ve JavaScript etkileşimi dahil olmak üzere web geliştirmenin temellerini keşfedeceğiz. Bu üç teknoloji, ziyaret ettiğiniz her modern web sitesinin omurgasını oluşturur. Temellerle başlayalım ve birlikte bir şeyler inşa edelim.",
  };

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
      if (e.target.closest('.btn')) return; // let label handle it
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

    // Translate
    els.translateBtn.addEventListener('click', startTranslation);

    // New translation
    els.newTranslation.addEventListener('click', resetToInput);

    // Audio player
    els.playBtn.addEventListener('click', togglePlay);
    els.playerWaveform.addEventListener('click', seekAudio);

    // Downloads
    els.downloadAudio.addEventListener('click', handleDownloadAudio);
    els.downloadTranscript.addEventListener('click', handleDownloadTranscript);

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

    // Reset file selection when switching tabs
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
    // Validate file type
    const validTypes = [
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'video/x-matroska', 'video/webm',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
    ];

    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'ogg'];

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      showError('Unsupported file format. Please upload a video file (MP4, MOV, AVI, MKV, WebM) or audio file (MP3, WAV).');
      return;
    }

    // Validate size (500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      showError('File is too large. Maximum file size is 500 MB.');
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

    // Rotate the swap button
    els.swapLangs.style.transform = 'rotate(180deg)';
    setTimeout(() => {
      els.swapLangs.style.transform = '';
    }, 300);
  }

  // ---- Translation (Simulated) ----
  function startTranslation() {
    if (state.isProcessing) return;
    state.isProcessing = true;

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

    runProcessingSteps(0);
  }

  function runProcessingSteps(index) {
    if (index >= processingSteps.length) {
      // All steps done
      setTimeout(() => showResult(), 500);
      return;
    }

    const step = processingSteps[index];
    state.currentStep = index;

    // Mark as active
    step.el.classList.add('active');
    step.el.querySelector('.processing-step__status').textContent = 'Processing...';
    els.processingText.textContent = step.name;

    // Animate progress bar
    const startPercent = (index / processingSteps.length) * 100;
    const endPercent = ((index + 1) / processingSteps.length) * 100;

    animateProgress(startPercent, endPercent, step.duration, () => {
      // Mark as done
      step.el.classList.remove('active');
      step.el.classList.add('done');
      step.el.querySelector('.processing-step__status').textContent = 'Complete';

      // Next step
      runProcessingSteps(index + 1);
    });
  }

  function animateProgress(from, to, duration, callback) {
    const start = performance.now();
    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      els.progressFill.style.width = current + '%';

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        callback();
      }
    }
    requestAnimationFrame(frame);
  }

  // ---- Result Display ----
  function showResult() {
    state.isProcessing = false;
    state.currentStep = -1;

    els.processingView.hidden = true;
    els.resultView.hidden = false;

    // Get translated transcript
    const targetLang = els.targetLang.value;
    const transcript = demoTranscripts[targetLang] || demoTranscripts.en;
    els.transcriptText.textContent = transcript;

    // Update total time based on transcript length
    const estimatedSeconds = Math.max(20, Math.ceil(transcript.length / 15));
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

  // ---- Audio Player (uses browser SpeechSynthesis) ----
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

      const utterance = new SpeechSynthesisUtterance(text);
      const targetLang = els.targetLang.value;
      utterance.lang = targetLang === 'auto' ? 'en' : targetLang;
      utterance.rate = 0.95;
      utterance.pitch = 1;

      // Try to find a matching voice
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
      // Pseudo-random heights for a natural waveform look
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
      const elapsed = (now - waveformStartTime) / 1000; // seconds
      // Estimate: fill bars based on time
      const estimatedDuration = parseInt(els.totalTime.textContent.split(':')[0]) * 60 +
        parseInt(els.totalTime.textContent.split(':')[1]);
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
    // Visual seek only (speechSynthesis doesn't support seeking)
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
    showToast('Demo mode — in production, this downloads the translated MP3 file');

    // Create a small demo audio using Web Audio API
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const duration = 2;
      const sampleRate = audioCtx.sampleRate;
      const buffer = audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);

      // Generate a simple tone
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0.3 *
          Math.exp(-3 * i / data.length);
      }

      // Convert to WAV blob
      const wavBlob = bufferToWav(buffer);
      downloadBlob(wavBlob, 'translated_audio_demo.wav');
      audioCtx.close();
    } catch {
      // Fallback: download transcript as placeholder
      const text = els.transcriptText.textContent || 'Demo audio placeholder';
      const blob = new Blob([text], { type: 'text/plain' });
      downloadBlob(blob, 'translated_audio_demo.txt');
    }
  }

  function handleDownloadTranscript() {
    const text = els.transcriptText.textContent;
    if (!text) {
      showToast('No transcript available');
      return;
    }

    const targetLang = els.targetLang.value;
    const srtContent = generateSRT(text);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `transcript_${targetLang}.srt`);
    showToast('Transcript downloaded as SRT');
  }

  function generateSRT(text) {
    // Split text into sentences and create SRT entries
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let srt = '';
    let timeOffset = 0;

    sentences.forEach((sentence, i) => {
      const duration = Math.max(2, Math.ceil(sentence.trim().length / 15));
      const startTime = formatSRTTime(timeOffset);
      const endTime = formatSRTTime(timeOffset + duration);
      srt += `${i + 1}\n${startTime} --> ${endTime}\n${sentence.trim()}\n\n`;
      timeOffset += duration;
    });

    return srt;
  }

  function formatSRTTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s},000`;
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

  // Simple WAV encoder
  function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const dataLength = buffer.length * numChannels * (bitDepth / 8);
    const headerLength = 44;
    const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
    const view = new DataView(arrayBuffer);

    // WAV header
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

    // Write audio data
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // ---- Reset ----
  function resetToInput() {
    // Stop any speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    state.isSpeaking = false;
    state.isProcessing = false;
    state.selectedFile = null;
    state.videoUrl = '';

    // Reset file input
    els.fileInput.value = '';
    els.urlInput.value = '';
    els.uploadZone.hidden = false;
    els.fileInfo.hidden = true;

    // Switch views
    els.inputView.hidden = false;
    els.processingView.hidden = true;
    els.resultView.hidden = true;

    // Reset processing display
    els.progressFill.style.width = '0%';
    processingSteps.forEach((step) => {
      step.el.classList.remove('active', 'done');
      step.el.querySelector('.processing-step__status').textContent = 'Waiting...';
    });

    // Reset player
    resetWaveformProgress();
    updatePlayButton(false);

    validateInput();

    // Scroll to app section
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
    }, 3000);
  }

  // ---- Navigation ----
  function initNavScroll() {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      els.nav.classList.toggle('nav--scrolled', scrollY > 20);
      lastScroll = scrollY;
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

  // ---- Load voices for SpeechSynthesis ----
  if ('speechSynthesis' in window) {
    // Voices load asynchronously in some browsers
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  // ---- Boot ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
