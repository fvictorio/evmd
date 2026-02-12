interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="evmd-error-banner">
      <span className="evmd-error-message">{message}</span>
      <button className="evmd-error-dismiss" onClick={onDismiss} title="Dismiss">
        ×
      </button>
    </div>
  );
}
