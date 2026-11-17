import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Trùng breakpoint `< 640px` (dưới `sm`) của Tailwind - thuần điện thoại di động. */
export const useIsMobile = () => useMediaQuery('(max-width: 639px)')
