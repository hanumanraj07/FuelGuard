import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import {
  Shield, Users, AlertTriangle, MapPin, Filter, Download,
  Bell
} from 'lucide-react'
import { apiUrl } from '@/lib/api'

type GovStats = {
  totalReports: number
  activeInspections: number
  pumpsFlagged: number
  avgResolutionDays: number
}

type FraudCity = {
  city: string
  rate: number
}

type FraudCompany = {
  name: string
  value: number
  color?: string
}

type MonthlyTrend = {
  month: string
  reports: number
}

type RecentReport = {
  pump: string
  city: string
  type: string
  count: number
  date: string
  inspector: string
}

type AlertItem = {
  pump: string
  message: string
  time: string
}

export function GovPortal() {
  const [jurisdiction, setJurisdiction] = useState('all')
  const [stats, setStats] = useState<GovStats | null>(null)
  const [fraudByCity, setFraudByCity] = useState<FraudCity[]>([])
  const [fraudByCompany, setFraudByCompany] = useState<FraudCompany[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([])
  const [recentReports, setRecentReports] = useState<RecentReport[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadDashboard = async () => {
      try {
        const response = await fetch(apiUrl('/api/gov/dashboard'))
        if (!response.ok) {
          throw new Error('Unable to load gov dashboard')
        }
        const data = await response.json()
        if (!active) return
        setStats(data.stats || null)
        setFraudByCity(Array.isArray(data.fraudByCity) ? data.fraudByCity : [])
        setFraudByCompany(Array.isArray(data.fraudByCompany) ? data.fraudByCompany : [])
        setMonthlyTrend(Array.isArray(data.monthlyTrend) ? data.monthlyTrend : [])
        setRecentReports(Array.isArray(data.recentReports) ? data.recentReports : [])
        setAlerts(Array.isArray(data.alerts) ? data.alerts : [])
        setLoading(false)
      } catch (err) {
        if (!active) return
        setError('Unable to load government dashboard data.')
        setLoading(false)
      }
    }
    loadDashboard()
    return () => {
      active = false
    }
  }, [])

  const statCards = [
    { label: 'Total Reports', value: stats ? String(stats.totalReports) : '-', icon: AlertTriangle },
    { label: 'Active Inspections', value: stats ? String(stats.activeInspections) : '-', icon: Users },
    { label: 'Pumps Flagged', value: stats ? String(stats.pumpsFlagged) : '-', icon: MapPin },
    { label: 'Avg Resolution', value: stats ? `${stats.avgResolutionDays} days` : '-', icon: Shield },
  ]

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-data text-xs text-primary tracking-widest uppercase">
                Government Portal
              </span>
            </div>
            <h1 className="font-mono text-2xl lg:text-3xl font-bold text-foreground">
              Regulatory Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Legal Metrology Department - Fraud Monitoring and Inspector Assignment
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="px-3 py-2 text-sm rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="all">All States</option>
              <option value="maharashtra">Maharashtra</option>
              <option value="delhi">Delhi NCR</option>
              <option value="karnataka">Karnataka</option>
              <option value="tamilnadu">Tamil Nadu</option>
              <option value="gujarat">Gujarat</option>
            </select>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
          </div>
        </motion.div>

        {error && (
          <div className="mb-6 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {!error && alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-8 space-y-3"
          >
            {alerts.map((alert, i) => (
              <div key={`${alert.pump}-${i}`} className="flex items-center gap-4 px-5 py-3 rounded-xl bg-destructive/5 border border-destructive/20">
                <Bell className="w-4 h-4 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{alert.pump}</span>
                  <span className="text-sm text-muted-foreground"> - {alert.message}</span>
                </div>
                <span className="text-xs text-muted-foreground font-data shrink-0">{alert.time}</span>
              </div>
            ))}
          </motion.div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              className="glass-card rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-data uppercase tracking-wider">{stat.label}</span>
                <stat.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="font-mono text-2xl font-bold text-foreground">{stat.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-xl p-5"
          >
            <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Fraud Rate by City</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fraudByCity} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 14%)" />
                  <XAxis dataKey="city" tick={{ fontSize: 10, fill: 'hsl(220 16% 41%)' }} stroke="hsl(220 18% 14%)" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(220 16% 41%)' }} stroke="hsl(220 18% 14%)" tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(220 18% 8%)', border: '1px solid hsl(0 0% 100% / 0.07)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Roboto Mono' }}
                    formatter={(value: number) => [`${value}%`, 'Fraud Rate']}
                  />
                  <Bar dataKey="rate" fill="hsl(160 100% 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {fraudByCity.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground mt-2">No city data available yet.</p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-xl p-5"
          >
            <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Reports by Oil Company</h3>
            <div className="h-56 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fraudByCompany}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {fraudByCompany.map((entry) => (
                      <Cell key={entry.name} fill={entry.color || 'hsl(160 100% 45%)'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(220 18% 8%)', border: '1px solid hsl(0 0% 100% / 0.07)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Roboto Mono' }}
                    formatter={(value: number) => [`${value}%`, 'Share']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              {fraudByCompany.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: c.color || 'hsl(160 100% 45%)' }} />
                  <span className="text-xs text-muted-foreground">{c.name}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card rounded-xl p-5 lg:col-span-2"
          >
            <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Monthly Report Trend</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 14%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(220 16% 41%)' }} stroke="hsl(220 18% 14%)" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(220 16% 41%)' }} stroke="hsl(220 18% 14%)" />
                  <Tooltip
                    contentStyle={{ background: 'hsl(220 18% 8%)', border: '1px solid hsl(0 0% 100% / 0.07)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Roboto Mono' }}
                  />
                  <Line type="monotone" dataKey="reports" stroke="hsl(160 100% 45%)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(160 100% 45%)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-mono text-sm font-semibold text-foreground">Recent Reports</h3>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </Button>
          </div>
          <div className="hidden sm:grid grid-cols-6 gap-4 px-5 py-3 text-xs font-data text-muted-foreground uppercase tracking-wider border-b border-border bg-card/50">
            <span>Pump</span>
            <span>City</span>
            <span>Fraud Type</span>
            <span>Reports</span>
            <span>Inspector</span>
            <span className="text-right">Date</span>
          </div>
          {recentReports.map((report, i) => (
            <div
              key={`${report.pump}-${i}`}
              className="grid sm:grid-cols-6 gap-2 sm:gap-4 px-5 py-4 border-b border-border hover:bg-card/60 transition-colors cursor-pointer items-center"
            >
              <span className="text-sm font-medium text-foreground">{report.pump}</span>
              <span className="text-sm text-muted-foreground">{report.city}</span>
              <span className="text-xs font-data text-warning">{report.type}</span>
              <span className="font-data text-sm text-destructive font-medium">{report.count}</span>
              <span className={`text-xs font-data ${report.inspector === 'Unassigned' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {report.inspector}
              </span>
              <span className="text-xs font-data text-muted-foreground text-right">{report.date}</span>
            </div>
          ))}
          {!loading && recentReports.length === 0 && (
            <div className="px-5 py-8 text-sm text-muted-foreground">No reports available yet.</div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
