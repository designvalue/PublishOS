export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>
          Crafted with{" "}
          <span className="craft-heart" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
              <path
                d="M8 14.2s-5.6-3.4-5.6-7.5a3.1 3.1 0 015.6-1.85A3.1 3.1 0 0113.6 6.7c0 4.1-5.6 7.5-5.6 7.5z"
                fill="#E11D48"
              />
            </svg>
          </span>{" "}
          <a href="https://designvalue.co/" target="_blank" rel="noreferrer" className="design-value-link">
            Design Value
          </a>
        </span>
        <div className="footer-right">
          <span>A fully open-source license</span>
          <span className="sep">·</span>
          <a href="https://github.com/designvalue/PublishOS" target="_blank" rel="noreferrer">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
