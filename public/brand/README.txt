PublishOS brand assets
======================

publishos-wordmark.svg — the official "publishOS · by Design Value"
                         lockup. Used throughout the app via
                         components/shell/BrandWordmark.tsx and the
                         password-gate HTML in app/c/[id]/[[...path]]/route.ts.

To replace the wordmark, just overwrite the .svg file in place. Every
brand surface picks it up automatically on the next request — no code
changes, no rebuild.

Used at three sizes:
    sm  =  22px tall   (top bar)
    md  =  32px tall   (settings header, etc.)
    lg  =  56px tall   (auth screens, password gate)

Width is height-derived from the SVG's own viewBox (991×245).
