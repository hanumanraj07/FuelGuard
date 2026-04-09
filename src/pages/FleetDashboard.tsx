import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Truck, AlertTriangle, IndianRupee,
  Plus, Download, Search, ChevronRight, BarChart3
} from 'lucide-react'
import { authHeaders } from '@/lib/auth'
import { apiUrl } from '@/lib/api'

type FleetStatus = 'normal' | 'suspicious' | 'scam'

type FleetVehicle = {
  reg: string
  driver: string
  lastFill: string
  status: FleetStatus
  flagged: number
}

type FleetStats = {
  totalVehicles: number
  fillsThisMonth: number
  flaggedIncidents: number
  estimatedFraudLoss: number
}

export function FleetDashboard() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [stats, setStats] = useState<FleetStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [regInput, setRegInput] = useState('')
  const [driverInput, setDriverInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    let active = true
    const loadFleet = async () => {
      try {
        const response = await fetch(apiUrl('/api/fleet/dashboard'), {
          headers: authHeaders(),
        })
        if (!response.ok) {
          throw new Error('Failed to load fleet')
        }
        const data = await response.json()
        if (!active) return
        setVehicles(Array.isArray(data.vehicles) ? data.vehicles : [])
        setStats(data.stats || null)
        setLoading(false)
      } catch (err) {
        if (!active) return
        setError('Unable to load fleet data. Please try again.')
        setLoading(false)
      }
    }
    loadFleet()
    return () => {
      active = false
    }
  }, [])

  const statCards = useMemo(() => {
    const safeStats = stats || {
      totalVehicles: 0,
      fillsThisMonth: 0,
      flaggedIncidents: 0,
      estimatedFraudLoss: 0,
    }

    return [
      { label: 'Total Vehicles', value: String(safeStats.totalVehicles), icon: Truck, change: 'Updated now' },
      { label: 'Fills This Month', value: String(safeStats.fillsThisMonth), icon: BarChart3, change: 'Based on uploads' },
      { label: 'Flagged Incidents', value: String(safeStats.flaggedIncidents), icon: AlertTriangle, change: 'This month' },
      { label: 'Est. Fraud Loss', value: `INR ${formatNumber(safeStats.estimatedFraudLoss)}`, icon: IndianRupee, change: 'This month' },
    ]
  }, [stats])

  const filtered = vehicles.filter((vehicle) => {
    const reg = (vehicle.reg || '').toLowerCase()
    const driver = (vehicle.driver || '').toLowerCase()
    const term = searchTerm.toLowerCase()
    return reg.includes(term) || driver.includes(term)
  })

  const handleAddVehicle = async () => {
    if (adding) return
    const regValue = regInput.trim()
    const driverValue = driverInput.trim()
    if (!regValue) {
      setAddError('Please enter a registration number.')
      return
    }
    setAdding(true)
    setAddError('')
    try {
      const response = await fetch(apiUrl('/api/fleet/vehicle'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          registration: regValue,
          driver: driverValue,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to add vehicle')
      }
      const data = await response.json()
      setVehicles(Array.isArray(data.vehicles) ? data.vehicles : [])
      setStats(data.stats || null)
      setRegInput('')
      setDriverInput('')
      setShowAddForm(false)
      setAdding(false)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unable to add vehicle.')
      setAdding(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4"
        >
          <div>
            <h1 className="font-mono text-2xl lg:text-3xl font-bold text-foreground">
              Fleet Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor fuel fills across your entire fleet.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            <Button variant="default" size="sm" className="gap-2" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="w-3.5 h-3.5" />
              Add Vehicle
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-data uppercase tracking-wider">
                  {stat.label}
                </span>
                <stat.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="font-mono text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </motion.div>
          ))}
        </div>

        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass-card rounded-xl p-6 mb-6"
          >
            <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Add New Vehicle</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Registration No. (e.g. MH-02-AB-1234)"
                value={regInput}
                onChange={(event) => setRegInput(event.target.value)}
                className="px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <input
                type="text"
                placeholder="Driver Name"
                value={driverInput}
                onChange={(event) => setDriverInput(event.target.value)}
                className="px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <Button variant="default" className="w-full" onClick={handleAddVehicle} disabled={adding}>
                {adding ? 'Adding...' : 'Add Vehicle'}
              </Button>
            </div>
            {addError && (
              <div className="mt-3 text-xs text-destructive">{addError}</div>
            )}
          </motion.div>
        )}

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vehicles or drivers..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {error && (
          <div className="mb-6 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl overflow-hidden"
        >
          <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 text-xs font-data text-muted-foreground uppercase tracking-wider border-b border-border bg-card/50">
            <span>Registration</span>
            <span>Driver</span>
            <span>Last Fill</span>
            <span>Status</span>
            <span className="text-right">Flags</span>
          </div>
          {loading && (
            <div className="px-5 py-6 text-sm text-muted-foreground">
              Loading fleet vehicles...
            </div>
          )}
          {!loading && filtered.map((vehicle, index) => {
            const regValue = (vehicle.reg || '').trim()
            const normalizedReg = regValue.toLowerCase()
            const rowKey = regValue ? `vehicle-${regValue}` : `vehicle-idx-${index}`
            const rowClasses = 'grid sm:grid-cols-5 gap-2 sm:gap-4 px-5 py-4 border-b border-border hover:bg-card/60 transition-colors cursor-pointer group items-center'
            const rowContent = (
              <>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-muted-foreground sm:hidden lg:block" />
                  <span className="font-data text-sm text-foreground font-medium">{regValue || 'Unknown'}</span>
                </div>
                <span className="text-sm text-muted-foreground">{vehicle.driver || 'Unassigned'}</span>
                <span className="font-data text-xs text-muted-foreground">{vehicle.lastFill}</span>
                <div>
                  <Badge variant={vehicle.status}>
                    {vehicle.status === 'normal' ? 'Normal' : vehicle.status === 'suspicious' ? 'Suspicious' : 'Scam'}
                  </Badge>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className={`font-data text-sm ${vehicle.flagged > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {vehicle.flagged}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </>
            )

            if (!regValue || normalizedReg === 'undefined' || normalizedReg === 'null') {
              return (
                <div key={rowKey} className={`${rowClasses} cursor-default`}>
                  {rowContent}
                </div>
              )
            }

            return (
              <Link
                key={rowKey}
                to={`/fleet/vehicle/${encodeURIComponent(regValue)}`}
                className={rowClasses}
              >
                {rowContent}
              </Link>
            )
          })}
          {!loading && filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No vehicles found matching "{searchTerm}"
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 glass-card rounded-xl p-6"
        >
          <h3 className="font-mono text-sm font-semibold text-foreground mb-3">API Integration</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your fleet management or ERP software to FuelGuard.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-2.5 text-xs font-data bg-background border border-border rounded-md text-muted-foreground overflow-hidden truncate">
              fg_live_key_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456
            </code>
            <Button variant="outline" size="sm">Copy</Button>
            <Button variant="ghost" size="sm" className="text-destructive">Regenerate</Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-IN').format(value)
}
