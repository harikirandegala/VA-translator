import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { url } = body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing YouTube URL' });
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return res.status(400).json({
        error: 'INVALID_URL',
        message: 'Could not recognize YouTube URL. Please provide a valid youtube.com or youtu.be link.',
      });
    }

    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId).catch((err) => {
      throw new Error(
        'Could not extract captions from this YouTube video. The video might not have public captions enabled.'
      );
    });

    if (!transcriptItems || transcriptItems.length === 0) {
      return res.status(404).json({
        error: 'NO_CAPTIONS',
        message: 'No captions or speech transcript found for this YouTube video.',
      });
    }

    // Clean and join text
    const fullText = transcriptItems
      .map((item) => decodeHtmlEntities(item.text))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const detectedLang = transcriptItems[0]?.lang || 'auto';

    return res.status(200).json({
      videoId,
      text: fullText,
      language: detectedLang,
      duration: Math.ceil(
        (transcriptItems[transcriptItems.length - 1]?.offset +
          (transcriptItems[transcriptItems.length - 1]?.duration || 0)) /
          1000
      ),
      itemsCount: transcriptItems.length,
    });
  } catch (error) {
    console.error('YouTube transcript error:', error);
    return res.status(500).json({
      error: 'TRANSCRIPT_FAILED',
      message: error.message || 'Failed to fetch YouTube transcript',
    });
  }
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('?')[0];
    }
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1].split('?')[0];
      }
      return parsed.searchParams.get('v');
    }
  } catch {
    // regex fallback
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  }
  return null;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
