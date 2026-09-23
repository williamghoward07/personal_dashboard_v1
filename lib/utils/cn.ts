import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The BIO-SYSTEM type scale (`--text-*` in app/globals.css) produces utilities
 * like `text-label-caps` and `text-headline-lg`. tailwind-merge can't know
 * those are font sizes, so out of the box it files them under text *colour*
 * and `cn('text-headline-lg', 'text-on-surface')` silently returns only
 * `text-on-surface` — the size vanishes with no error.
 *
 * Registering them in the `font-size` group makes them collide with each other
 * (correct) and not with colours (also correct).
 *
 * Keep in sync with the `--text-*` tokens in app/globals.css. The equivalent
 * `@utility` classes there (`label-caps`, `headline-lg`, …) carry the font
 * family too, so prefer those in new code; these spellings stay supported.
 */
const TYPE_SCALE = [
  "label-caps",
  "headline-md",
  "headline-lg",
  "headline-lg-mobile",
  "headline-xl",
  "data-display",
  "body-lg",
  "body-md",
  "body-sm",
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TYPE_SCALE }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
