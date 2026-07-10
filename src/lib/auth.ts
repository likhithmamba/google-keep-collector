// Secure 100% Client-Side Google OAuth 2.0 Integration
// Completely independent of Firebase. Stores tokens in memory / secure sessionStorage.

export interface GoogleUser {
  email: string;
  displayName: string;
  photoURL: string;
}

let cachedAccessToken: string | null = null;
let cachedUser: GoogleUser | null = null;
let oauthMessageListenerRegistered = false;

// Generate cryptographically secure random state to protect against CSRF attacks
function generateState(): string {
  const array = new Uint32Array(4);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
}

// Build standard Google OAuth 2.0 implicit authorization endpoint URL
export const getGoogleAuthUrl = (clientId: string, state: string): string => {
  const redirectUri = window.location.origin + '/'; // Must match Authorized Redirect URIs in Google Cloud Console
  const scopes = [
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file'
  ];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: scopes.join(' '),
    state: state,
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

// Check if current page load is actually an active Google OAuth callback redirect inside the popup
const handleCallbackIfPopup = async () => {
  const hash = window.location.hash.substring(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const state = params.get('state');

  if (accessToken && window.opener) {
    try {
      // Validate CSRF state parameter to prevent Session Hijacking / Injection
      const savedState = sessionStorage.getItem('oauth_state');
      if (!savedState || state !== savedState) {
        console.error('OAuth Security Check Failed: State parameter mismatch or expired.');
        window.close();
        return;
      }

      // Remove single-use state token immediately
      sessionStorage.removeItem('oauth_state');

      // Retrieve user's Google profile securely
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error('Google profile retrieval failed');
      const profile = await res.json();

      // Send payload securely back to opener window (enforces exact same-origin)
      window.opener.postMessage({
        type: 'GOOGLE_OAUTH_SUCCESS',
        accessToken,
        user: {
          email: profile.email,
          displayName: profile.name,
          photoURL: profile.picture
        }
      }, window.location.origin);

      // Close login popup gracefully
      window.close();
    } catch (error) {
      console.error('OAuth profile payload extraction error:', error);
      window.close();
    }
  }
};

// Initialize auth state and listen for incoming secure OAuth postMessages
export const initAuth = (
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (typeof window === 'undefined') return;

  // 1. Setup secure cross-window communicator
  if (!oauthMessageListenerRegistered) {
    window.addEventListener('message', (event) => {
      // Security measure: strictly enforce same-origin source check
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS') {
        const { accessToken, user } = event.data;
        cachedAccessToken = accessToken;
        cachedUser = user;

        // Persist session-scoped cache
        const expiry = Date.now() + 3500 * 1000; // Keep slightly below 1 hour expiration window
        sessionStorage.setItem('tubekeep_google_auth', JSON.stringify({
          user,
          token: accessToken,
          expiry
        }));

        if (onAuthSuccess) onAuthSuccess(user, accessToken);
      }
    });
    oauthMessageListenerRegistered = true;
  }

  // 2. Proactively parse hash parameters if this instance is running as the Google redirect destination
  handleCallbackIfPopup();

  // 3. Load active session cache if it has not expired yet
  const cached = sessionStorage.getItem('tubekeep_google_auth');
  if (cached) {
    try {
      const { user, token, expiry } = JSON.parse(cached);
      if (Date.now() < expiry) {
        cachedAccessToken = token;
        cachedUser = user;
        if (onAuthSuccess) onAuthSuccess(user, token);
        return;
      }
    } catch (e) {
      sessionStorage.removeItem('tubekeep_google_auth');
    }
  }

  if (onAuthFailure) onAuthFailure();
};

// Google Sign-In with popup
export const googleSignIn = async (clientId?: string): Promise<{ user: GoogleUser; accessToken: string } | null> => {
  if (!clientId) {
    throw new Error('Google Client ID Required: Please open Settings (gear icon) and configure your Google OAuth Client ID to log in!');
  }

  const state = generateState();
  sessionStorage.setItem('oauth_state', state);

  const authUrl = getGoogleAuthUrl(clientId, state);

  const width = 500;
  const height = 650;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;

  const popup = window.open(
    authUrl,
    'Google_OAuth_Sign_In',
    `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
  );

  if (!popup) {
    throw new Error('Popup blocked! Please allow popups for this site to log in with Google.');
  }

  return new Promise((resolve, reject) => {
    let checkTimer: any = null;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS') {
        if (checkTimer) clearInterval(checkTimer);
        window.removeEventListener('message', handleMessage);
        resolve({
          user: event.data.user,
          accessToken: event.data.accessToken
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Periodically monitor popup status to reject when user cancels out
    checkTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkTimer);
        window.removeEventListener('message', handleMessage);
        // Timeout check to ensure we didn't resolve immediately before this ticks
        setTimeout(() => {
          reject(new Error('Sign-in cancelled: The login popup was closed.'));
        }, 100);
      }
    }, 500);
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  sessionStorage.removeItem('tubekeep_google_auth');
  cachedAccessToken = null;
  cachedUser = null;
};

// Google Tasks API Helper: Sync video summary as a Task
export const createGoogleTask = async (
  title: string,
  notes: string,
  tokenOverride?: string
): Promise<{ id: string; selfLink: string } | null> => {
  const token = tokenOverride || await getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated or access token is missing');
  }

  const response = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      notes,
      status: 'needsAction',
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to create Google Task');
  }

  return response.json();
};

// Fetch Google Tasks from the @default list
export const fetchGoogleTasks = async (tokenOverride?: string): Promise<any[]> => {
  const token = tokenOverride || await getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated');
  }

  const response = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=true&showHidden=true', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to fetch Google Tasks');
  }

  const data = await response.json();
  return data.items || [];
};

// Update Google Task status (completing or uncompleting)
export const updateGoogleTaskStatus = async (
  taskId: string,
  completed: boolean,
  tokenOverride?: string
): Promise<any> => {
  const token = tokenOverride || await getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated');
  }

  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: taskId,
      status: completed ? 'completed' : 'needsAction',
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to update Google Task');
  }

  return response.json();
};

// Delete Google Task
export const deleteGoogleTask = async (taskId: string, tokenOverride?: string): Promise<boolean> => {
  const token = tokenOverride || await getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated');
  }

  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to delete Google Task');
  }

  return true;
};

// Google Docs API Helper: Create a stylized Study Packet Document
export const createGoogleDocStudyPacket = async (
  title: string,
  contentBody: string,
  tokenOverride?: string
): Promise<{ documentId: string; alternateLink: string } | null> => {
  const token = tokenOverride || await getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated or access token is missing');
  }

  // 1. Create a blank document
  const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
    }),
  });

  if (!createResponse.ok) {
    const errData = await createResponse.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to create Google Document');
  }

  const doc = await createResponse.json();
  const documentId = doc.documentId;

  // 2. Insert the styled study packet content
  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text: contentBody
      }
    }
  ];

  const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!updateResponse.ok) {
    const errData = await updateResponse.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to populate Google Document');
  }

  return {
    documentId,
    alternateLink: `https://docs.google.com/document/d/${documentId}/edit`
  };
};
