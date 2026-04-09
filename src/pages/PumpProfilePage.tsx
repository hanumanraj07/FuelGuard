import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Star, AlertTriangle, MessageSquare } from 'lucide-react'
import { apiUrl } from '@/lib/api'

type PumpStatus = 'normal' | 'suspicious' | 'scam'

type PumpDetail = {
  id: string
  name: string
  city: string
  status: PumpStatus
  score: number
  reports: number
  date: string
  lat: number | null
  lng: number | null
  company: string
  licenseNumber?: string
  lastCalibrationDate?: string
}

type PumpAnalysis = {
  id: string
  date: string
  status: PumpStatus
  verdict: string
}

type PumpReview = {
  user: string
  rating: number
  date: string
  text: string
}

export function PumpProfilePage() {
  const params = useParams()
  const pumpId = params.id || ''

  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportStatus, setReportStatus] = useState<PumpStatus>('suspicious')
  const [reportReason, setReportReason] = useState('')
  const [reportError, setReportError] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportSuccess, setReportSuccess] = useState('')
  const [pump, setPump] = useState<PumpDetail | null>(null)
  const [analyses, setAnalyses] = useState<PumpAnalysis[]>([])
  const [reviews, setReviews] = useState<PumpReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadPump = async () => {
      if (!pumpId) return
      setLoading(true)
      setError('')
      try {
        const response = await fetch(apiUrl(`/api/pump/${pumpId}`))
        if (!response.ok) {
          throw new Error('Failed to load pump profile')
        }
        const data = await response.json()
        if (!active) return
        setPump(data.pump || null)
        setAnalyses(Array.isArray(data.analyses) ? data.analyses : [])
        setReviews(Array.isArray(data.reviews) ? data.reviews : [])
        setLoading(false)
      } catch (err) {
        if (!active) return
        setError('Unable to load pump profile. Please try again.')
        setLoading(false)
      }
    }
    loadPump()
    return () => {
      active = false
    }
  }, [pumpId])

  const statusLabel = useMemo(() => {
    if (!pump) return ''
    if (pump.status === 'normal') return 'Clean'
    if (pump.status === 'suspicious') return 'Suspicious'
    return 'Scam'
  }, [pump])

  const statusClasses = useMemo(() => {
    if (!pump) {
      return {
        iconBg: 'bg-primary/10 border-primary/20',
        iconColor: 'text-primary',
        scoreColor: 'text-primary',
      }
    }
    if (pump.status === 'scam') {
      return {
        iconBg: 'bg-destructive/10 border-destructive/20',
        iconColor: 'text-destructive',
        scoreColor: 'text-destructive',
      }
    }
    if (pump.status === 'suspicious') {
      return {
        iconBg: 'bg-warning/10 border-warning/20',
        iconColor: 'text-warning',
        scoreColor: 'text-warning',
      }
    }
    return {
      iconBg: 'bg-primary/10 border-primary/20',
      iconColor: 'text-primary',
      scoreColor: 'text-primary',
    }
  }, [pump])

  const ratingBreakdown = useMemo(() => {
    const average = reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0
    const safeAverage = Number.isFinite(average) ? Math.max(0, Math.min(5, average)) : 0
    return [
      { label: 'Meter Accuracy', value: safeAverage },
      { label: 'Staff Behavior', value: safeAverage },
      { label: 'Wait Time', value: safeAverage },
      { label: 'Cleanliness', value: safeAverage },
      { label: 'Receipt Given', value: safeAverage },
    ]
  }, [reviews])

  const handleReviewSubmit = async () => {
    if (!pumpId || reviewSubmitting) return
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('Please select a star rating.')
      return
    }
    if (!reviewText.trim()) {
      setReviewError('Please share a short review before submitting.')
      return
    }
    setReviewSubmitting(true)
    setReviewError('')
    try {
      const response = await fetch(apiUrl(`/api/pump/${pumpId}/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: reviewRating,
          text: reviewText.trim(),
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to submit review')
      }
      const data = await response.json()
      setReviews(Array.isArray(data.reviews) ? data.reviews : reviews)
      setReviewRating(0)
      setReviewText('')
      setShowReviewForm(false)
      setReviewSubmitting(false)
    } catch (err) {
      setReviewError('Unable to submit review. Please try again.')
      setReviewSubmitting(false)
    }
  }

  const handleReportSubmit = async () => {
    if (!pump || reportSubmitting) return
    setReportSubmitting(true)
    setReportError('')
    setReportSuccess('')
    try {
      const response = await fetch(apiUrl('/api/report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pumpId: pump.id,
          status: reportStatus,
          reason: reportReason.trim(),
          pumpName: pump.name,
          city: pump.city,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to submit report')
      }
      const data = await response.json()
      if (data?.pump) {
        setPump(data.pump)
      }
      setReportReason('')
      setReportOpen(false)
      setReportSuccess('Report submitted. Thank you for helping the community.')
      setReportSubmitting(false)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Unable to submit report.')
      setReportSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div className="glass-card rounded-xl p-10 text-sm text-muted-foreground text-center">
            Loading pump profile...
          </div>
        </div>
      </div>
    )
  }

  if (!pump || error) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div className="glass-card rounded-xl p-10 text-sm text-destructive text-center">
            {error || 'Pump data unavailable.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6 lg:p-8 mb-6"
        >
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className={`w-16 h-16 rounded-xl border flex items-center justify-center shrink-0 ${statusClasses.iconBg}`}>
              <MapPin className={`w-8 h-8 ${statusClasses.iconColor}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="font-mono text-xl lg:text-2xl font-bold text-foreground">
                  {pump.name}
                </h1>
                <Badge variant={pump.status}>{statusLabel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {pump.city} | {pump.company}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-data">
                <span>License: {pump.licenseNumber || 'Not provided'}</span>
                <span>|</span>
                <span>Last Calibration: {pump.lastCalibrationDate || 'Not available'}</span>
                <span>|</span>
                <span>{pump.reports} reports</span>
                <span>|</span>
                <span>Last updated: {pump.date}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm font-semibold text-foreground">Community Trust Score</h2>
                <span className={`font-mono text-3xl font-bold ${statusClasses.scoreColor}`}>{pump.score}</span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full ${
                    pump.score < 40 ? 'bg-destructive' : pump.score < 70 ? 'bg-warning' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, pump.score))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground font-data">
                <span>0 - High Risk</span>
                <span>100 - Trusted</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card rounded-xl p-6"
            >
              <h2 className="font-mono text-sm font-semibold text-foreground mb-4">
                Recent Analysis Results
              </h2>
              <div className="space-y-2">
                {analyses.length === 0 && (
                  <div className="py-3 px-3 rounded-md bg-secondary/20 text-xs text-muted-foreground">
                    No analyses available for this pump yet.
                  </div>
                )}
                {analyses.map((analysis) => (
                  <div key={analysis.id} className="flex items-center justify-between py-2.5 px-3 rounded-md bg-secondary/20">
                    <div className="flex items-center gap-3">
                      <span className="font-data text-xs text-muted-foreground w-20">{analysis.date}</span>
                      <Badge variant={analysis.status}>
                        {analysis.status === 'normal' ? 'Normal' : analysis.status === 'suspicious' ? 'Suspicious' : 'Scam'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:block">{analysis.verdict}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm font-semibold text-foreground">User Reviews</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowReviewForm(!showReviewForm)}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Write Review
                </Button>
              </div>

              {showReviewForm && (
                <div className="mb-6 p-4 rounded-lg bg-secondary/20 border border-border">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-0.5"
                      >
                        <Star className={`w-5 h-5 ${
                          star <= reviewRating ? 'text-warning fill-warning' : 'text-muted-foreground'
                        }`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Share your experience at this pump..."
                    rows={3}
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none mb-3"
                  />
                  {reviewError && (
                    <div className="text-xs text-destructive mb-2">{reviewError}</div>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleReviewSubmit}
                    disabled={reviewSubmitting}
                  >
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                {reviews.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No reviews yet. Be the first to leave feedback.
                  </div>
                )}
                {reviews.map((review, i) => (
                  <div key={`${review.user}-${i}`} className="pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{review.user}</span>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`w-3 h-3 ${
                              s <= review.rating ? 'text-warning fill-warning' : 'text-muted-foreground'
                            }`} />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-data">{review.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{review.text}</p>
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
              <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Rating Breakdown</h3>
              {ratingBreakdown.map((item) => (
                <div key={item.label} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-data text-foreground">{item.value.toFixed(1)}/5</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.value < 2 ? 'bg-destructive' : item.value < 3 ? 'bg-warning' : 'bg-primary'
                      }`}
                      style={{ width: `${(item.value / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card rounded-xl p-5 text-center"
            >
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
              <h3 className="font-mono text-sm font-semibold text-foreground mb-2">
                Report This Pump
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Help protect other consumers by filing a complaint.
              </p>
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={() => {
                  setReportOpen((prev) => !prev)
                  setReportError('')
                  setReportSuccess('')
                }}
              >
                <AlertTriangle className="w-4 h-4" />
                {reportOpen ? 'Close' : 'File Report'}
              </Button>
              {reportSuccess && (
                <div className="mt-3 text-xs text-primary">{reportSuccess}</div>
              )}
              {reportOpen && (
                <div className="mt-4 text-left space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-data block mb-1.5">
                      Report Type
                    </label>
                    <select
                      value={reportStatus}
                      onChange={(event) => setReportStatus(event.target.value as PumpStatus)}
                      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      <option value="normal">Normal</option>
                      <option value="suspicious">Suspicious</option>
                      <option value="scam">Scam</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-data block mb-1.5">
                      Details (optional)
                    </label>
                    <textarea
                      rows={3}
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                      placeholder="Share what you observed at this pump..."
                      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                    />
                  </div>
                  {reportError && (
                    <div className="text-xs text-destructive">{reportError}</div>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={handleReportSubmit}
                    disabled={reportSubmitting}
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
