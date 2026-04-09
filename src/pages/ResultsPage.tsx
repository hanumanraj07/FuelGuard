import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Download, AlertTriangle, RotateCcw, ExternalLink, Copy, CheckCircle, Loader2, MapPin, Share2, MessageCircle } from 'lucide-react'
import { apiUrl } from '@/lib/api'

type Finding = {
  type: string
  frame?: number
  timestamp?: string
  from_value?: number
  to_value?: number
  delta?: number
  delta_seconds?: number
  detected_rate_lpm?: number
  max_physical_lpm?: number
}

type Reading = {
  timestamp: string
  value: number
  confidence: number
  frame: number
  seconds: number
}

type TerminalFinding = {
  time: string
  text: string
  status: 'ok' | 'error' | 'warning'
}

type AudioFlag = {
  type: string
  timestamp: string
  duration_ms: number
  source?: string
}

type Metrics = {
  max_jump_liters: number
  avg_flow_rate_lpm: number
  max_flow_rate_lpm: number
  total_dispensed_liters: number
}

type ResultPayload = {
  status: 'normal' | 'suspicious' | 'scam'
  confidence: number
  readings: Reading[]
  findings: Finding[]
  terminal_findings: TerminalFinding[]
  chart_data: { time: number; value: number }[]
  summary: string
  physical_inspection_score: number
  blockchain_tx_hash?: string
  video_url?: string
  meter_type?: string
  audio_anomaly_flags?: AudioFlag[]
  metrics?: Metrics
}

type PumpInfo = {
  id: string
  name: string
  city: string
  licenseNumber?: string
}

function withCacheBuster(url: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_ts=${Date.now()}`
}

export function ResultsPage() {
  const params = useParams()
  const jobId = params.id || ''
  const videoRef = useRef<HTMLVideoElement>(null)

  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'processing' | 'done' | 'failed'>('processing')
  const [result, setResult] = useState<ResultPayload | null>(null)
  const [pump, setPump] = useState<PumpInfo | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportStatus, setReportStatus] = useState<'normal' | 'suspicious' | 'scam'>('suspicious')
  const [reportReason, setReportReason] = useState('')
  const [reportError, setReportError] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportSuccess, setReportSuccess] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [selectedSeconds, setSelectedSeconds] = useState(0)

  useEffect(() => {
    let active = true
    let timeoutId: number | undefined

    console.log('ResultsPage useEffect triggered with jobId:', jobId)

    const poll = async () => {
      console.log('Polling for job:', jobId)
      const url = withCacheBuster(apiUrl(`/api/results/${jobId}`))
      console.log('Fetching URL:', url)
      try {
        const response = await fetch(url, { cache: 'no-store' })
        console.log('Response status:', response.status)
        if (!response.ok) throw new Error('Failed to fetch results')
        const data = await response.json()
        console.log('ResultsPage poll response:', data)
        console.log('data.status:', data.status)
        console.log('data.result:', data.result ? 'exists' : 'null')
        if (!active) return

        if (data.status === 'done') {
          console.log('Setting status to done, result:', data.result)
          setStatus('done')
          setResult(data.result)
          setPump(data.pump || null)
          setLoading(false)
          return
        }
        if (data.status === 'failed') {
          setStatus('failed')
          setError(data.error || 'Analysis failed.')
          setLoading(false)
          return
        }

        console.log('Job status still:', data.status, '- polling again in 2s')
        timeoutId = window.setTimeout(poll, 2000)
      } catch (err) {
        console.error('Poll error:', err)
        if (!active) return
        setError('Unable to load results. Please try again.')
        setStatus('failed')
        setLoading(false)
      }
    }

    if (jobId) {
      console.log('Calling poll()')
      void poll()
    } else {
      console.log('No jobId, not polling')
      setError('No job ID provided')
      setStatus('failed')
      setLoading(false)
    }

    return () => {
      active = false
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [jobId])

  useEffect(() => {
    if (result?.readings?.length) {
      setSelectedSeconds(result.readings[0].seconds || 0)
    }
  }, [result])

  const statusLabel = useMemo(() => {
    if (!result) return 'PROCESSING'
    if (result.status === 'normal') return 'NORMAL'
    if (result.status === 'suspicious') return 'SUSPICIOUS'
    return 'SCAM LIKELY'
  }, [result])

  const confidencePct = useMemo(() => {
    if (!result) return 0
    return Math.round((result.confidence > 1 ? result.confidence : result.confidence * 100))
  }, [result])

  const anomalyTimes = useMemo(() => {
    if (!result) return []
    return result.findings
      .filter((finding) => finding.type === 'sudden_jump' || finding.type === 'flow_rate_violation')
      .map((finding) => parseTimestamp(finding.timestamp || '00:00'))
  }, [result])

  const selectedReading = useMemo(() => {
    if (!result?.readings?.length) return null
    return result.readings.reduce((closest, reading) => {
      const currentGap = Math.abs(reading.seconds - selectedSeconds)
      const closestGap = Math.abs(closest.seconds - selectedSeconds)
      return currentGap < closestGap ? reading : closest
    }, result.readings[0])
  }, [result, selectedSeconds])

  const shareText = useMemo(() => {
    if (!result || !pump) return window.location.href
    return `${statusLabel} at ${pump.name}, ${pump.city}. ${result.summary} ${window.location.href}`
  }, [pump, result, statusLabel])

  const scrubberMax = result?.chart_data?.[result.chart_data.length - 1]?.time || 1

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    window.open(apiUrl(`/api/results/${jobId}/pdf`), '_blank', 'noopener')
  }

  const handleScrub = (value: number) => {
    setSelectedSeconds(value)
    if (videoRef.current) {
      videoRef.current.currentTime = value
    }
  }

  const handleReportSubmit = async () => {
    if (reportSubmitting) return
    setReportSubmitting(true)
    setReportError('')
    setReportSuccess('')
    try {
      const response = await fetch(apiUrl('/api/report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          pumpId: pump?.id || '',
          pumpName: pump?.name || '',
          city: pump?.city || '',
          status: reportStatus,
          reason: reportReason.trim(),
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to submit report')
      }
      setReportSuccess('Report submitted. Thank you for helping the community.')
      setReportReason('')
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Unable to submit report.')
    } finally {
      setReportSubmitting(false)
    }
  }

  const handleShareCard = async () => {
    if (shareLoading) return
    setShareLoading(true)
    setShareMessage('')
    try {
      const response = await fetch(apiUrl('/api/share-card'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      if (!response.ok) throw new Error('Unable to generate share card')
      const data = await response.json()
      window.open(data.imageUrl, '_blank', 'noopener')
      setShareMessage(data.shareText || 'Share card generated.')
    } catch (err) {
      setShareMessage(err instanceof Error ? err.message : 'Unable to generate share card.')
    } finally {
      setShareLoading(false)
    }
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')
  }

  const handleX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="glass-card rounded-xl p-10 text-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Processing analysis... This can take a minute.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!result || status === 'failed') {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="glass-card rounded-xl p-10 text-center">
            <AlertTriangle className="w-6 h-6 text-destructive mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">{error || 'Result unavailable.'}</p>
            <Link to="/upload" className="inline-block mt-4">
              <Button variant="default">Try Another Video</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="relative aspect-video bg-card">
                {result.video_url ? (
                  <video ref={videoRef} src={result.video_url} className="w-full h-full object-cover" controls onTimeUpdate={() => setSelectedSeconds(videoRef.current?.currentTime || 0)} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Demo evidence view</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />
              </div>

              <div className="p-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-data text-xs text-muted-foreground">Frame Scrubber</span>
                  <span className="font-data text-xs text-primary">{selectedReading ? `${selectedReading.timestamp} | F${selectedReading.frame}` : 'No reading selected'}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={scrubberMax}
                  step={0.1}
                  value={Math.min(selectedSeconds, scrubberMax)}
                  onChange={(event) => handleScrub(Number(event.target.value))}
                  className="w-full accent-[hsl(160_100%_45%)]"
                />
                <div className="relative h-2 rounded-full bg-secondary/50 mt-2">
                  {anomalyTimes.map((time, index) => (
                    <div key={`${time}-${index}`} className="absolute top-0 bottom-0 w-0.5 bg-destructive/80 rounded" style={{ left: `${timeToPercent(time, result.chart_data)}%` }} />
                  ))}
                </div>
                {selectedReading && (
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-data">
                    <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                      <div className="text-muted-foreground uppercase tracking-wider">Reading</div>
                      <div className="text-foreground mt-1">{selectedReading.value.toFixed(2)}L</div>
                    </div>
                    <div className="rounded-lg bg-secondary/30 border border-border px-3 py-2">
                      <div className="text-muted-foreground uppercase tracking-wider">OCR Confidence</div>
                      <div className={selectedReading.confidence < 0.7 ? 'text-warning mt-1' : 'text-primary mt-1'}>
                        {Math.round(selectedReading.confidence * 100)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card rounded-xl p-5">
              <h3 className="font-mono text-sm font-semibold text-foreground mb-3">Frame-by-Frame Readings</h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-2">
                {result.readings.map((reading, index) => {
                  const isAnomaly = result.findings.some((finding) => finding.timestamp === reading.timestamp)
                  return (
                    <div key={`${reading.frame}-${index}`} className={`flex items-center justify-between px-3 py-2 rounded text-xs font-data ${isAnomaly ? 'bg-destructive/10 border border-destructive/20' : reading.confidence < 0.7 ? 'bg-warning/10 border border-warning/20' : 'bg-secondary/30'}`}>
                      <span className="text-muted-foreground w-16">F{reading.frame}</span>
                      <span className="text-muted-foreground w-14">{reading.timestamp}</span>
                      <span className={isAnomaly ? 'text-destructive font-semibold' : 'text-foreground'}>{reading.value.toFixed(2)}L</span>
                      <span className={reading.confidence < 0.7 ? 'text-warning' : 'text-muted-foreground'}>{Math.round(reading.confidence * 100)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            {pump && (
              <div className="glass-card rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      Pump Details
                    </div>
                    <h3 className="font-mono text-lg font-semibold text-foreground mt-2">{pump.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{pump.city}</p>
                    {pump.licenseNumber && <p className="text-xs text-muted-foreground mt-1">License: {pump.licenseNumber}</p>}
                  </div>
                  <Link to={`/pump/${pump.id}`}>
                    <Button variant="outline" size="sm">View Pump</Button>
                  </Link>
                </div>
              </div>
            )}

            <div className={`glass-card rounded-xl p-8 text-center ${result.status === 'scam' ? 'animate-red-pulse' : ''}`}>
              <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full border-2 ${
                result.status === 'normal' ? 'bg-primary/10 border-primary/40 text-primary' : result.status === 'suspicious' ? 'bg-warning/10 border-warning/40 text-warning' : 'bg-destructive/10 border-destructive/40 text-destructive'
              }`}>
                {result.status === 'normal' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                <span className="font-mono text-2xl font-bold tracking-wider">{statusLabel}</span>
              </div>
              <div className="mt-4">
                <span className="font-data text-sm text-muted-foreground">Overall Confidence: </span>
                <span className="font-data text-lg font-bold">{confidencePct}%</span>
              </div>
            </div>

            {result.metrics && (
              <div className="grid sm:grid-cols-2 gap-3">
                <MetricCard label="Max Jump" value={`${result.metrics.max_jump_liters.toFixed(1)}L`} />
                <MetricCard label="Peak Flow" value={`${Math.round(result.metrics.max_flow_rate_lpm)} L/min`} />
                <MetricCard label="Avg Flow" value={`${Math.round(result.metrics.avg_flow_rate_lpm)} L/min`} />
                <MetricCard label="Total Dispensed" value={`${result.metrics.total_dispensed_liters.toFixed(1)}L`} />
              </div>
            )}

            <div className="glass-card rounded-xl p-5">
              <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Meter Reading Timeline</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.chart_data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 14%)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(220 16% 41%)' }} tickFormatter={(v) => `${v}s`} stroke="hsl(220 18% 14%)" />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(220 16% 41%)' }} tickFormatter={(v) => `${v}L`} stroke="hsl(220 18% 14%)" />
                    <Tooltip contentStyle={{ background: 'hsl(220 18% 8%)', border: '1px solid hsl(0 0% 100% / 0.07)', borderRadius: '8px', fontSize: '12px', fontFamily: 'Roboto Mono' }} labelFormatter={(v) => `Time: ${v}s`} formatter={(value: number) => [`${value}L`, 'Reading']} />
                    {anomalyTimes.map((time, index) => <ReferenceLine key={`${time}-${index}`} x={time} stroke="hsl(0 84% 60%)" strokeDasharray="3 3" />)}
                    <ReferenceLine x={Math.round(selectedSeconds)} stroke="hsl(160 100% 45%)" strokeDasharray="2 4" />
                    <Line type="monotone" dataKey="value" stroke="hsl(160 100% 45%)" strokeWidth={2} dot={{ r: 3, fill: 'hsl(160 100% 45%)' }} activeDot={{ r: 5, stroke: 'hsl(160 100% 45%)', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card rounded-xl p-5">
              <h3 className="font-mono text-sm font-semibold text-foreground mb-3">Forensic Findings</h3>
              <div className="terminal-block">
                {result.terminal_findings.map((finding, index) => (
                  <div key={`${finding.time}-${index}`} className="flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0">[{finding.time}]</span>
                    <span className={finding.status === 'error' ? 'text-destructive' : finding.status === 'warning' ? 'text-warning' : 'text-foreground'}>{finding.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-xl p-5">
              <h3 className="font-mono text-sm font-semibold text-foreground mb-3">AI Verdict</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
            </div>

            {result.audio_anomaly_flags && result.audio_anomaly_flags.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="font-mono text-sm font-semibold text-foreground mb-3">Audio / Timing Flags</h3>
                <div className="space-y-2">
                  {result.audio_anomaly_flags.map((flag, index) => (
                    <div key={`${flag.timestamp}-${index}`} className="rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
                      <div className="text-xs font-data text-warning uppercase tracking-wider">{flag.type}</div>
                      <div className="text-sm text-foreground mt-1">{flag.timestamp} | {flag.duration_ms} ms</div>
                      {flag.source && <div className="text-[11px] text-muted-foreground mt-1">Source: {flag.source}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-sm font-semibold text-foreground">Physical Inspection Score</h3>
                <span className={result.physical_inspection_score < 40 ? 'font-data text-lg font-bold text-destructive' : 'font-data text-lg font-bold text-primary'}>{result.physical_inspection_score} / 100</span>
              </div>
              <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                <div className={result.physical_inspection_score < 40 ? 'h-full rounded-full bg-destructive' : result.physical_inspection_score < 70 ? 'h-full rounded-full bg-warning' : 'h-full rounded-full bg-primary'} style={{ width: `${result.physical_inspection_score}%` }} />
              </div>
            </div>

            {result.blockchain_tx_hash && (
              <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">Blockchain Sealed</p>
                  <p className="font-data text-[10px] text-muted-foreground">TX: {truncateHash(result.blockchain_tx_hash)}</p>
                </div>
                <a href={`https://polygonscan.com/tx/${result.blockchain_tx_hash}`} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    <ExternalLink className="w-3 h-3" />
                    View
                  </Button>
                </a>
              </div>
            )}
          </motion.div>
        </div>

        {reportOpen && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 glass-card rounded-xl p-5">
            <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Report This Pump</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-data block mb-1.5">Report Type</label>
                <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value as 'normal' | 'suspicious' | 'scam')} className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                  <option value="normal">Normal</option>
                  <option value="suspicious">Suspicious</option>
                  <option value="scam">Scam</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-data block mb-1.5">Notes (optional)</label>
                <input type="text" value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Share what you observed" className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            </div>
            {reportError && <div className="text-xs text-destructive mt-3">{reportError}</div>}
            {reportSuccess && <div className="text-xs text-primary mt-3">{reportSuccess}</div>}
            <div className="mt-4">
              <Button variant="default" onClick={handleReportSubmit} disabled={reportSubmitting}>{reportSubmitting ? 'Submitting...' : 'Submit Report'}</Button>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 lg:mt-10 glass-card rounded-xl p-4 flex flex-wrap items-center gap-3 sticky bottom-4 z-20">
          <Button variant="default" className="gap-2 flex-1 min-w-[150px]" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            Evidence Report (PDF)
          </Button>
          <Button variant="destructive" className="gap-2 flex-1 min-w-[150px]" onClick={() => { setReportOpen((prev) => !prev); setReportError(''); setReportSuccess('') }}>
            <AlertTriangle className="w-4 h-4" />
            {reportOpen ? 'Close Report' : 'Report This Pump'}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleShareCard} disabled={shareLoading}>
            <Share2 className="w-4 h-4" />
            {shareLoading ? 'Generating...' : 'Share Card'}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleWhatsApp}>
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleX}>X</Button>
          <Button variant="outline" className="gap-2" onClick={handleCopy}>
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Link to="/upload">
            <Button variant="ghost" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              New Analysis
            </Button>
          </Link>
        </motion.div>

        {shareMessage && (
          <div className="mt-6 glass-card rounded-xl p-5">
            <h3 className="font-mono text-sm font-semibold text-foreground mb-3">Sharing</h3>
            <div className="terminal-block break-words">{shareMessage}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-data">{label}</div>
      <div className="text-lg font-mono text-foreground mt-2">{value}</div>
    </div>
  )
}

function parseTimestamp(value: string) {
  const parts = value.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

function timeToPercent(timeSeconds: number, chartData: { time: number }[]) {
  if (!chartData.length) return 0
  const max = chartData[chartData.length - 1].time || 1
  return Math.min(100, Math.max(0, (timeSeconds / max) * 100))
}

function truncateHash(hash: string) {
  if (!hash) return 'Unavailable'
  if (hash.length <= 12) return hash
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}
