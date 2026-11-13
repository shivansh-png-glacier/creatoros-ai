
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sharp from 'sharp';

const app = express();
// Behind Render/Vercel the real client IP arrives in X-Forwarded-For.
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '40kb' }));

// Basic per-IP rate limiting for the AI endpoints, so one visitor can't
// burn through the Meta API credits. 30 AI requests per IP per hour.
const AI_RATE_LIMIT = 30;
const AI_RATE_WINDOW_MS = 60 * 60 * 1000;
const aiRequestCounts = new Map();

function aiRateLimit(req, res, next) {
  const now = Date.now();
  const entry = aiRequestCounts.get(req.ip) || { count: 0, resetAt: now + AI_RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + AI_RATE_WINDOW_MS;
  }
  entry.count += 1;
  aiRequestCounts.set(req.ip, entry);
  if (entry.count > AI_RATE_LIMIT) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many requests. Please wait a little and try again.'
    });
  }
  next();
}

const port = Number(process.env.PORT || 8787);
const apiKey = process.env.MODEL_API_KEY;
const model = process.env.MODEL_API_MODEL || 'muse-spark-1.3';


const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      const retryable =
        error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error.cause?.code === 'ECONNRESET' ||
        error.cause?.code === 'ECONNREFUSED';

      if (!retryable || attempt >= retries) {
        throw error;
      }

      const delay = 1000 * (attempt + 1);
      console.warn(
        `Meta request failed (${error.message}). Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(apiKey),
    provider: 'Meta Model API',
    message: apiKey
      ? 'Meta Model API is configured.'
      : 'Add MODEL_API_KEY to your .env file.'
  });
});

const clean = (value, max = 500) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

app.post('/api/generate', aiRateLimit, async (req, res) => {
  console.log('Received /api/generate request');

  const topic = clean(req.body?.topic, 500);
  const platform = clean(req.body?.platform, 40) || 'Instagram';
  const audience = clean(req.body?.audience, 120) || 'content creators';
  const tone = clean(req.body?.tone, 80) || 'Bold and useful';
  const goal = clean(req.body?.goal, 100) || 'Grow an engaged audience';

  if (topic.length < 4) {
    return res.status(400).json({
      error: 'Please enter a more specific content idea.'
    });
  }

  if (!apiKey) {
    return res.status(503).json({
      error: 'Meta API key is missing. Add MODEL_API_KEY to your .env file.'
    });
  }

  try {
    const response = await fetchWithRetry('https://api.meta.ai/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(60000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
instructions: `You are CreatorOS, a senior social content strategist and platform-native copywriter.

Create campaigns that are specific, useful, and ready for creators to publish after light editing.

STRATEGY:
- Adapt every output to the exact topic, audience, platform, tone, and goal.
- Use specific problems, desires, misconceptions, and practical outcomes.
- Never invent statistics, testimonials, personal stories, or results.
- Never promise guaranteed views, reach, leads, or sales.
- Avoid generic motivational language and empty hype.
- Make all three hooks genuinely different.
- Make the caption useful, with practical insights, steps, or examples.
- Make the CTA one clear action aligned with the campaign goal.
- Keep the tone consistent across every output.

PLATFORM RULES:
- Instagram: strong first line, readable paragraphs, save-worthy value, and natural conversation.
- YouTube: compelling video angle, clear viewer payoff, and useful video description.
- LinkedIn: professional human perspective, practical insights, and meaningful discussion.
- TikTok: immediate spoken hook, one focused idea, and concise copy.
- X: concise, sharp standalone post or coherent thread concept.

GOAL RULES:
- Awareness: discoverability and shareable value.
- Engagement: meaningful replies, opinions, and experiences.
- Leads: relevant next steps or resources.
- Sales: connect audience problems to product value and an honest next step.

OUTPUT:
Return valid JSON only. No Markdown fences.
Use exactly these fields:
title (string)
topic (string)
platform (string)
hooks (array of exactly 3 strings)
caption (string)
cta (string)
ideas (array of exactly 3 strings)
thumbnail (string, maximum 8 words)

All content must belong to the same campaign. Do not add extra fields.`,

        input: JSON.stringify({ topic, platform, audience, tone, goal }),
        temperature: 0.8,
        max_output_tokens: 4000
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta API error:', response.status, result.error?.message);
      return res.status(502).json({
        error: result.error?.message ||
          `Meta API request failed (${response.status}). Check your key, model and API access.`
      });
    }
    
    const text =
      result.output_text ||
      (result.output || [])
        .filter(item => item.type === 'message')
        .flatMap(item => item.content || [])
        .filter(part =>
          part.type === 'output_text' ||
          typeof part.text === 'string'
        )
        .map(part => part.text || '')
        .join('')
        .trim();

    if (!text) {
      console.error('Meta returned no text:', JSON.stringify({
        status: result.status,
        outputTypes: (result.output || []).map(item => item.type),
        contentTypes: (result.output || [])
          .flatMap(item => item.content || [])
          .map(part => part.type),
        incompleteDetails: result.incomplete_details,
        error: result.error
      }));

      return res.status(502).json({
        error: 'Meta did not return campaign text. Please try again.',
        status: result.status || 'unknown'
      });
    }

        let campaign;

    try {
      const jsonText = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      campaign = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Meta returned invalid campaign JSON:', parseError.message);

      throw new Error('The AI returned invalid campaign data. Please generate again.');
    }

    if (!campaign || typeof campaign !== 'object' || Array.isArray(campaign)) {
      throw new Error('The AI returned an invalid campaign structure.');
    }

    const requiredText = ['title', 'caption', 'cta', 'thumbnail'];

    const hasRequiredText = requiredText.every(
      key => typeof campaign[key] === 'string' && campaign[key].trim().length > 0
    );

    const hasThreeHooks =
      Array.isArray(campaign.hooks) &&
      campaign.hooks.length === 3 &&
      campaign.hooks.every(
        item => typeof item === 'string' && item.trim().length > 0
      );

    const hasThreeIdeas =
      Array.isArray(campaign.ideas) &&
      campaign.ideas.length === 3 &&
      campaign.ideas.every(
        item => typeof item === 'string' && item.trim().length > 0
      );

    const thumbnailWordCount =
      typeof campaign.thumbnail === 'string'
        ? campaign.thumbnail.trim().split(/\s+/).filter(Boolean).length
        : 0;

    if (
      !hasRequiredText ||
      !hasThreeHooks ||
      !hasThreeIdeas ||
      thumbnailWordCount > 8
    ) {
      console.error('Meta returned an invalid campaign structure.');
      throw new Error(
        'The AI returned incomplete campaign content. Please generate again.'
      );
    }

    const normalizedCampaign = {
      ...campaign,
      title: campaign.title.trim(),
      topic,
      platform,
      hooks: campaign.hooks.map(item => item.trim()),
      caption: campaign.caption.trim(),
      cta: campaign.cta.trim(),
      ideas: campaign.ideas.map(item => item.trim()),
      thumbnail: campaign.thumbnail.trim()
    };

    return res.json({
      mode: 'meta',
      campaign: normalizedCampaign
    });

  } catch (error) {
    console.error('Campaign generation failed:', error);

    if (!res.headersSent && !res.destroyed) {
      const timedOut = error.name === 'TimeoutError';

      return res.status(timedOut ? 504 : 502).json({
        error: timedOut
          ? 'Meta took too long to respond. Please try again.'
          : 'Campaign generation failed. Check the backend terminal for details.',
        details: error.message
      });
    }
  }
});


app.post('/api/generate-thumbnail', aiRateLimit, async (req, res) => {
  const topic = clean(req.body?.topic, 500);
  const platform = clean(req.body?.platform, 40) || 'YouTube';
  const thumbnailText = clean(req.body?.thumbnail, 80);
  const audience = clean(req.body?.audience, 120) || 'general audience';
  const tone = clean(req.body?.tone, 80) || 'bold and engaging';
  const goal = clean(req.body?.goal, 100) || 'increase audience interest';
  const editPrompt = clean(req.body?.editPrompt, 500);

  if (topic.length < 4) {
    return res.status(400).json({
      error: 'Please provide a more specific topic.'
    });
  }

  if (!apiKey) {
    return res.status(503).json({
      error: 'Meta API key is missing.'
    });
  }

  try {
    const response = await fetchWithRetry(
      'https://api.meta.ai/v1/images/generations',
      {
        method: 'POST',
        signal: AbortSignal.timeout(120000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'muse-image-1.0',
          prompt: `Create a professional, visually striking thumbnail background for ${platform} about: ${topic}.

          Target audience: ${audience}.
          Creative energy and tone: ${tone}.
          Campaign goal: ${goal}.
          Headline to support: ${thumbnailText || 'Create visual space for a short headline'}.
          ${editPrompt ? `USER'S IMAGE CHANGE INSTRUCTIONS: ${editPrompt}. Follow these instructions as the main visual direction while keeping the campaign topic and platform relevant.` : ''}

          Design the visual specifically for this audience and platform. Make it emotionally engaging and professionally art-directed, with one clear focal subject.

          COMPOSITION: Keep the main subject near the centre of the image, both horizontally and vertically. Keep important details within the central 35% of the image width so they survive portrait and landscape crops. Avoid placing the subject near the outer edges.

          Leave uncluttered space around the subject for a headline overlay. Do not render text, letters, numbers, watermarks or logos.`,
          
          n: 1,
          size: '1792x1024',
          response_format: 'b64_json',
          output_format: 'webp'
        })
      }
    );

    const raw = await response.text();

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      console.error('Muse Image returned invalid JSON.');
      return res.status(502).json({
        error: 'Muse Image returned an invalid response.'
      });
    }

    if (!response.ok) {
      console.error(
        'Muse Image API error:',
        response.status,
        JSON.stringify(result.error || result).slice(0, 1000)
      );

      return res.status(502).json({
        error: result.error?.message ||
          `Muse Image request failed (${response.status}).`
      });
    }

    const platformFormats = {
      Instagram: { width: 1080, height: 1350 },
      YouTube: { width: 1280, height: 720 },
      LinkedIn: { width: 1200, height: 627 },
      TikTok: { width: 1080, height: 1920 },
      X: { width: 1200, height: 675 }
    };

    const format = platformFormats[platform] || platformFormats.YouTube;

    const imageData = result.data?.[0]?.b64_json;

    if (!imageData) {
      return res.status(502).json({
        error: 'Muse Image did not return image data.'
      });
    }

    const resizedImage = await sharp(Buffer.from(imageData, 'base64'))
      .resize(format.width, format.height, {
        fit: 'cover',
        position: 'attention'
      })
      .webp({ quality: 85 })
      .toBuffer();

    return res.json({
      image: `data:image/webp;base64,${resizedImage.toString('base64')}`,
      width: format.width,
      height: format.height,
      platform
    });
  } catch (error) {
    console.error('Thumbnail generation failed:', error);

    return res.status(
      error.name === 'TimeoutError' ? 504 : 502
    ).json({
      error: error.name === 'TimeoutError'
        ? 'Thumbnail generation timed out. Please try again.'
        : 'Thumbnail generation failed. Check the backend terminal.'
    });
  }
});

app.listen(port, () => {
  console.log(`CreatorOS API running at http://localhost:${port}`);
  console.log(
    apiKey
      ? `Meta mode enabled (${model}).`
      : 'Meta API key missing.'
  );
});
