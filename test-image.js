
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';

const apiKey = process.env.MODEL_API_KEY;

if (!apiKey) {
  console.error('MODEL_API_KEY is missing from .env.');
  process.exit(1);
}

try {
  console.log('Testing Muse Image access...');

  const response = await fetch(
    'https://api.meta.ai/v1/images/generations',
    {
      method: 'POST',
      signal: AbortSignal.timeout(120000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'muse-image-1.0',
        prompt:
          'Create a polished YouTube thumbnail background about AI tools for students. Bold, high-contrast composition, striking visual subject on the right, clean empty space on the left for a text overlay. No text, no letters, no logos. Wide 16:9 composition.',
        n: 1,
        size: '1792x1024',
        response_format: 'b64_json',
        output_format: 'webp',
      }),
    }
  );

  const raw = await response.text();

  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    console.error('Response was not valid JSON.');
    console.error('HTTP status:', response.status);
    console.error('Response preview:', raw.slice(0, 500));
    process.exit(1);
  }

  if (!response.ok) {
    console.error('Muse Image request failed.');
    console.error('HTTP status:', response.status);
    console.error('API error:', JSON.stringify(result.error ?? result));
    process.exit(1);
  }

  const imageData = result.data?.[0]?.b64_json;

  if (!imageData) {
    console.error('No base64 image was returned.');
    console.error('Response keys:', Object.keys(result));
    console.error('Data item keys:', Object.keys(result.data?.[0] ?? {}));
    process.exit(1);
  }

  await writeFile(
    'muse-image-test.webp',
    Buffer.from(imageData, 'base64')
  );

  console.log('SUCCESS: Muse Image returned an image.');
  console.log('Saved: muse-image-test.webp');
} catch (error) {
  console.error('Muse Image test failed:', error.message);
}
