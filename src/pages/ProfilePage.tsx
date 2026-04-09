import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Mail, Phone, Calendar, CreditCard, Settings, LogOut, ChevronRight, FileText, Coins, Gift, Bell } from 'lucide-react'
import { authHeaders, getAuthUser, logout, updateStoredAuthUser, type AuthUser } from '@/lib/auth'
import { apiUrl } from '@/lib/api'

type AnalysisItem = {
  id: string
  date: string
  pump: string
  status: 'normal' | 'suspicious' | 'scam'
  hasPdf: boolean
}

export function ProfilePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'history' | 'settings'>('history')
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([])
  const [loading, setLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [user, setUser] = useState<AuthUser | null>(getAuthUser())
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')

  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [language, setLanguage] = useState(user?.language || 'en')
  const [notificationEmail, setNotificationEmail] = useState(user?.notificationEmail !== false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      try {
        const [historyResponse, meResponse] = await Promise.all([
          fetch(apiUrl('/api/user/history?limit=50'), { headers: authHeaders() }),
          fetch(apiUrl('/api/auth/me'), { headers: authHeaders() }),
        ])

        const historyData = historyResponse.ok ? await historyResponse.json() : { items: [] }
        const meData = meResponse.ok ? await meResponse.json() : { user: getAuthUser() }

        if (!active) return

        const nextUser = (meData.user || getAuthUser()) as AuthUser | null
        setAnalyses(Array.isArray(historyData.items) ? historyData.items : [])
        setUser(nextUser)
        if (nextUser) {
          updateStoredAuthUser(nextUser)
          setName(nextUser.name || '')
          setPhone(nextUser.phone || '')
          setLanguage(nextUser.language || 'en')
          setNotificationEmail(nextUser.notificationEmail !== false)
        }
        setLoading(false)
      } catch {
        if (!active) return
        setHistoryError('Unable to load analysis history.')
        setLoading(false)
      }
    }

    void loadProfile()
    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => {
    const total = analyses.length
    const scams = analyses.filter((analysis) => analysis.status === 'scam').length
    const suspicious = analyses.filter((analysis) => analysis.status === 'suspicious').length
    const savings = scams * 199 + suspicious * 99
    return { total, scams, suspicious, savings }
  }, [analyses])

  const handleSave = async () => {
    setSaveState('saving')
    setSaveMessage('')
    try {
      const response = await fetch(apiUrl('/api/auth/me'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          language,
          notificationEmail,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to save settings')
      }
      const data = await response.json()
      const nextUser = data.user as AuthUser
      setUser(nextUser)
      updateStoredAuthUser(nextUser)
      setSaveState('saved')
      setSaveMessage('Settings saved.')
    } catch (err) {
      setSaveState('error')
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save settings.')
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6 lg:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="font-mono text-xl font-bold text-foreground">{user?.name || 'FuelGuard User'}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {user?.email || 'No email'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {user?.phone || 'Not added'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {user?.joinedAt || 'Recently'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="normal">{user?.plan || 'Free'}</Badge>
              {user?.isVerifiedReporter && <Badge variant="suspicious">Verified Reporter</Badge>}
              <Button variant="destructive" size="sm" onClick={handleLogout}>Logout</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            <QuickStat label="Total Analyses" value={String(stats.total)} />
            <QuickStat label="Frauds Found" value={String(stats.scams)} accent="text-destructive" />
            <QuickStat label="Suspicious" value={String(stats.suspicious)} accent="text-warning" />
            <QuickStat label="Est. Savings" value={`INR ${formatNumber(stats.savings)}`} />
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-6">
          <div>
            <div className="flex gap-1 mb-6">
              {(['history', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card'
                  }`}
                >
                  {tab === 'history' ? 'Analysis History' : 'Settings'}
                </button>
              ))}
            </div>

            {activeTab === 'history' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="glass-card rounded-xl overflow-hidden">
                  <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 text-xs font-data text-muted-foreground uppercase tracking-wider border-b border-border bg-card/50">
                    <span>Date</span>
                    <span className="col-span-2">Pump</span>
                    <span>Status</span>
                    <span className="text-right">Report</span>
                  </div>
                  {loading && <div className="px-5 py-6 text-sm text-muted-foreground">Loading analysis history...</div>}
                  {!loading && historyError && <div className="px-5 py-6 text-sm text-destructive">{historyError}</div>}
                  {!loading && !historyError && analyses.length === 0 && <div className="px-5 py-6 text-sm text-muted-foreground">No analyses found yet.</div>}
                  {analyses.map((analysis) => (
                    <Link key={analysis.id} to={`/results/${analysis.id}`} className="grid sm:grid-cols-5 gap-2 sm:gap-4 px-5 py-4 border-b border-border hover:bg-card/60 transition-colors items-center group">
                      <span className="font-data text-xs text-muted-foreground">{analysis.date}</span>
                      <span className="text-sm text-foreground col-span-2">{analysis.pump}</span>
                      <div>
                        <Badge variant={analysis.status}>
                          {analysis.status === 'normal' ? 'Normal' : analysis.status === 'suspicious' ? 'Suspicious' : 'Scam'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {analysis.hasPdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-7 text-xs"
                            onClick={(event) => {
                              event.preventDefault()
                              window.open(apiUrl(`/api/results/${analysis.id}/pdf`), '_blank', 'noopener')
                            }}
                          >
                            <FileText className="w-3 h-3" />
                            PDF
                          </Button>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-mono text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Account Settings
                  </h3>
                  <div className="space-y-4">
                    <Field label="Full Name">
                      <input value={name} onChange={(event) => setName(event.target.value)} className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    </Field>
                    <Field label="Phone">
                      <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    </Field>
                    <Field label="Language Preference">
                      <select value={language} onChange={(event) => setLanguage(event.target.value)} className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                        <option value="gu">Gujarati</option>
                        <option value="mr">Marathi</option>
                        <option value="ta">Tamil</option>
                        <option value="te">Telugu</option>
                        <option value="kn">Kannada</option>
                        <option value="bn">Bengali</option>
                      </select>
                    </Field>
                    <label className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
                      <div className="text-sm text-foreground">Email alerts for nearby fraud reports</div>
                      <input type="checkbox" checked={notificationEmail} onChange={(event) => setNotificationEmail(event.target.checked)} className="accent-[hsl(160_100%_45%)]" />
                    </label>
                    <div className="flex items-center gap-3">
                      <Button variant="default" size="sm" onClick={handleSave} disabled={saveState === 'saving'}>
                        {saveState === 'saving' ? 'Saving...' : 'Save Changes'}
                      </Button>
                      {saveMessage && (
                        <span className={saveState === 'error' ? 'text-xs text-destructive' : 'text-xs text-primary'}>
                          {saveMessage}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-mono text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Subscription
                  </h3>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                    <div>
                      <span className="font-mono text-sm font-semibold text-foreground">{user?.plan || 'Free'}</span>
                      <span className="text-xs text-muted-foreground ml-2">{user?.plan === 'Free' ? '0 INR / month' : 'Managed plan'}</span>
                    </div>
                    <Badge variant="normal">Active</Badge>
                  </div>
                  <Link to="/pricing">
                    <Button variant="outline" size="sm">Change Plan</Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-6">
            <SideCard icon={Coins} title="FuelCoins" value={String(user?.fuelCoins || 0)} description="Earned from analysis activity and community reporting." />
            <SideCard icon={Gift} title="Referral Code" value={user?.referralCode || 'Not assigned'} description="Invite a friend and unlock bonus analyses." />
            <SideCard icon={Bell} title="Alerts" value={notificationEmail ? 'Enabled' : 'Muted'} description="Control how FuelGuard contacts you about nearby fraud reports." />
            <div className="glass-card rounded-xl p-6 border-destructive/20">
              <h3 className="font-mono text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Danger Zone
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Logout from this device. Account deletion is not enabled in this build yet.</p>
              <Button variant="destructive" size="sm" onClick={handleLogout}>Logout</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickStat({ label, value, accent = 'text-foreground' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center">
      <div className={`font-mono text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground font-data block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SideCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof Coins
  title: string
  value: string
  description: string
}) {
  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-sm font-semibold text-foreground">{title}</h3>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="font-mono text-xl text-foreground">{value}</div>
      <p className="text-sm text-muted-foreground mt-2">{description}</p>
    </div>
  )
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-IN').format(value)
}
