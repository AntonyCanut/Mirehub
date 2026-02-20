import type { TheOneAPI } from '../../preload/index'

declare global {
  interface Window {
    theone: TheOneAPI
  }
}
