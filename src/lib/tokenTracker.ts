export interface TokenLogItem {
  id: string;
  timestamp: string;
  action: string;
  model: string;
  promptChars: number;
  responseChars: number;
  promptTokens: number;
  responseTokens: number;
  cost: number;
}

const STORAGE_KEY = 'marginalia_token_logs';
const THRESHOLD_KEY = 'marginalia_token_threshold';
const WARNING_DISMISS_KEY = 'marginalia_token_warning_dismissed';

// Get all token logs
export function getTokenLogs(): TokenLogItem[] {
  try {
    const logs = localStorage.getItem(STORAGE_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    console.error("Failed to read token logs from local storage:", e);
    return [];
  }
}

// Clear all token logs
export function clearTokenLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    dispatchUpdateEvent();
  } catch (e) {
    console.error("Failed to clear token logs:", e);
  }
}

// Get the defined character threshold (default: 100,000 characters)
export function getTokenThreshold(): number {
  try {
    const threshold = localStorage.getItem(THRESHOLD_KEY);
    return threshold ? parseInt(threshold, 10) : 100000;
  } catch (e) {
    return 100000;
  }
}

// Save the defined character threshold
export function setTokenThreshold(value: number): void {
  try {
    localStorage.setItem(THRESHOLD_KEY, String(value));
    dispatchUpdateEvent();
  } catch (e) {}
}

// Check if warning has been dismissed for the current threshold session
export function isWarningDismissed(): boolean {
  return localStorage.getItem(WARNING_DISMISS_KEY) === 'true';
}

// Set warning dismissed status
export function setWarningDismissed(dismissed: boolean): void {
  localStorage.setItem(WARNING_DISMISS_KEY, dismissed ? 'true' : 'false');
  dispatchUpdateEvent();
}

// Calculate totals from logs
export function getTokenTotals() {
  const logs = getTokenLogs();
  return logs.reduce(
    (acc, item) => {
      acc.totalPromptChars += item.promptChars;
      acc.totalResponseChars += item.responseChars;
      acc.totalPromptTokens += item.promptTokens;
      acc.totalResponseTokens += item.responseTokens;
      acc.totalCost += item.cost;
      return acc;
    },
    {
      totalPromptChars: 0,
      totalResponseChars: 0,
      totalPromptTokens: 0,
      totalResponseTokens: 0,
      totalCost: 0,
    }
  );
}

// Check if the current total character usage exceeds the threshold
export function isThresholdExceeded(): boolean {
  const totals = getTokenTotals();
  const totalChars = totals.totalPromptChars + totals.totalResponseChars;
  return totalChars > getTokenThreshold();
}

// Dispatch event to notify components about token updates
function dispatchUpdateEvent() {
  window.dispatchEvent(new CustomEvent('marginalia-token-updated'));
}

// Helper to track a request and response payload
export function trackRequest(
  action: string,
  model: string,
  promptText: string,
  responseText: string
): TokenLogItem {
  const promptChars = promptText ? promptText.length : 0;
  const responseChars = responseText ? responseText.length : 0;

  // Industry standard average: 1 token ≈ 4 characters of standard English text
  const promptTokens = Math.ceil(promptChars / 4);
  const responseTokens = Math.ceil(responseChars / 4);

  // Cost calculations based on standard models
  let cost = 0;
  const isDirectGemini = model === 'gemini-2.5-flash-direct';
  const lowercaseModel = model.toLowerCase();

  if (isDirectGemini || lowercaseModel.includes('gemini-2.5-flash')) {
    // Gemini 2.5 Flash Pricing (Standard Developer pricing):
    // Prompt: $0.075 / 1,000,000 tokens ($0.000000075 / token)
    // Response: $0.30 / 1,000,000 tokens ($0.00000030 / token)
    const promptCost = promptTokens * 0.000000075;
    const responseCost = responseTokens * 0.00000030;
    cost = promptCost + responseCost;
  } else if (lowercaseModel.includes('gemini-2.5-pro')) {
    // Gemini 2.5 Pro Pricing:
    // Prompt: $1.25 / 1,000,000 tokens
    // Response: $5.00 / 1,000,000 tokens
    const promptCost = promptTokens * 0.00000125;
    const responseCost = responseTokens * 0.00000500;
    cost = promptCost + responseCost;
  } else {
    // Standard average for OpenRouter fallback models ($0.50 per 1M blended tokens)
    cost = (promptTokens + responseTokens) * 0.00000050;
  }

  const newLog: TokenLogItem = {
    id: `token-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    action,
    model: isDirectGemini ? 'Google Gemini 2.5 Flash (Direct API)' : model,
    promptChars,
    responseChars,
    promptTokens,
    responseTokens,
    cost
  };

  try {
    const logs = getTokenLogs();
    logs.unshift(newLog); // Prepend new log
    // Keep a maximum of 200 logs to prevent IndexedDB/localStorage bloat
    if (logs.length > 200) {
      logs.splice(200);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    
    // Check if threshold was just exceeded and reset dismiss if newly exceeded
    const previousTotals = logs.slice(1).reduce((acc, item) => acc + item.promptChars + item.responseChars, 0);
    const currentTotals = previousTotals + promptChars + responseChars;
    const threshold = getTokenThreshold();
    if (previousTotals <= threshold && currentTotals > threshold) {
      localStorage.setItem(WARNING_DISMISS_KEY, 'false'); // reset dismiss so user gets warned
    }

    dispatchUpdateEvent();
  } catch (e) {
    console.error("Failed to write token log to local storage:", e);
  }

  return newLog;
}
