"use client";

/**
 * Aspirational placeholder for the planned "Pilot" workspace agent.
 *
 * No data is fetched — this is a marketing surface that reserves space on
 * the home page for the day Pilot actually ships (an AI assistant that
 * watches workspace activity and surfaces notable events). When that lands,
 * replace this component with a real live feed wired to `/api/live-feed`
 * (already scaffolded in lib/data/live-feed.ts).
 */
export default function LiveStatus() {
  return (
    <div className="live-status">
      <span className="live-dot" aria-hidden="true" />
      <p className="live-message">
        Pilot is monitoring this workspace. I&apos;ll surface anything notable here as you publish.
      </p>
    </div>
  );
}
