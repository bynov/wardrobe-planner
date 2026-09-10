import { useEffect, useState } from 'react';

/**
 * The phone/tablet breakpoint: the one place the layout switches from the three-pane desktop
 * design to a single stacked column. It must stay in step with the `max-width: 820px` blocks in
 * `styles.css` — the CSS moves the panes, this query moves the behaviour that goes with them.
 */
export const NARROW_QUERY = '(max-width: 820px)';

/** True while `query` matches. Safe to call where there is no `window` (tests run in node). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches); // the query may have changed since the initial state was taken
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Safari only grew addEventListener on MediaQueryList in 14; older iPhones still need the
    // deprecated pair, and they are exactly the devices this breakpoint exists for.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}
