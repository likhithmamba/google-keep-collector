import { AppSettings, VideoItem } from '../types';
import { trackRequest } from './tokenTracker';

// Extract YouTube video ID
export function extractVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Client-side helper to fetch YouTube video metadata using oEmbed
async function fetchYoutubeOembed(videoId: string): Promise<{ title: string; author_name: string; thumbnail_url: string } | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn("Failed to fetch oEmbed metadata client-side:", e);
  }
  return null;
}

// Client-side Gemini Summary Generator
export async function generateSummary(
  url: string,
  settings: AppSettings,
  isBulkImport: boolean = false
): Promise<VideoItem> {
  const videoId = extractVideoId(url) || "";
  const isYouTube = videoId !== "";

  // 1. Resolve API Keys
  const apiKey = settings.useOpenRouter ? settings.openRouterApiKey : (settings.customGeminiApiKey || ((import.meta as any).env.VITE_GEMINI_API_KEY as string));
  
  if (!apiKey) {
    throw new Error("API Key Required: Please open the App Settings (gear icon) and paste your Gemini API Key or OpenRouter API Key to start analyzing resources!");
  }

  // 2. Fetch Metadata Hints
  let defaultTitle = "Web Resource";
  let defaultChannelTitle = "External Link";
  let defaultThumbnail = "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=400&q=80";

  if (isYouTube) {
    defaultThumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    const oembed = await fetchYoutubeOembed(videoId);
    if (oembed) {
      defaultTitle = oembed.title || defaultTitle;
      defaultChannelTitle = oembed.author_name || defaultChannelTitle;
      defaultThumbnail = oembed.thumbnail_url || defaultThumbnail;
    }
  } else {
    try {
      const parsedUrl = new URL(url);
      defaultChannelTitle = parsedUrl.hostname.replace('www.', '');
      defaultTitle = parsedUrl.pathname.split('/').pop() || parsedUrl.hostname;
      defaultTitle = defaultTitle.replace(/[-_]/g, ' ');
      if (defaultTitle.length > 40) defaultTitle = defaultTitle.substring(0, 40) + '...';
      defaultTitle = defaultTitle.charAt(0).toUpperCase() + defaultTitle.slice(1);
    } catch (e) {}
  }

  const prompt = isBulkImport ? 
    `Rapidly analyze this resource link and generate a fast, lightweight summary.
Resource URL: "${url}"
Is YouTube Video: ${isYouTube ? "Yes" : "No"}
Pre-parsed Host Hint: "${defaultChannelTitle}"
Pre-parsed Title Hint: "${defaultTitle}"

Please provide a highly compact, lightweight analysis to save tokens:
1. Determine a clear educational title.
2. Determine the creator name.
3. Select a matching category.
4. Write a brief 1-paragraph summary.
5. Provide 2-3 concept tags (e.g., 'Web Development', 'UI Design').
6. Rating (1-5) and a short 1-sentence justification.
7. Provide exactly 2 bullet takeaways.
8. Clickbait buster: 1 short sentence on actual purpose and 1 sentence comparison.` :
    `Analyze this educational resource link and generate a structured summary, categorization, star rating (1-5), and key takeaways.
Resource URL: "${url}"
Is YouTube Video: ${isYouTube ? "Yes" : "No"}
Pre-parsed Host Hint: "${defaultChannelTitle}"
Pre-parsed Title Hint: "${defaultTitle}"

Please provide a highly complete analysis of this resource:
1. Determine an educational, clear title (e.g. "Understanding Fourier Transforms" or "Building Clean Web APIs").
2. Determine the creator, author, channel, or publishing organization name (e.g., "Medium", "Veritasium", "Coursera", or specific author).
3. Select a beautiful Unsplash illustration thumbnail URL from this list that matches the category:
   - 'AI & Data Science': "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=400&q=80"
   - 'Technology & Development': "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400&q=80"
   - 'Productivity & Design': "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&q=80"
   - 'Business & Finance': "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80"
   - 'Science & Education': "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=400&q=80"
   - 'Entertainment': "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80"
   - 'Lifestyle & Health': "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=400&q=80"
   - Otherwise, default to: "${defaultThumbnail}"
4. An exceptionally detailed, highly engaging, and informative comprehensive summary explaining all main concepts, methodologies, examples, and steps covered in the resource. The summary must be highly thorough and exhaustive, structured in 3-4 dense, detailed paragraphs rather than a brief overview. Detail specific technical terms, theories, arguments, examples, or steps mentioned.
5. A multi-stage classification pipeline mapping:
   - "category": A highly granular, precise, academic-grade/scholarly category or domain area that perfectly fits the content of the resource (e.g., 'Cognitive Neuroscience', 'Distributed Systems', 'Applied Cryptography', 'Behavioral Economics', 'Acoustic Engineering', 'Reinforcement Learning', 'Information Architecture', 'Human-Computer Interaction', 'Epistemology & Education', 'Compiler Design', 'Stochastic Optimization'). Avoid generic, overly-broad classifications. Do not limit yourself to a static list.
   - "conceptualComplexity": The depth of conceptual complexity of the material (e.g., 'Introductory (undergraduate-level)', 'Intermediate (advanced-undergraduate)', 'Advanced (graduate/practitioner)', 'PhD-grade/Cutting-edge research', or 'Specialized Technical').
   - "interdisciplinaryField": The interdisciplinary field or domain crossover of the resource (e.g., 'Bioinformatics', 'Neuro-symbolic AI', 'Quantum Chemistry', 'Computational Linguistics', 'Complex Systems theory', etc.). If none, select a fitting scholastic blend.
   - "conceptTags": A list of 3-5 precise, atomic concept tags/learning pillars representing core educational themes (e.g., 'Transformer Networks', 'Mixture of Experts', 'Visual Hierarchy', 'Personal Knowledge Management'). Avoid generic categories.
6. An honest rating based on estimated educational value, execution quality, and instructional clarity.
7. Descriptive and actionable takeaways.
8. A clickbait buster assessment. Often titles are highly sensationalized, vague, or misleading. Formulate:
   - "actualPurpose": A highly objective, honest, clickbait-free 1-sentence summary of the actual core topic, tool, or theory taught.
   - "debunkedClickbait": A 1-2 sentence comparison explaining the difference between the sensationalized promise vs. what the resource realistically covers.`;

  // 3. Dispatch AI call (OpenRouter or Direct Gemini API)
  if (settings.useOpenRouter) {
    const modelName = settings.openRouterModel || "google/gemini-2.5-flash";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Marginalia"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "user",
            content: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object matching the requested schema. Ensure the response strictly parses as JSON with properties: 'title' (string), 'channelTitle' (string), 'thumbnail' (string), 'summary' (string), 'category' (string), 'conceptualComplexity' (string), 'interdisciplinaryField' (string), 'conceptTags' (array of strings), 'rating' (integer), 'ratingJustification' (string), 'takeaways' (array of strings), 'actualPurpose' (string), and 'debunkedClickbait' (string)."
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error("Empty response from OpenRouter model.");
    }

    trackRequest("Generate Summary", modelName, prompt, rawText);

    let cleanText = rawText.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    const result = JSON.parse(cleanText);
    return {
      id: videoId || 'resource-' + Date.now(),
      videoId,
      url,
      title: result.title || defaultTitle,
      channelTitle: result.channelTitle || defaultChannelTitle,
      thumbnail: isYouTube ? defaultThumbnail : (result.thumbnail || defaultThumbnail),
      summary: result.summary || "",
      category: result.category || "Science & Education",
      conceptualComplexity: result.conceptualComplexity || "Intermediate (advanced-undergraduate)",
      interdisciplinaryField: result.interdisciplinaryField || "",
      conceptTags: result.conceptTags || [],
      rating: Number(result.rating) || 5,
      ratingJustification: result.ratingJustification || "",
      takeaways: result.takeaways || [],
      actualPurpose: result.actualPurpose || "",
      debunkedClickbait: result.debunkedClickbait || "",
      watchedStatus: "To Watch",
      createdAt: new Date().toISOString()
    };
  } else {
    // Direct Gemini API Call via CORS-friendly Generative Language endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: isBulkImport ? 400 : 1200,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              channelTitle: { type: "STRING" },
              thumbnail: { type: "STRING" },
              summary: { type: "STRING" },
              category: { type: "STRING" },
              conceptualComplexity: { type: "STRING" },
              interdisciplinaryField: { type: "STRING" },
              conceptTags: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              rating: { type: "INTEGER" },
              ratingJustification: { type: "STRING" },
              takeaways: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              actualPurpose: { type: "STRING" },
              debunkedClickbait: { type: "STRING" }
            },
            required: ["title", "channelTitle", "thumbnail", "summary", "category", "conceptualComplexity", "interdisciplinaryField", "conceptTags", "rating", "ratingJustification", "takeaways", "actualPurpose", "debunkedClickbait"]
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr;
      try {
        parsedErr = JSON.parse(errText);
      } catch (_) {}
      const errMsg = parsedErr?.error?.message || errText;
      throw new Error(`Gemini API Error: ${errMsg || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("No candidates returned from Gemini API. Your API key might be restricted or incorrect.");
    }

    trackRequest("Generate Summary", "gemini-2.5-flash-direct", prompt, rawText);

    const result = JSON.parse(rawText.trim());
    return {
      id: videoId || 'resource-' + Date.now(),
      videoId,
      url,
      title: result.title || defaultTitle,
      channelTitle: result.channelTitle || defaultChannelTitle,
      thumbnail: isYouTube ? defaultThumbnail : (result.thumbnail || defaultThumbnail),
      summary: result.summary || "",
      category: result.category || "Science & Education",
      conceptualComplexity: result.conceptualComplexity || "Intermediate (advanced-undergraduate)",
      interdisciplinaryField: result.interdisciplinaryField || "",
      conceptTags: result.conceptTags || [],
      rating: Number(result.rating) || 5,
      ratingJustification: result.ratingJustification || "",
      takeaways: result.takeaways || [],
      actualPurpose: result.actualPurpose || "",
      debunkedClickbait: result.debunkedClickbait || "",
      watchedStatus: "To Watch",
      createdAt: new Date().toISOString()
    };
  }
}

// Client-side helper to fetch YouTube captions (JSON format)
async function fetchYoutubeCaptions(videoId: string): Promise<string | null> {
  if (!videoId) return null;
  try {
    const response = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.events) {
        const text = data.events
          .map((e: any) => e.segs ? e.segs.map((s: any) => s.utf8).join('') : '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        return text || null;
      }
    }
  } catch (e) {
    console.warn("Client-side direct captions fetch blocked by CORS or failed. Falling back to AI reconstruction.", e);
  }
  return null;
}

// Client-side Transcript Reconstructor/Generator
export async function generateTranscript(
  url: string,
  title: string,
  summary: string,
  settings: AppSettings
): Promise<any> {
  const apiKey = settings.useOpenRouter ? settings.openRouterApiKey : (settings.customGeminiApiKey || ((import.meta as any).env.VITE_GEMINI_API_KEY as string));
  
  if (!apiKey) {
    throw new Error("API Key Required: Please open Settings (gear icon) and configure your Gemini API Key or OpenRouter API Key!");
  }

  const videoId = extractVideoId(url);
  const captionsText = videoId ? await fetchYoutubeCaptions(videoId) : null;
  const hasCaptions = captionsText !== null;

  const prompt = `You are an expert academic-grade educational video archivist and transcription analyst. ${hasCaptions ? "Analyze the following verified transcript text to construct a detailed, beautifully structured timestamped segment transcript with key segment highlights:" : "Reconstruct a detailed, highly technical timestamped educational transcript with key segment highlights for the following resource:"}
Title: "${title}"
URL: "${url}"
Summary Context: "${summary || ''}"

${hasCaptions ? `VERIFIED CAPTIONS TEXT:\n"${captionsText}"\n\nPlease structure this raw text into 6-8 chronologically progressive timestamped segment blocks. Do NOT invent information that is not present in the captions text, but present the captions' content with academic structure.` : `NO CAPTIONS AVAILABLE:\nYou MUST reconstruct a highly complete, comprehensive, and instructional dialogue transcript of the video's core contents divided into 6-8 chronologically progressive timestamped segment blocks based on the title and summary context.`}

Please divide the core contents into 6-8 chronologically progressive timestamped segment blocks. Each segment must contain detailed speaker dialogue (by the host, presenter, or domain researchers), concrete technical details (like formulas, variables, code patterns, or design rules), and a highlight assessment.

Return the response strictly as a JSON object with:
1. "highlightsSummary": A 2-sentence summary explaining the absolute core conceptual breakthroughs of the highlighted segments.
2. "segments": An array of objects, where each object has:
   - "timestamp": E.g., "00:00", "02:15", "05:40", "08:10", "11:30"
   - "speaker": The name or role of the speaker (e.g. "Presenter", "Lead Architect", "Technical Host")
   - "title": Chapter heading for this segment (e.g., "Exploring the Transformer Block Structure" or "The Geometry of Type Pairings")
   - "text": The actual spoken dialogue or lecture text, dense, informative, and detailed (approx. 70-120 words per segment) featuring the precise terminology and reasoning.
   - "isHighlight": Boolean (true if this segment contains a crucial, high-impact instructional moment or breakthrough)
   - "highlightReason": Detailed reason describing why this segment is crucial for understanding the core topic (omit/empty if isHighlight is false).`;

  if (settings.useOpenRouter) {
    const modelName = settings.openRouterModel || "google/gemini-2.5-flash";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Marginalia"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "user",
            content: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object matching the requested schema. Ensure the response strictly parses as JSON with properties: 'highlightsSummary' (string) and 'segments' (array of objects with properties: 'timestamp' (string), 'speaker' (string), 'title' (string), 'text' (string), 'isHighlight' (boolean), and 'highlightReason' (string))."
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error("Empty response from OpenRouter model.");
    }

    trackRequest("Generate Transcript", modelName, prompt, rawText);

    let cleanText = rawText.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    const parsed = JSON.parse(cleanText);
    return {
      ...parsed,
      isVerified: hasCaptions
    };
  } else {
    // Direct Gemini API Call via CORS-friendly Generative Language endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              highlightsSummary: { type: "STRING" },
              segments: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    timestamp: { type: "STRING" },
                    speaker: { type: "STRING" },
                    title: { type: "STRING" },
                    text: { type: "STRING" },
                    isHighlight: { type: "BOOLEAN" },
                    highlightReason: { type: "STRING" }
                  },
                  required: ["timestamp", "speaker", "title", "text", "isHighlight", "highlightReason"]
                }
              }
            },
            required: ["highlightsSummary", "segments"]
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr;
      try {
        parsedErr = JSON.parse(errText);
      } catch (_) {}
      const errMsg = parsedErr?.error?.message || errText;
      throw new Error(`Gemini API Error: ${errMsg || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("No candidates returned from Gemini API. Your API key might be restricted or incorrect.");
    }

    trackRequest("Generate Transcript", "gemini-2.5-flash-direct", prompt, rawText);

    const parsed = JSON.parse(rawText.trim());
    return {
      ...parsed,
      isVerified: hasCaptions
    };
  }
}

// Client-side Glossary Generator
export async function generateGlossary(
  video: VideoItem,
  settings: AppSettings
): Promise<any[]> {
  const apiKey = settings.useOpenRouter ? settings.openRouterApiKey : (settings.customGeminiApiKey || ((import.meta as any).env.VITE_GEMINI_API_KEY as string));
  
  if (!apiKey) {
    throw new Error("API Key Required: Please open Settings (gear icon) and configure your Gemini API Key or OpenRouter API Key!");
  }

  const conceptTagsStr = (video.conceptTags || []).join(", ");
  const prompt = `You are an expert academic-grade researcher and educator. Generate a precise Glossary of terms matching the provided concept tags.
Provided Terms/Concepts: [${conceptTagsStr}]
Video Title: "${video.title}"
Video Summary: "${video.summary}"

Write precise, high-fidelity academic definitions for each of these exact terms based on the context of the resource. Do NOT re-derive or add new terms from scratch. Only define the provided terms.

Return the response strictly as a JSON array of objects, where each object has properties:
- "term" (string, must exactly match one of the provided concept tags)
- "definition" (string, the detailed academic definition)`;

  if (settings.useOpenRouter) {
    const modelName = settings.openRouterModel || "google/gemini-2.5-flash";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Marginalia"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "user",
            content: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON array matching the requested schema. Ensure the response strictly parses as JSON with array of objects having properties 'term' and 'definition'."
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error("Empty response from OpenRouter model.");
    }

    trackRequest("Generate Glossary", modelName, prompt, rawText);

    let cleanText = rawText.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    return JSON.parse(cleanText);
  } else {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                term: { type: "STRING" },
                definition: { type: "STRING" }
              },
              required: ["term", "definition"]
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr;
      try {
        parsedErr = JSON.parse(errText);
      } catch (_) {}
      const errMsg = parsedErr?.error?.message || errText;
      throw new Error(`Gemini API Error: ${errMsg || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("No candidates returned from Gemini API.");
    }

    trackRequest("Generate Glossary", "gemini-2.5-flash-direct", prompt, rawText);

    return JSON.parse(rawText.trim());
  }
}

// Client-side Quiz Generator
export async function generateQuiz(
  video: VideoItem,
  settings: AppSettings
): Promise<any[]> {
  const apiKey = settings.useOpenRouter ? settings.openRouterApiKey : (settings.customGeminiApiKey || ((import.meta as any).env.VITE_GEMINI_API_KEY as string));
  
  if (!apiKey) {
    throw new Error("API Key Required: Please open Settings (gear icon) and configure your Gemini API Key or OpenRouter API Key!");
  }

  const prompt = `You are an expert educator. Generate a custom assessment quiz based on the following study materials:
Video Title: "${video.title}"
Video Summary: "${video.summary}"
Key Takeaways:
${(video.takeaways || []).map(t => `- ${t}`).join("\n")}

Generate exactly 3 to 5 challenging, high-quality quiz questions that test the learner's comprehension.
Create a mix of Multiple Choice ('mcq') and Short Answer ('short') questions.
For MCQ questions, provide 4 options and set the correctAnswer to one of them.
For Short Answer questions, do NOT provide options, and set the correctAnswer to a concise model answer (1-2 sentences).

Return the response strictly as a JSON array of objects, where each object has:
- "id": string (unique question identifier, e.g. "q1", "q2")
- "type": string (either "mcq" or "short")
- "question": string (the question text)
- "options": array of strings (ONLY for "mcq", list exactly 4 options. Omit or leave empty for "short")
- "correctAnswer": string (the correct choice text for MCQ, or the model answer text for Short Answer)`;

  if (settings.useOpenRouter) {
    const modelName = settings.openRouterModel || "google/gemini-2.5-flash";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Marginalia"
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "user",
            content: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON array matching the requested schema. Ensure the response strictly parses as JSON with array of objects having properties 'id', 'type' ('mcq' or 'short'), 'question', 'options' (array of strings, optional) and 'correctAnswer'."
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errText || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error("Empty response from OpenRouter model.");
    }

    trackRequest("Generate Quiz", modelName, prompt, rawText);

    let cleanText = rawText.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    return JSON.parse(cleanText);
  } else {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                type: { type: "STRING" },
                question: { type: "STRING" },
                options: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                },
                correctAnswer: { type: "STRING" }
              },
              required: ["id", "type", "question", "correctAnswer"]
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr;
      try {
        parsedErr = JSON.parse(errText);
      } catch (_) {}
      const errMsg = parsedErr?.error?.message || errText;
      throw new Error(`Gemini API Error: ${errMsg || response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("No candidates returned from Gemini API.");
    }

    trackRequest("Generate Quiz", "gemini-2.5-flash-direct", prompt, rawText);

    return JSON.parse(rawText.trim());
  }
}
