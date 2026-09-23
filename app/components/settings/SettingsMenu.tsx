'use client'

import { Eye, EyeOff, Lock, Settings } from 'lucide-react'
import { canHideNavItem, isNavItemVisible, navItems, setNavItemVisibility } from '@/lib/nav-items'
import Popover from '../Popover'
import { useAppSettings } from './SettingsProvider'

/**
 * The top bar's settings panel. Today it holds one thing — which tabs are on
 * the rail — but it is the home for any other per-user app preference, so
 * the sections are laid out to take a second one.
 *
 * Uses the in-place `Popover` (not the portalled `Modal`) so it stays
 * anchored to its button in the fixed header, and so it inherits the page's
 * CSS variables like every other menu in the app.
 */
export default function SettingsMenu({
  triggerClassName,
  onOpenChange,
}: {
  triggerClassName: string
  /** Lets the top bar stop auto-hiding on scroll while the panel is open. */
  onOpenChange?: (open: boolean) => void
}) {
  const { settings, updateSettings, error } = useAppSettings()
  const hidden = settings.hidden_nav_items

  const toggle = (href: string) => {
    const item = navItems.find((entry) => entry.href === href)
    if (!item || !canHideNavItem(item)) return
    void updateSettings({
      hidden_nav_items: setNavItemVisibility(hidden, item, !isNavItemVisible(item, hidden)),
    })
  }

  const hiddenCount = navItems.filter((item) => !isNavItemVisible(item, hidden)).length

  return (
    <Popover
      label="Settings"
      align="end"
      onOpenChange={onOpenChange}
      panelClassName="w-72 max-h-[calc(100vh-6rem)] overflow-y-auto"
      trigger={(props) => (
        <button type="button" {...props} title="Settings" aria-label="Settings" className={triggerClassName}>
          <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label-caps text-on-surface-variant">Navigation</span>
          {hiddenCount > 0 && (
            <span className="rounded-full bg-surface-container-highest px-2 py-0.5 label-caps text-on-surface-variant">
              {hiddenCount} hidden
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const shown = isNavItemVisible(item, hidden)
            const lockedOn = !canHideNavItem(item)
            const Icon = lockedOn ? Lock : shown ? Eye : EyeOff
            return (
              <li key={item.href}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shown}
                  aria-label={`${item.label} tab`}
                  disabled={lockedOn}
                  onClick={() => toggle(item.href)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-container-high disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      lockedOn
                        ? 'text-outline'
                        : shown
                          ? 'text-primary-container'
                          : 'text-on-surface-variant/50'
                    }`}
                    strokeWidth={1.75}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`body-sm ${
                        shown ? 'text-on-surface' : 'text-on-surface-variant line-through'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="truncate text-[11px] text-outline">
                      {lockedOn ? 'Always on the rail' : item.href}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                      lockedOn
                        ? 'bg-surface-container-highest opacity-40'
                        : shown
                          ? 'bg-primary-container'
                          : 'bg-surface-container-highest'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-3 w-3 rounded-full bg-surface-container-lowest transition-[left] ${
                        shown ? 'left-3.5' : 'left-0.5'
                      }`}
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="text-[11px] leading-relaxed text-outline">
          Hiding a tab only takes it off the rail and the mobile bar — the page stays reachable by
          its link. Home can&apos;t be hidden.
        </p>

        {error && <p className="text-[11px] leading-relaxed text-error">{error}</p>}
      </div>
    </Popover>
  )
}
