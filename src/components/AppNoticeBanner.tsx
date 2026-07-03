interface AppNoticeBannerProps {
  title: string
  message: string
  primaryLabel: string
  secondaryLabel: string
  placement?: 'inline' | 'fixed'
  onPrimary: () => void
  onSecondary: () => void
}

export function AppNoticeBanner({
  title,
  message,
  primaryLabel,
  secondaryLabel,
  placement = 'inline',
  onPrimary,
  onSecondary,
}: AppNoticeBannerProps) {
  return (
    <div
      className={`app-notice-banner app-notice-banner-${placement}`}
      role="status"
      aria-live="polite"
    >
      <div className="app-notice-banner-content">
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      <div className="app-notice-banner-actions">
        <button className="btn-primary" type="button" onClick={onPrimary}>
          {primaryLabel}
        </button>
        <button className="btn-text" type="button" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      </div>
    </div>
  )
}
