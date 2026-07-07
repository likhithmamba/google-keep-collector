import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Extract YouTube video ID
function extractVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// API: YouTube Metadata and AI Summary
app.post("/api/summarize", async (req, res) => {
  try {
    const { url, openRouterApiKey, customGeminiApiKey, openRouterModel } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Resource URL is required" });
    }

    const videoId = extractVideoId(url) || "";
    const isYouTube = videoId !== "";

    let defaultTitle = "Web Resource";
    let defaultChannelTitle = "External Link";
    let defaultThumbnail = "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=400&q=80";

    if (isYouTube) {
      defaultThumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const metaResponse = await fetch(oembedUrl);
        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          defaultTitle = metaData.title || defaultTitle;
          defaultChannelTitle = metaData.author_name || defaultChannelTitle;
          defaultThumbnail = metaData.thumbnail_url || defaultThumbnail;
        }
      } catch (e) {
        console.warn("Failed to fetch oEmbed metadata, falling back.", e);
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

    const prompt = `Analyze this educational resource link and generate a structured summary, categorization, star rating (1-5), and key takeaways.
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
6. An honest rating based on estimated educational value, execution quality, and instructional clarity.
7. Descriptive and actionable takeaways.
8. A clickbait buster assessment. Often titles are highly sensationalized, vague, or misleading. Formulate:
   - "actualPurpose": A highly objective, honest, clickbait-free 1-sentence summary of the actual core topic, tool, or theory taught.
   - "debunkedClickbait": A 1-2 sentence comparison explaining the difference between the sensationalized promise vs. what the resource realistically covers.`;

    // If OpenRouter is provided, route through OpenRouter chat completion
    if (openRouterApiKey) {
      const modelName = openRouterModel || "google/gemini-2.5-flash";
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ai.studio/build",
          "X-Title": "TubeKeep Curator"
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "user",
              content: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object matching the requested schema. Ensure the response strictly parses as JSON with properties: 'title' (string), 'channelTitle' (string), 'thumbnail' (string), 'summary' (string), 'category' (string), 'conceptualComplexity' (string), 'interdisciplinaryField' (string), 'rating' (integer), 'ratingJustification' (string), 'takeaways' (array of strings), 'actualPurpose' (string), and 'debunkedClickbait' (string)."
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
        throw new Error("Empty response from OpenRouter API model");
      }

      let cleanText = rawText.trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.substring(7);
      }
      if (cleanText.endsWith("```")) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      cleanText = cleanText.trim();

      const result = JSON.parse(cleanText);
      return res.json({
        videoId,
        url,
        title: result.title || defaultTitle,
        channelTitle: result.channelTitle || defaultChannelTitle,
        thumbnail: isYouTube ? defaultThumbnail : (result.thumbnail || defaultThumbnail),
        ...result
      });
    }

    // Custom or default Gemini SDK
    let ai;
    if (customGeminiApiKey) {
      ai = new GoogleGenAI({
        apiKey: customGeminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build-custom',
          }
        }
      });
    } else {
      ai = getGeminiClient();
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 1200, // Enforce token utilization moderation for optimized results
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A clear, clean, educational title determined from the link contents."
            },
            channelTitle: {
              type: Type.STRING,
              description: "The name of the publisher, creator, website source, or author."
            },
            thumbnail: {
              type: Type.STRING,
              description: "The recommended Unsplash thumbnail URL chosen from the provided category options."
            },
            summary: {
              type: Type.STRING,
              description: "An exceptionally detailed, comprehensive multi-paragraph summary (at least 3 dense, thorough paragraphs of 4-6 sentences each) covering the core topics, specific details, arguments, technical terms, real-world examples, and key teaching points."
            },
            category: {
              type: Type.STRING,
              description: "A highly granular, precise, academic-grade/scholarly category or domain area that perfectly fits the content of the resource (e.g., 'Cognitive Neuroscience', 'Distributed Systems', 'Applied Cryptography', 'Behavioral Economics', 'Acoustic Engineering', 'Reinforcement Learning', 'Information Architecture', 'Human-Computer Interaction', 'Epistemology & Education', 'Compiler Design', 'Stochastic Optimization'). Avoid generic, overly-broad classifications."
            },
            conceptualComplexity: {
              type: Type.STRING,
              description: "The depth of conceptual complexity of the material (e.g., 'Introductory (undergraduate-level)', 'Intermediate (advanced-undergraduate)', 'Advanced (graduate/practitioner)', 'PhD-grade/Cutting-edge research', or 'Specialized Technical')."
            },
            interdisciplinaryField: {
              type: Type.STRING,
              description: "The interdisciplinary field or domain crossover of the resource (e.g., 'Bioinformatics', 'Neuro-symbolic AI', 'Quantum Chemistry', 'Computational Linguistics', 'Complex Systems theory', etc.). If none, select a fitting scholastic blend."
            },
            rating: {
              type: Type.INTEGER,
              description: "A suggested rating from 1 to 5 stars."
            },
            ratingJustification: {
              type: Type.STRING,
              description: "A 1-sentence explanation of why this rating was assigned."
            },
            takeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A list of 5-7 highly detailed, comprehensive, descriptive, and actionable takeaways, lessons, or concepts (each should be a full, detailed sentence or two)."
            },
            actualPurpose: {
              type: Type.STRING,
              description: "An objective, clickbait-free, 1-sentence description stating exactly what tool, concept, or process is actually taught."
            },
            debunkedClickbait: {
              type: Type.STRING,
              description: "A 1-2 sentence objective comparison of the sensationalized title/thumbnail hype vs. what the resource realistically covers."
            }
          },
          required: ["title", "channelTitle", "thumbnail", "summary", "category", "conceptualComplexity", "interdisciplinaryField", "rating", "ratingJustification", "takeaways", "actualPurpose", "debunkedClickbait"]
        }
      }
    });

    const aiText = response.text;
    if (!aiText) {
      throw new Error("Empty response from Gemini API");
    }

    const result = JSON.parse(aiText);

    return res.json({
      videoId,
      url,
      title: result.title || defaultTitle,
      channelTitle: result.channelTitle || defaultChannelTitle,
      thumbnail: isYouTube ? defaultThumbnail : (result.thumbnail || defaultThumbnail),
      ...result
    });

  } catch (error: any) {
    console.error("Error summarizing video:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while analyzing the video"
    });
  }
});

// API: Dynamic Transcript and Key Sections Highlight Engine
app.post("/api/transcript", async (req, res) => {
  try {
    const { url, title, summary } = req.body;
    if (!url || !title) {
      return res.status(400).json({ error: "Resource URL and Title are required to analyze transcripts" });
    }

    const ai = getGeminiClient();

    const prompt = `You are an expert academic-grade educational video archivist and transcription analyst. Create a detailed, highly technical timestamped educational transcript with key segment highlights for the following resource:
Title: "${title}"
URL: "${url}"
Summary Context: "${summary || ''}"

Please reconstruct a highly complete, comprehensive, and instructional transcript of the video's core contents divided into 6-8 chronologically progressive timestamped segment blocks. Each segment must contain detailed speaker dialogue (by the host, presenter, or domain researchers), concrete technical details (like formulas, variables, code patterns, or design rules), and a highlight assessment.

Return the response strictly as a JSON object with:
1. "highlightsSummary": A 2-sentence summary explaining the absolute core conceptual breakthroughs of the highlighted segments.
2. "segments": An array of objects, where each object has:
   - "timestamp": E.g., "00:00", "02:15", "05:40", "08:10", "11:30"
   - "speaker": The name or role of the speaker (e.g. "Presenter", "Lead Architect", "Technical Host")
   - "title": Chapter heading for this segment (e.g., "Exploring the Transformer Block Structure" or "The Geometry of Type Pairings")
   - "text": The actual spoken dialogue or lecture text, dense, informative, and detailed (approx. 70-120 words per segment) featuring the precise terminology and reasoning.
   - "isHighlight": Boolean (true if this segment contains a crucial, high-impact instructional moment or breakthrough)
   - "highlightReason": Detailed reason describing why this segment is crucial for understanding the core topic (omit/empty if isHighlight is false).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            highlightsSummary: {
              type: Type.STRING,
              description: "A 2-sentence summary of the high-impact insights in this transcript."
            },
            segments: {
              type: Type.ARRAY,
              description: "The list of transcript segment chapters.",
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING, description: "Timestamp of the segment, e.g. '00:00', '02:30'" },
                  speaker: { type: Type.STRING, description: "Speaker identifier" },
                  title: { type: Type.STRING, description: "The chapter or topic of this segment" },
                  text: { type: Type.STRING, description: "Detailed narrative/lecture text representing this section of the video" },
                  isHighlight: { type: Type.BOOLEAN, description: "True if this segment is extremely critical to understand" },
                  highlightReason: { type: Type.STRING, description: "Explanation of why this segment is highlighted" }
                },
                required: ["timestamp", "speaker", "title", "text", "isHighlight", "highlightReason"]
              }
            }
          },
          required: ["highlightsSummary", "segments"]
        }
      }
    });

    const aiText = response.text;
    if (!aiText) {
      throw new Error("Empty response from Gemini Transcript Engine");
    }

    const result = JSON.parse(aiText);
    return res.json(result);

  } catch (error: any) {
    console.error("Error generating AI transcript:", error);
    return res.status(500).json({
      error: error.message || "An error occurred while generating the AI transcript"
    });
  }
});

// Setup Vite / Serve static assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
