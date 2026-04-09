import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, Search } from 'lucide-react'
import { apiUrl } from '@/lib/api'

type PumpReport = {
  id: string
  name: string
  city: string
  status: 'normal' | 'suspicious' | 'scam'
  score: number
  reports: number
  date: string
  lat: number | null
  lng: number | null
  company: string
}

type MapCenter = [number, number]

const statusColors: Record<PumpReport['status'], string> = {
  normal: '#00E5A0',
  suspicious: '#F5A623',
  scam: '#FF3B3B',
}

const MapContainerAny = MapContainer as any
const TileLayerAny = TileLayer as any
const CircleMarkerAny = CircleMarker as any

export function ReportsPage() {
  const [reports, setReports] = useState<PumpReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PumpReport['status']>('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')

  const [mapCenter, setMapCenter] = useState<MapCenter>([20.5937, 78.9629])
  const [mapZoom, setMapZoom] = useState(5)
  const [userLocation, setUserLocation] = useState<MapCenter | null>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    let active = true
    const loadReports = async () => {
      try {
        const response = await fetch(apiUrl('/api/reports'))
        if (!response.ok) {
          throw new Error('Unable to load reports')
        }
        const data = await response.json()
        if (!active) return
        setReports(data.items || [])
        setLoading(false)
      } catch (err) {
        if (!active) return
        setError('Unable to load community reports. Please try again.')
        setLoading(false)
      }
    }
    loadReports()
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    return reports.filter((pump) => {
      const matchesSearch = pump.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pump.city.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || pump.status === statusFilter
      const matchesCity = cityFilter === 'all' || pump.city === cityFilter
      const matchesCompany = companyFilter === 'all' || pump.company === companyFilter
      return matchesSearch && matchesStatus && matchesCity && matchesCompany
    })
  }, [reports, searchTerm, statusFilter, cityFilter, companyFilter])

  const cities = useMemo(() => {
    return Array.from(new Set(reports.map((pump) => pump.city))).sort()
  }, [reports])

  const companies = useMemo(() => {
    return Array.from(new Set(reports.map((pump) => pump.company))).sort()
  }, [reports])

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center: MapCenter = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(center)
        setMapCenter(center)
        setMapZoom(12)
        setLocating(false)
      },
      () => {
        setError('Unable to access location. Please allow permission.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-mono text-2xl lg:text-3xl font-bold text-foreground">
            Community Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crowd-sourced fuel pump trust scores from FuelGuard users across India.
          </p>
        </motion.div>

        {/* Map */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl overflow-hidden mb-8 relative"
        >
          <div className="h-[320px] lg:h-[380px]">
            <MapContainerAny
              center={mapCenter}
              zoom={mapZoom}
              scrollWheelZoom
              className="h-full w-full"
            >
              <MapController center={mapCenter} zoom={mapZoom} />
              <TileLayerAny
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {filtered
                .filter((pump) => isValidCoord(pump.lat, pump.lng))
                .map((pump) => (
                  <CircleMarkerAny
                    key={pump.id}
                    center={[pump.lat as number, pump.lng as number]}
                    radius={8}
                    pathOptions={{ color: statusColors[pump.status], fillOpacity: 0.8 }}
                  >
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-mono text-sm text-foreground">{pump.name}</div>
                        <div className="text-xs text-muted-foreground">{pump.city}</div>
                        <div className="text-xs text-muted-foreground">
                          Trust: {pump.score}/100 | Reports: {pump.reports}
                        </div>
                        <Link to={`/pump/${pump.id}`} className="text-xs text-primary hover:underline">
                          View pump profile
                        </Link>
                      </div>
                    </Popup>
                  </CircleMarkerAny>
                ))}
              {userLocation && (
                <CircleMarkerAny
                  center={userLocation}
                  radius={8}
                  pathOptions={{ color: '#60A5FA', fillOpacity: 0.8 }}
                >
                  <Popup>Your location</Popup>
                </CircleMarkerAny>
              )}
            </MapContainerAny>
          </div>
          {/* Near Me button */}
          <div className="absolute bottom-4 right-4">
            <Button variant="default" size="sm" className="gap-2 shadow-[var(--shadow-glow)]" onClick={handleNearMe}>
              <Navigation className="w-3.5 h-3.5" />
              {locating ? 'Locating...' : 'Near Me'}
            </Button>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search pump name or city..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'normal', 'suspicious', 'scam'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs font-data rounded-md border transition-colors ${
                  statusFilter === s
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 text-xs font-data rounded-md border bg-card border-border text-muted-foreground focus:outline-none"
            >
              <option value="all">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-2 text-xs font-data rounded-md border bg-card border-border text-muted-foreground focus:outline-none"
            >
              <option value="all">All Companies</option>
              {companies.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Pump List */}
        <div className="space-y-3">
          {loading && (
            <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
              Loading reports...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
              No pumps match your filters.
            </div>
          )}
          {filtered.map((pump, i) => (
            <motion.div
              key={pump.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link to={`/pump/${pump.id}`}>
                <div className="glass-card rounded-xl p-5 flex items-center gap-4 hover:border-primary/20 transition-all group cursor-pointer">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    pump.status === 'scam' ? 'bg-destructive/10' :
                    pump.status === 'suspicious' ? 'bg-warning/10' : 'bg-primary/10'
                  }`}>
                    <MapPin className={`w-5 h-5 ${
                      pump.status === 'scam' ? 'text-destructive' :
                      pump.status === 'suspicious' ? 'text-warning' : 'text-primary'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-foreground truncate">{pump.name}</h3>
                      <Badge variant={pump.status} className="shrink-0">
                        {pump.status === 'normal' ? 'Clean' : pump.status === 'suspicious' ? 'Suspicious' : 'Scam'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{pump.city}</span>
                      <span className="font-data">Trust: {pump.score}/100</span>
                      <span className="font-data">{pump.reports} reports</span>
                      <span className="font-data">{pump.date}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MapController({ center, zoom }: { center: MapCenter; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom, { animate: true })
  }, [center, zoom, map])
  return null
}

function isValidCoord(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  return lat !== 0 && lng !== 0
}
