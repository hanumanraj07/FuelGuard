import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save } from 'lucide-react'
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

export function FleetVehicleEditPage() {
  const params = useParams()
  const navigate = useNavigate()
  const registration = params.id ? decodeURIComponent(params.id) : ''

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [regInput, setRegInput] = useState('')
  const [driverInput, setDriverInput] = useState('')

  useEffect(() => {
    let active = true
    const loadVehicle = async () => {
      if (!registration || registration.toLowerCase() === 'undefined') {
        setError('Vehicle not found.')
        setLoading(false)
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
        setRegInput(data.vehicle?.reg || '')
        setDriverInput(data.vehicle?.driver || '')
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

  const handleSave = async () => {
    if (!vehicle || saving) return
    if (!regInput.trim()) {
      setSaveError('Registration is required.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const response = await fetch(apiUrl(`/api/fleet/vehicle/${encodeURIComponent(vehicle.reg)}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          registration: regInput.trim(),
          driver: driverInput.trim(),
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to update vehicle')
      }
      const data = await response.json()
      const updatedReg = data.vehicle?.reg || regInput.trim()
      navigate(`/fleet/vehicle/${encodeURIComponent(updatedReg)}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to update vehicle.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <div className="glass-card rounded-xl p-10 text-sm text-muted-foreground text-center">
            Loading vehicle...
          </div>
        </div>
      </div>
    )
  }

  if (!vehicle || error) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <div className="glass-card rounded-xl p-10 text-sm text-destructive text-center">
            {error || 'Vehicle not found.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/fleet/vehicle/${encodeURIComponent(vehicle.reg)}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to vehicle
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6 lg:p-8"
        >
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-mono text-xl font-bold text-foreground">Edit Vehicle</h1>
              <p className="text-sm text-muted-foreground">Update registration and driver information.</p>
            </div>
            <Badge variant={vehicle.status}>Current: {vehicle.status}</Badge>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-data block mb-1.5">Registration</label>
              <input
                type="text"
                value={regInput}
                onChange={(event) => setRegInput(event.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-data block mb-1.5">Driver Name</label>
              <input
                type="text"
                value={driverInput}
                onChange={(event) => setDriverInput(event.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            {saveError && (
              <div className="text-xs text-destructive">{saveError}</div>
            )}
            <div className="flex items-center gap-3">
              <Button variant="default" onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/fleet/vehicle/${encodeURIComponent(vehicle.reg)}`)}>
                Cancel
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
