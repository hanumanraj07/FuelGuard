import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Truck, AlertTriangle, Calendar, MapPin, Pencil } from 'lucide-react'
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts'
import { authHeaders } from '@/lib/auth'
import { apiUrl } from '@/lib/api'

type FleetStatus = 'normal' | 'suspicious' | 'scam'

type VehicleDetail = {
  reg: string
  driver: string
  status: FleetStatus
  totalFills: number
  flaggedFills: number
  lastFill: string
}

type FillItem = {
  date: string
  dateIso?: string
  liters: number
  amount: number
  status: FleetStatus
  notes: string
  pumpName: string
  pumpCity: string
  pumpLat: number | null
  pumpLng: number | null
  invoiceUrl: string
  invoiceName: string
}

type FillSummary = {
  totalLiters: number
  totalAmount: number
  averageRate: number
}

export function FleetVehiclePage() {
  const params = useParams()
  const registration = params.id ? decodeURIComponent(params.id) : ''

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null)
  const [fills, setFills] = useState<FillItem[]>([])
  const [summary, setSummary] = useState<FillSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [fillDate, setFillDate] = useState('')
  const [fillLiters, setFillLiters] = useState('')
  const [fillAmount, setFillAmount] = useState('')
  const [fillStatus, setFillStatus] = useState<FleetStatus>('normal')
  const [fillNotes, setFillNotes] = useState('')
  const [pumpName, setPumpName] = useState('')
  const [pumpCity, setPumpCity] = useState('')
  const [pumpLat, setPumpLat] = useState('')
  const [pumpLng, setPumpLng] = useState('')

  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [invoiceName, setInvoiceName] = useState('')
  const [invoiceUploading, setInvoiceUploading] = useState(false)
  const [invoiceError, setInvoiceError] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let active = true
    const loadVehicle = async () => {
      const invalid = !registration ||
        registration.toLowerCase() === 'undefined' ||
        registration.toLowerCase() === 'null'
      if (invalid) {
        if (active) {
          setError('Vehicle not found.')
          setLoading(false)
        }
        return
      }
      try {
        const response = await fetch(apiUrl(`/api/fleet/vehicle/${encodeURIComponent(registration)}`), {
          headers: authHeaders(),
        })
        if (!response.ok) {
          throw new Error('Unable to load vehicle')
        }
        const data = await response.json()
        if (!active) return
        setVehicle(data.vehicle || null)
        setFills(Array.isArray(data.fills) ? data.fills : [])
        setSummary(data.summary || null)
        setLoading(false)
      } catch (err) {
        if (!active) return
        setError('Unable to load vehicle details. Please try again.')
        setLoading(false)
      }
    }
    loadVehicle()
    return () => {
      active = false
    }
  }, [registration])

  const statusLabel = useMemo(() => {
    if (!vehicle) return ''
    if (vehicle.status === 'normal') return 'Normal'
    if (vehicle.status === 'suspicious') return 'Suspicious'
    return 'Scam'
  }, [vehicle])

  const trendData = useMemo(() => {
    if (!fills.length) return []
    const map = new Map<string, { key: string; label: string; total: number; flagged: number }>()
    fills.forEach((fill) => {
      const iso = fill.dateIso || ''
      const key = iso ? iso.slice(0, 7) : fill.date
      const label = iso
        ? new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        : fill.date
      const current = map.get(key) || { key, label, total: 0, flagged: 0 }
      current.total += 1
      if (fill.status !== 'normal') {
        current.flagged += 1
      }
      map.set(key, current)
    })
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
  }, [fills])

  const handleInvoiceUpload = async (file: File) => {
    setInvoiceUploading(true)
    setInvoiceError('')
    try {
      const formData = new FormData()
      formData.append('invoice', file)
      const response = await fetch(apiUrl('/api/fleet/invoice'), {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to upload invoice')
      }
      const data = await response.json()
      setInvoiceUrl(data.url || '')
      setInvoiceName(data.name || file.name)
      setInvoiceUploading(false)
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Unable to upload invoice.')
      setInvoiceUploading(false)
    }
  }

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setSaveError('Geolocation is not supported in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPumpLat(String(pos.coords.latitude))
        setPumpLng(String(pos.coords.longitude))
      },
      () => {
        setSaveError('Unable to access location. Please allow permission.')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleAddFill = async () => {
    if (!registration || saving) return
    const liters = Number(fillLiters)
    const amount = Number(fillAmount)

    if (!Number.isFinite(liters) || liters <= 0) {
      setSaveError('Please enter a valid liters amount.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setSaveError('Please enter a valid rupee amount.')
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      const response = await fetch(apiUrl(`/api/fleet/vehicle/${encodeURIComponent(registration)}/fill`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          date: fillDate || undefined,
          liters,
          amount,
          status: fillStatus,
          notes: fillNotes.trim(),
          pumpName: pumpName.trim(),
          pumpCity: pumpCity.trim(),
          pumpLat: pumpLat.trim(),
          pumpLng: pumpLng.trim(),
          invoiceUrl,
          invoiceName,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to add fill')
      }

      const data = await response.json()
      setVehicle(data.vehicle || null)
      setFills(Array.isArray(data.fills) ? data.fills : [])
      setSummary(data.summary || null)
      setFillDate('')
      setFillLiters('')
      setFillAmount('')
      setFillNotes('')
      setFillStatus('normal')
      setPumpName('')
      setPumpCity('')
      setPumpLat('')
      setPumpLng('')
      setInvoiceUrl('')
      setInvoiceName('')
      setSaving(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to add fill.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div className="glass-card rounded-xl p-10 text-sm text-muted-foreground text-center">
            Loading vehicle details...
          </div>
        </div>
      </div>
    )
  }

  if (!vehicle || error) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div className="glass-card rounded-xl p-10 text-sm text-destructive text-center">
            {error || 'Vehicle not found.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/fleet" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to fleet
          </Link>
          <Link to={`/fleet/vehicle/${encodeURIComponent(vehicle.reg)}/edit`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Pencil className="w-3.5 h-3.5" />
              Edit Vehicle
            </Button>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6 lg:p-8 mb-6"
        >
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Truck className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="font-mono text-xl lg:text-2xl font-bold text-foreground">{vehicle.reg}</h1>
                <Badge variant={vehicle.status}>{statusLabel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Driver: {vehicle.driver || 'Unassigned'}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-data">
                <span>Total fills: {vehicle.totalFills}</span>
                <span>|</span>
                <span>Flagged: {vehicle.flaggedFills}</span>
                <span>|</span>
                <span>Last fill: {vehicle.lastFill}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-xl p-6"
            >
              <h2 className="font-mono text-sm font-semibold text-foreground mb-4">Add Fuel Fill</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground font-data block mb-1.5">Fill Date</label>
                  <input
                    type="date"
                    value={fillDate}
                    onChange={(event) => setFillDate(event.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-data block mb-1.5">Status</label>
                  <select
                    value={fillStatus}
                    onChange={(event) => setFillStatus(event.target.value as FleetStatus)}
                    className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="normal">Normal</option>
                    <option value="suspicious">Suspicious</option>
                    <option value="scam">Scam</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-data block mb-1.5">Liters Filled</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fillLiters}
                    onChange={(event) => setFillLiters(event.target.value)}
                    placeholder="e.g. 45.5"
                    className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-data block mb-1.5">Amount Paid (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fillAmount}
                    onChange={(event) => setFillAmount(event.target.value)}
                    placeholder="e.g. 3800"
                    className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-data block mb-1.5">Pump Name</label>
                  <input
                    type="text"
                    value={pumpName}
                    onChange={(event) => setPumpName(event.target.value)}
                    placeholder="e.g. HP Petrol Pump"
                    className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-data block mb-1.5">Pump City</label>
                  <input
                    type="text"
                    value={pumpCity}
                    onChange={(event) => setPumpCity(event.target.value)}
                    placeholder="e.g. Mumbai"
                    className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-data block mb-1.5">Pump Latitude</label>
                  <input
                    type="text"
                    value={pumpLat}
                    onChange={(event) => setPumpLat(event.target.value)}
                    placeholder="19.076"
                    className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-data block mb-1.5">Pump Longitude</label>
                  <input
                    type="text"
                    value={pumpLng}
                    onChange={(event) => setPumpLng(event.target.value)}
                    placeholder="72.877"
                    className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="mt-3">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleUseLocation}>
                  <MapPin className="w-3.5 h-3.5" />
                  Use Current Location
                </Button>
              </div>
              <div className="mt-4">
                <label className="text-xs text-muted-foreground font-data block mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  value={fillNotes}
                  onChange={(event) => setFillNotes(event.target.value)}
                  placeholder="Optional notes about the fill..."
                  className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>

              <div className="mt-4">
                <label className="text-xs text-muted-foreground font-data block mb-2">Invoice Upload</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        void handleInvoiceUpload(file)
                      }
                    }}
                    className="text-xs text-muted-foreground"
                  />
                  {invoiceUploading && (
                    <span className="text-xs text-muted-foreground">Uploading...</span>
                  )}
                  {invoiceUrl && (
                    <span className="text-xs text-primary">{invoiceName || 'Invoice uploaded'}</span>
                  )}
                </div>
                {invoiceError && (
                  <div className="text-xs text-destructive mt-2">{invoiceError}</div>
                )}
              </div>

              {saveError && (
                <div className="mt-3 text-xs text-destructive">{saveError}</div>
              )}
              <div className="mt-4">
                <Button variant="default" onClick={handleAddFill} disabled={saving} className="gap-2">
                  <Calendar className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Add Fill Record'}
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-xl p-6"
            >
              <h2 className="font-mono text-sm font-semibold text-foreground mb-4">Fill History</h2>
              {fills.length === 0 && (
                <div className="text-sm text-muted-foreground">No fills recorded for this vehicle yet.</div>
              )}
              <div className="space-y-3">
                {fills.map((fill, index) => (
                  <div key={`${fill.date}-${index}`} className="flex flex-col gap-2 py-3 px-3 rounded-md bg-secondary/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-sm text-foreground font-data">{fill.date}</div>
                        <div className="text-xs text-muted-foreground">{fill.liters} L | INR {formatNumber(fill.amount)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={fill.status}>
                          {fill.status === 'normal' ? 'Normal' : fill.status === 'suspicious' ? 'Suspicious' : 'Scam'}
                        </Badge>
                        {fill.invoiceUrl && (
                          <a
                            href={fill.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View Invoice
                          </a>
                        )}
                      </div>
                    </div>
                    {(fill.pumpName || fill.pumpCity || fill.notes) && (
                      <div className="text-xs text-muted-foreground">
                        {[fill.pumpName, fill.pumpCity].filter(Boolean).join(', ')}
                        {fill.notes ? ` | ${fill.notes}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-xl p-5"
            >
              <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Totals</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Total liters</span>
                  <span className="font-data text-foreground">{summary?.totalLiters || 0} L</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total spend</span>
                  <span className="font-data text-foreground">INR {formatNumber(summary?.totalAmount || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Avg rate</span>
                  <span className="font-data text-foreground">INR {formatNumber(summary?.averageRate || 0)} / L</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="glass-card rounded-xl p-5"
            >
              <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Fraud Trend</h3>
              {trendData.length === 0 ? (
                <div className="text-xs text-muted-foreground">Not enough data to show a trend yet.</div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 14%)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(220 16% 41%)' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(220 16% 41%)' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(220 18% 8%)',
                          border: '1px solid hsl(0 0% 100% / 0.07)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontFamily: 'Roboto Mono',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="total" name="Total Fills" fill="hsl(160 100% 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="flagged" name="Flagged" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card rounded-xl p-5 text-center"
            >
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
              <h3 className="font-mono text-sm font-semibold text-foreground mb-2">
                Flagged Fills
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {vehicle.flaggedFills} fills marked as suspicious or scam.
              </p>
              <Button variant="destructive" className="w-full gap-2">
                <AlertTriangle className="w-4 h-4" />
                Open Investigation
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-IN').format(value)
}
