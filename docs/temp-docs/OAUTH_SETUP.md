# OAuth Provider Setup Guide

This guide explains how to enable Google and GitHub authentication for the TR-08 beat sequencer.

## Prerequisites

- Access to your Supabase dashboard
- Google Cloud Console account (for Google OAuth)
- GitHub account (for GitHub OAuth)

---

## Google OAuth Setup

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**

### 2. Configure OAuth Consent Screen

If prompted, configure the OAuth consent screen:

- User Type: **External**
- App name: `TR-08 Beat Sequencer`
- User support email: Your email
- Developer contact: Your email
- Scopes: `email` and `profile` (default)

### 3. Create OAuth Client

- Application type: **Web application**
- Name: `TR-08 Production`
- Authorized JavaScript origins:

  ```text
  https://[YOUR-PROJECT-REF].supabase.co
  http://localhost:5173
  ```

- Authorized redirect URIs:

  ```text
  https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
  http://localhost:5173/auth/v1/callback
  ```

  **Note:** Replace `[YOUR-PROJECT-REF]` with your Supabase project reference (found in your project URL).

### 4. Add to Supabase

1. Copy **Client ID** and **Client Secret**
2. Go to Supabase Dashboard → **Authentication** → **Providers**
3. Find **Google** and toggle it ON
4. Paste the Client ID and Client Secret
5. Click **Save**

---

## GitHub OAuth Setup

### 1. Register OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in the form:
   - **Application name**: `TR-08 Beat Sequencer`
   - **Homepage URL**: `https://your-production-url.com` (or `http://localhost:5173` for dev)
   - **Application description**: Beat sequencer web app
   - **Authorization callback URL**:

     ```text
     https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
     ```

     **Note:** Replace `[YOUR-PROJECT-REF]` with your Supabase project reference.

### 2. Get Credentials

1. Click **Register application**
2. Copy the **Client ID**
3. Click **Generate a new client secret**
4. Copy the **Client Secret** (you won't see it again!)

### 3. Add to Supabase

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Find **GitHub** and toggle it ON
3. Paste the Client ID and Client Secret
4. Click **Save**

---

## Testing

After setting up both providers:

1. Wait ~30 seconds for Supabase to apply changes
2. Refresh your TR-08 app
3. Click "Sign in with Google" or "Sign in with GitHub"
4. Complete the OAuth flow
5. You should be redirected back to the app as authenticated

---

## Development vs Production

### Development (localhost)

Add these redirect URIs when testing locally:

```text
http://localhost:5173/auth/v1/callback
```

### Production

When you deploy, update the redirect URIs to your production domain:

```text
https://your-domain.com/auth/v1/callback
```

---

## Troubleshooting

### "Redirect URI Mismatch"

- Double-check the callback URL in both Google/GitHub and Supabase
- Format: `https://[PROJECT-REF].supabase.co/auth/v1/callback`

### "Provider not enabled"

- Ensure you toggled the provider ON in Supabase
- Wait 30 seconds after saving
- Check that Client ID and Secret are correct

### "Invalid client"

- Regenerate the OAuth credentials
- Ensure you copied the full Client Secret

---

## Security Notes

- Never commit Client Secrets to git
- Use different OAuth apps for dev/staging/production
- Regularly rotate secrets
- Monitor OAuth app usage in Google/GitHub dashboards
