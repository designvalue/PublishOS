/**
 * Workspace wordmark — the official "publishOS · by Design Value" lockup.
 *
 * Source: `public/brand/publishos-wordmark.svg`. Rendered as a plain <img>
 * so the SVG is used exactly as the designer shipped it — no transforms,
 * no recolouring, no font substitution.
 *
 * Sizes correspond to surfaces:
 *   sm — top bar
 *   md — settings header and other small lockups
 *   lg — auth screens, password gate, marketing surfaces
 */
export default function BrandWordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/publishos-wordmark.svg"
      alt="PublishOS — by Design Value"
      draggable={false}
      className={`brand-wordmark brand-wordmark-${size}${className ? ` ${className}` : ""}`}
    />
  );
}
