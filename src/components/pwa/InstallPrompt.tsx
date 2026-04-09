import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'fuelguard.install.dismissed'

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = window.sessionStorage.getItem(DISMISS_KEY) === 'true'
    if (dismissed) return

    const handlePrompt = (event: Event) => {
      setDeferred(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    const handleInstalled = () => {
      setVisible(false)
      setDeferred(null)
      window.sessionStorage.removeItem(DISMISS_KEY)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferred) {
      setVisible(false)
      return
    }

    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        setVisible(false)
        setDeferred(null)
        window.sessionStorage.removeItem(DISMISS_KEY)
        return
      }
    } catch {
      // Fall through to hide the helper banner if the browser rejects the prompt.
    }

    setVisible(false)
  }

  const handleDismiss = () => {
    setVisible(false)
    window.sessionStorage.setItem(DISMISS_KEY, 'true')
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 px-4 pointer-events-none">
      <div className="container mx-auto max-w-2xl pointer-events-auto">
        <div className="glass-card rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-mono text-sm font-semibold text-foreground">Install FuelGuard</div>
            <div className="text-xs text-muted-foreground">
              Install from your browser for faster access, offline support, and a home-screen shortcut.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDismiss}>Not now</Button>
            <Button variant="default" size="sm" onClick={handleInstall}>Install</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
