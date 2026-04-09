import { useState, useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Shield, Menu, X } from 'lucide-react'
import { authHeaders, isAuthenticated } from '@/lib/auth'
import { apiUrl } from '@/lib/api'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const navLinks = [
  { label: 'How it Works', href: '/how-it-works' },
  { label: 'Results', href: '/results' },
  { label: 'Reports', href: '/reports' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Fleet', href: '/fleet' },
  { label: 'Gov Portal', href: '/gov' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAuthed, setIsAuthed] = useState(isAuthenticated())
  const [latestResultId, setLatestResultId] = useState<string | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installVisible, setInstallVisible] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  useEffect(() => {
    const updateAuth = () => setIsAuthed(isAuthenticated())
    window.addEventListener('auth:changed', updateAuth)
    window.addEventListener('storage', updateAuth)
    return () => {
      window.removeEventListener('auth:changed', updateAuth)
      window.removeEventListener('storage', updateAuth)
    }
  }, [])

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setInstallVisible(true)
    }

    const handleInstalled = () => {
      setInstallVisible(false)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  useEffect(() => {
    if (!isAuthed) {
      setLatestResultId(null)
      return
    }

    let active = true
    const loadLatestResult = async () => {
      try {
        const response = await fetch(apiUrl('/api/user/history?limit=1'), {
          headers: authHeaders(),
        })
        if (!response.ok) return
        const data = await response.json()
        if (!active) return
        const latest = Array.isArray(data.items) && data.items.length ? data.items[0].id : null
        setLatestResultId(latest)
      } catch {
        if (!active) return
        setLatestResultId(null)
      }
    }
    loadLatestResult()
    return () => {
      active = false
    }
  }, [isAuthed])

  const resultsHref = useMemo(() => {
    return latestResultId ? `/results/${latestResultId}` : '/upload'
  }, [latestResultId])

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallVisible(false)
      setInstallPrompt(null)
    }
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-[0_1px_20px_hsl(0_0%_0%/0.3)]"
          : "bg-transparent"
      )}
    >
      <nav className="container mx-auto flex items-center justify-between h-16 px-4 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-mono font-bold text-lg tracking-tight text-foreground">
            Fuel<span className="text-primary">Guard</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href === '/results' ? resultsHref : link.href}
              className={cn(
                "px-3.5 py-2 text-sm font-medium rounded-md transition-colors",
                link.href === '/results'
                  ? location.pathname.startsWith('/results')
                  : location.pathname === link.href
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          {installVisible && (
            <Button variant="outline" size="sm" onClick={handleInstall}>
              Install
            </Button>
          )}
          {isAuthed ? (
            <>
              <Link to="/profile">
                <Button variant="ghost" size="sm">
                  Profile
                </Button>
              </Link>
            </>
          ) : (
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>
          )}
          <Link to="/upload">
            <Button variant="default" size="sm">
              Analyze Now
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href === '/results' ? resultsHref : link.href}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium rounded-md transition-colors",
                  link.href === '/results'
                    ? location.pathname.startsWith('/results')
                    : location.pathname === link.href
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-3 pt-3 border-t border-border mt-2">
              {isAuthed ? (
                <>
                  <Link to="/profile" className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">Profile</Button>
                  </Link>
                </>
              ) : (
                <Link to="/login" className="flex-1">
                  <Button variant="outline" className="w-full" size="sm">Login</Button>
                </Link>
              )}
              <Link to="/upload" className="flex-1">
                <Button variant="default" className="w-full" size="sm">Analyze Now</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
