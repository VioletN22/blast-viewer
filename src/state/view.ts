import { create } from 'zustand'

/** Metres per screen pixel at the orbit target, written by ScaleProbe when it changes by more than 1%. */
export const useMetresPerPixel = create<{ mpp: number }>()(() => ({ mpp: 0 }))
