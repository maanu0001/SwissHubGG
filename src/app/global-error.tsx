'use client';

/**
 * Letzte Auffangebene, falls bereits das Wurzel-Layout fehlschlägt.
 * Enthält bewusst eigenes HTML-Grundgerüst und keine Abhängigkeiten.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de-CH">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          background: '#0b0c10',
          color: '#f4f5f7',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Die Website ist vorübergehend nicht erreichbar</h1>
        <p style={{ color: '#b0b4be', maxWidth: '32rem', margin: 0, lineHeight: 1.6 }}>
          Bitte versuche es in einigen Minuten erneut. Wir arbeiten daran, das Problem zu beheben.
        </p>
        {error.digest ? (
          <p style={{ color: '#868b96', fontSize: '0.75rem', margin: 0 }}>Fehlerkennung: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            padding: '0.7rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#83060a',
            color: '#ffffff',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Erneut versuchen
        </button>
      </body>
    </html>
  );
}
