import React from 'react'
import { NotificationCenter } from './NotificationCenter'

export function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <span className="titlebar-title">Workspaces</span>
      <div className="titlebar-actions">
        <NotificationCenter />
      </div>
    </div>
  )
}
