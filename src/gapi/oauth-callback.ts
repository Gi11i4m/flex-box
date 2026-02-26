type OAuthCallbackDeferred = {
  resolve: (code: string) => void;
  reject: (reason?: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

let pendingOAuthCallback: OAuthCallbackDeferred | undefined;

export function waitForOAuthCallbackCode(timeoutMs: number): Promise<string> {
  if (pendingOAuthCallback) {
    throw new Error('OAuth callback is already waiting for a code.');
  }

  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingOAuthCallback = undefined;
      reject(
        new Error(
          `Timed out after ${timeoutMs}ms waiting for OAuth callback on /auth_callback`,
        ),
      );
    }, timeoutMs);

    pendingOAuthCallback = {
      resolve: (code: string) => {
        clearTimeout(timeoutId);
        pendingOAuthCallback = undefined;
        resolve(code);
      },
      reject: (reason?: unknown) => {
        clearTimeout(timeoutId);
        pendingOAuthCallback = undefined;
        reject(reason);
      },
      timeoutId,
    };
  });
}

export function cancelOAuthCallbackWait(reason: unknown): void {
  if (!pendingOAuthCallback) {
    return;
  }

  clearTimeout(pendingOAuthCallback.timeoutId);
  const { reject } = pendingOAuthCallback;
  pendingOAuthCallback = undefined;
  reject(reason);
}

export function handleOAuthCallbackRequest(request: Request): Response {
  const requestUrl = new URL(request.url);

  if (!pendingOAuthCallback) {
    return new Response('No OAuth request is currently pending.', {
      status: 409,
    });
  }

  const error = requestUrl.searchParams.get('error');
  if (error) {
    pendingOAuthCallback.reject(
      new Error(`OAuth callback returned error: ${error}`),
    );
    return new Response('Authentication failed.', { status: 400 });
  }

  const code = requestUrl.searchParams.get('code');
  if (!code) {
    return new Response('Missing OAuth code.', { status: 400 });
  }

  pendingOAuthCallback.resolve(code);
  return new Response(
    `
<html lang="html">
<script>window.close()</script>
<body><h3>Dit venster mag gesloten worden</h3></body>
</html>
`,
    {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    },
  );
}
