export type StudioIconName =
  | 'play'
  | 'pause'
  | 'reset'
  | 'direct'
  | 'join'
  | 'settings'
  | 'write'
  | 'close'
  | 'replay'
  | 'headphones'
  | 'stop';

type StudioIconProps = {
  name: StudioIconName;
  size?: number;
};

export function StudioIcon({ name, size = 20 }: StudioIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'play' && <path d="m8 5 11 7-11 7z" />}
      {name === 'pause' && (
        <>
          <path d="M8 5h3v14H8zM15 5h3v14h-3z" />
        </>
      )}
      {name === 'reset' && <path d="M4 7v5h5M5 12a7 7 0 1 0 2-5" />}
      {name === 'direct' && (
        <>
          <path d="M4 9h16v11H4zM4 9l2.2-5H22l-2 5" />
          <path d="m8 4 3 5m3-5 3 5" />
        </>
      )}
      {name === 'join' && (
        <>
          <path d="M4 5.5h16v11H9l-5 3z" />
          <path d="M8 10.5v1M11 9v4M14 8v6M17 10v2" />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="m19.2 13.7 1.2.9-1.4 2.5-1.5-.5a7.6 7.6 0 0 1-1.4.8l-.3 1.6h-2.9l-.3-1.6a7.6 7.6 0 0 1-1.4-.8l-1.5.5-1.4-2.5 1.2-.9a7.8 7.8 0 0 1 0-1.6l-1.2-.9 1.4-2.5 1.5.5a7.6 7.6 0 0 1 1.4-.8l.3-1.6h2.9l.3 1.6a7.6 7.6 0 0 1 1.4.8l1.5-.5 1.4 2.5-1.2.9a7.8 7.8 0 0 1 0 1.6Z" />
        </>
      )}
      {name === 'write' && (
        <>
          <path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5z" />
          <path d="m13.8 6.7 3.5 3.5M4 5h5" />
        </>
      )}
      {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
      {name === 'replay' && (
        <>
          <path d="M4 11a8 8 0 1 1 2.2 5.5M4 5v6h6" />
          <path d="m11 9 5 3-5 3z" />
        </>
      )}
      {name === 'headphones' && (
        <>
          <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
          <path d="M4 13h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2ZM20 13h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2Z" />
        </>
      )}
      {name === 'stop' && <rect x="6" y="6" width="12" height="12" rx="1.5" />}
    </svg>
  );
}
