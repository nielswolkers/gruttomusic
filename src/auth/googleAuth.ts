const CLIENT_ID = '551498588751-aiuojj5bprqmhi3g4545mu2d3mri7v5r.apps.googleusercontent.com';
const REDIRECT_URI = `${window.location.origin}/callback/google`;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

export async function redirectToGoogleAuth(): Promise<void> {
  const state = generateRandomString(32);
  window.localStorage.setItem('google_state', state);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  const params = {
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state: state,
    access_type: 'offline',
    prompt: 'consent',
  };

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
}

export function getGoogleClientId(): string {
  return CLIENT_ID;
}

export function getGoogleRedirectUri(): string {
  return REDIRECT_URI;
}

export function logoutGoogle(): void {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_refresh_token');
  localStorage.removeItem('google_token_expiry');
  localStorage.removeItem('google_state');
}
