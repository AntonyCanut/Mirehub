import type { MirehubAPI } from '../../preload/index'

declare global {
  interface Window {
    mirehub: MirehubAPI
  }
}
