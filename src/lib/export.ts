import { VideoItem } from '../types';

export function exportToMarkdown(video: VideoItem): string {
  const tagsStr = (video.conceptTags || []).map(t => `\`${t}\``).join(', ');
  const takeawaysStr = (video.takeaways || []).map(t => `- ${t}`).join('\n');
  
  let glossaryStr = '';
  if (video.glossary && video.glossary.length > 0) {
    glossaryStr = '## Glossary\n\n' + video.glossary.map(g => `**${g.term}**: ${g.definition}`).join('\n\n') + '\n\n';
  }

  let transcriptStr = '';
  if (video.transcript && video.transcript.segments) {
    transcriptStr = `## Transcript Analysis (${video.transcript.isVerified ? 'Verified' : 'AI-Reconstructed'})\n\n`;
    transcriptStr += `*Summary: ${video.transcript.highlightsSummary}*\n\n`;
    transcriptStr += video.transcript.segments.map(seg => {
      const highlightBadge = seg.isHighlight ? ' ⭐ **[Key Concept]**' : '';
      return `### [${seg.timestamp}] ${seg.title} (${seg.speaker})${highlightBadge}\n${seg.text}${seg.highlightReason ? `\n\n*Why it matters: ${seg.highlightReason}*` : ''}`;
    }).join('\n\n') + '\n\n';
  }

  return `# ${video.title}

- **Creator/Channel**: ${video.channelTitle}
- **URL**: ${video.url}
- **Category**: ${video.category}
- **Conceptual Complexity**: ${video.conceptualComplexity || 'Standard'}
- **Interdisciplinary Field**: ${video.interdisciplinaryField || 'General'}
- **Concept Tags**: ${tagsStr || 'None'}
- **Curation Date**: ${video.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'N/A'}
- **Rating**: ${video.rating}/5 stars
- **Rating Justification**: ${video.ratingJustification}

---

## Clickbait Buster
- **Actual Purpose**: ${video.actualPurpose || 'N/A'}
- **Debunked Sensationalism**: ${video.debunkedClickbait || 'N/A'}

---

## Comprehensive Summary
${video.summary}

---

## Key Takeaways
${takeawaysStr || 'None'}

---

${glossaryStr}${transcriptStr}`;
}

export function exportToJSON(video: VideoItem): string {
  return JSON.stringify(video, null, 2);
}

export function exportToHTML(video: VideoItem): string {
  const tagsList = (video.conceptTags || []).map(t => `<span class="tag">${t}</span>`).join('');
  const takeawaysList = (video.takeaways || []).map(t => `<li>${t}</li>`).join('');
  
  let glossarySection = '';
  if (video.glossary && video.glossary.length > 0) {
    const glossaryItems = video.glossary.map(g => `<div class="glossary-item"><strong>${g.term}</strong>: ${g.definition}</div>`).join('');
    glossarySection = `
      <section class="card">
        <h2>Glossary</h2>
        <div class="glossary-grid">${glossaryItems}</div>
      </section>
    `;
  }

  let transcriptSection = '';
  if (video.transcript && video.transcript.segments) {
    const segmentsHtml = video.transcript.segments.map(seg => `
      <div class="segment ${seg.isHighlight ? 'highlighted' : ''}">
        <div class="segment-meta">
          <span class="timestamp">${seg.timestamp}</span>
          <span class="speaker">${seg.speaker}</span>
          ${seg.isHighlight ? '<span class="badge">Key Breakthrough</span>' : ''}
        </div>
        <h4 class="segment-title">${seg.title}</h4>
        <p class="segment-text">${seg.text}</p>
        ${seg.highlightReason ? `<p class="segment-reason"><em>Impact Check:</em> ${seg.highlightReason}</p>` : ''}
      </div>
    `).join('');

    transcriptSection = `
      <section class="card">
        <h2>Transcript Analysis (${video.transcript.isVerified ? 'Verified' : 'AI-Reconstructed'})</h2>
        <p class="summary-lead"><em>${video.transcript.highlightsSummary}</em></p>
        <div class="segments-list">${segmentsHtml}</div>
      </section>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${video.title} — Marginalia Curation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #fafafa;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 40px;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 20px;
    }
    h1 {
      font-size: 2.5rem;
      margin-top: 0;
      margin-bottom: 10px;
      letter-spacing: -0.025em;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 20px;
      font-size: 0.9rem;
    }
    .meta-item {
      background: #fff;
      padding: 10px 15px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
    }
    .meta-item strong {
      display: block;
      color: #666;
      font-size: 0.8rem;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .tag {
      display: inline-block;
      background: #e5e5e5;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-family: monospace;
      margin-right: 5px;
      margin-bottom: 5px;
    }
    .card {
      background: #fff;
      border: 1px solid #1a1a1a;
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 30px;
    }
    h2 {
      margin-top: 0;
      font-size: 1.5rem;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 10px;
    }
    .glossary-grid {
      display: grid;
      gap: 15px;
    }
    .glossary-item {
      padding-bottom: 10px;
      border-b: 1px solid #f0f0f0;
    }
    .segment {
      padding: 15px;
      border-left: 3px solid #e5e5e5;
      margin-bottom: 15px;
      background: #fdfdfd;
    }
    .segment.highlighted {
      border-left-color: #1a1a1a;
      background: #f9f9f9;
    }
    .segment-meta {
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .timestamp {
      font-family: monospace;
      font-weight: bold;
    }
    .badge {
      background: #1a1a1a;
      color: #fff;
      padding: 1px 6px;
      font-size: 0.7rem;
      text-transform: uppercase;
      border-radius: 3px;
    }
    .segment-title {
      margin: 5px 0;
      font-size: 1.1rem;
    }
    .segment-text {
      margin-top: 5px;
    }
    .segment-reason {
      font-size: 0.9rem;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${video.title}</h1>
      <p class="subtitle">by ${video.channelTitle} &bull; <a href="${video.url}">${video.url}</a></p>
      
      <div class="meta-grid">
        <div class="meta-item">
          <strong>Category</strong>
          ${video.category}
        </div>
        <div class="meta-item">
          <strong>Complexity</strong>
          ${video.conceptualComplexity || 'Standard'}
        </div>
        <div class="meta-item">
          <strong>Scholarly Field</strong>
          ${video.interdisciplinaryField || 'General'}
        </div>
        <div class="meta-item">
          <strong>Curation Rating</strong>
          ${video.rating}/5 Stars (${video.ratingJustification})
        </div>
      </div>
      <div style="margin-top: 15px;">
        <strong>Concept Pillars:</strong> ${tagsList || 'None'}
      </div>
    </header>

    <section class="card">
      <h2>Clickbait Buster Analysis</h2>
      <p><strong>Actual Purpose:</strong> ${video.actualPurpose || 'N/A'}</p>
      <p><strong>Debunked Promise:</strong> ${video.debunkedClickbait || 'N/A'}</p>
    </section>

    <section class="card">
      <h2>Comprehensive Summary</h2>
      <p style="white-space: pre-line;">${video.summary}</p>
    </section>

    <section class="card">
      <h2>Key Takeaways</h2>
      <ul>${takeawaysList || '<li>None</li>'}</ul>
    </section>

    ${glossarySection}
    ${transcriptSection}
  </div>
</body>
</html>`;
}

export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
