import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add required scopes
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Since Firebase Auth token isn't automatically cached on page reload,
        // we will let the user click login to refresh the token, or we can handle
        // state gracefully.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Google Sign-In
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
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
