import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Upload, Camera, Film, X, CheckCircle, Loader2, FileVideo, AlertTriangle, Navigation } from 'lucide-react'
import { authHeaders } from '@/lib/auth'
import { apiUrl } from '@/lib/api'
import { enqueueUpload, getQueuedUploads, removeQueuedUpload } from '@/lib/offlineQueue'

type AnalysisStep = 'idle' | 'uploading' | 'extracting' | 'reading' | 'analyzing' | 'done' | 'error'

const stepMessages: Record<AnalysisStep, string> = {
  idle: '',
  uploading: 'Uploading video...',
  extracting: 'Extracting frames...',
  reading: 'Reading meter values...',
  analyzing: 'Running fraud analysis...',
  done: 'Done',
  error: 'Analysis failed',
}

const sampleOcr = ['0.00L', '1.20L', '3.40L', '5.60L', '7.80L']

function withCacheBuster(url: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_ts=${Date.now()}`
}

export function UploadPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const analysisStartRef = useRef<number | null>(null)

  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [step, setStep] = useState<AnalysisStep>('idle')
  const [progress, setProgress] = useState(0)
  const [frameCount, setFrameCount] = useState(0)
  const [ocrValues, setOcrValues] = useState<string[]>([])
  const [showCamera, setShowCamera] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [recording, setRecording] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [brightness, setBrightness] = useState<number | null>(null)
  const [shakeWarning, setShakeWarning] = useState(false)
  const [error, setError] = useState('')

  const [pumpName, setPumpName] = useState('')
  const [city, setCity] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [language, setLanguage] = useState('en')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [queueNotice, setQueueNotice] = useState('')
  const [queueProcessing, setQueueProcessing] = useState(false)
  const fileTooLarge = file ? file.size > 200 * 1024 * 1024 : false

  const lightingStatus = useMemo(() => {
    if (brightness === null) return { label: 'Checking lighting...', tone: 'text-muted-foreground' }
    if (brightness < 60) return { label: 'Low light', tone: 'text-warning' }
    if (brightness < 110) return { label: 'Moderate light', tone: 'text-warning' }
    return { label: 'Good light', tone: 'text-primary' }
  }, [brightness])

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setError('')
    setQueueNotice('')
    const url = URL.createObjectURL(f)
    setPreview(url)
  }, [])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('video/')) handleFile(f)
  }, [handleFile])

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const openCamera = async () => {
    setCameraError('')
    setShowCamera(true)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: true,
      })
      setCameraStream(stream)
    } catch (err) {
      setCameraError('Camera permission denied. Please allow access or upload a file instead.')
    }
  }

  const stopCamera = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
    }
    setCameraStream(null)
    setShowCamera(false)
    setRecording(false)
  }, [cameraStream])

  const startRecording = () => {
    if (!cameraStream) return
    if (typeof MediaRecorder === 'undefined') {
      setCameraError('Recording is not supported in this browser.')
      return
    }
    recordingChunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
    const recorder = new MediaRecorder(cameraStream, { mimeType })
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: mimeType })
      const recordedFile = new File([blob], `fuelguard-${Date.now()}.webm`, { type: blob.type })
      handleFile(recordedFile)
      stopCamera()
    }
    recorder.start(200)
    recorderRef.current = recorder
    setRecording(true)
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  useEffect(() => {
    if (!cameraStream || !cameraVideoRef.current) return
    cameraVideoRef.current.srcObject = cameraStream
  }, [cameraStream])

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [cameraStream])

  useEffect(() => {
    if (!cameraStream || !cameraVideoRef.current) return
    const video = cameraVideoRef.current
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let prevFrame: Uint8ClampedArray | null = null

    const interval = setInterval(() => {
      if (!ctx || video.readyState < 2) return
      canvas.width = 64
      canvas.height = 64
      ctx.drawImage(video, 0, 0, 64, 64)
      const data = ctx.getImageData(0, 0, 64, 64).data

      let sum = 0
      for (let i = 0; i < data.length; i += 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3
      }
      const avg = sum / (data.length / 4)
      setBrightness(avg)

      if (prevFrame) {
        let diff = 0
        for (let i = 0; i < data.length; i += 4) {
          diff += Math.abs(data[i] - prevFrame[i])
        }
        diff = diff / (data.length / 4)
        setShakeWarning(diff > 18)
      }
      prevFrame = data.slice()
    }, 600)

    return () => clearInterval(interval)
  }, [cameraStream])

  useEffect(() => {
    if (step === 'extracting') {
      setFrameCount(0)
      const interval = setInterval(() => {
        setFrameCount((prev) => Math.min(prev + 3, 180))
      }, 120)
      return () => clearInterval(interval)
    }
    if (step === 'reading') {
      setOcrValues([])
      let index = 0
      const interval = setInterval(() => {
        setOcrValues((prev) => [...prev, sampleOcr[index % sampleOcr.length]])
        index += 1
      }, 280)
      return () => clearInterval(interval)
    }
    return undefined
  }, [step])

  const uploadWithProgress = (payload: FormData) => {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', apiUrl('/api/upload'))
      Object.entries(authHeaders()).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value.toString())
      })

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100))
        }
      }
      xhr.onload = () => {
        const isOk = xhr.status >= 200 && xhr.status < 300
        let payloadData: any = null
        try {
          payloadData = xhr.responseText ? JSON.parse(xhr.responseText) : null
        } catch {
          payloadData = null
        }
        if (isOk) {
          if (payloadData?.jobId) {
            console.log('Job ID received:', payloadData.jobId)
            resolve(payloadData.jobId)
          } else {
            console.log('Invalid response:', payloadData)
            reject(new Error('Invalid response from server'))
          }
          return
        }
        const message = payloadData?.detail || payloadData?.error || xhr.responseText || 'Upload failed'
        reject(new Error(message))
      }
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.send(payload)
    })
  }

  const flushQueuedUploads = useCallback(async () => {
    if (!navigator.onLine || queueProcessing) return
    setQueueProcessing(true)
    try {
      const queued = await getQueuedUploads()
      if (!queued.length) {
        setQueueProcessing(false)
        return
      }
      const submitted: string[] = []
      for (const item of queued) {
        const formData = new FormData()
        const fileBlob = item.file instanceof Blob ? item.file : new Blob([item.file], { type: item.fileType })
        const file = new File([fileBlob], item.fileName, { type: item.fileType || 'video/webm' })
        formData.append('video', file)
        formData.append('pumpName', item.meta.pumpName)
        formData.append('city', item.meta.city)
        formData.append('licenseNumber', item.meta.licenseNumber)
        formData.append('language', item.meta.language)
        if (item.meta.lat && item.meta.lng) {
          formData.append('lat', item.meta.lat)
          formData.append('lng', item.meta.lng)
        }

        const response = await fetch(apiUrl('/api/upload'), {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        })
        if (response.ok) {
          const data = await response.json().catch(() => ({}))
          if (data?.jobId) submitted.push(data.jobId)
          await removeQueuedUpload(item.id)
        } else {
          break
        }
      }
      if (submitted.length) {
        setQueueNotice(`Queued upload submitted (${submitted.length}). Check your history for results.`)
      }
    } catch (err) {
      setQueueNotice('Unable to process queued uploads yet.')
    } finally {
      setQueueProcessing(false)
    }
  }, [queueProcessing])

  useEffect(() => {
    if (!navigator.onLine) return
    void flushQueuedUploads()
  }, [flushQueuedUploads])

  useEffect(() => {
    const handleOnline = () => {
      void flushQueuedUploads()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [flushQueuedUploads])

  const pollJob = async (jobId: string) => {
    const maxAttempts = 120
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      console.log(`Polling attempt ${attempt + 1} for job ${jobId}`)
      const response = await fetch(withCacheBuster(apiUrl(`/api/results/${jobId}`)), { cache: 'no-store' })
      console.log('Poll response status:', response.status)
      if (!response.ok) {
        await wait(1500)
        continue
      }
      const data = await response.json()
      console.log('Poll response data:', data)
      if (data.status === 'done') {
        setStep('done')
        await wait(600)
        navigate(`/results/${jobId}`)
        return
      }
      if (data.status === 'failed') {
        setStep('error')
        setError(data.error || 'Analysis failed.')
        return
      }

      const elapsed = analysisStartRef.current ? Date.now() - analysisStartRef.current : 0
      if (elapsed < 3500) setStep('extracting')
      else if (elapsed < 7000) setStep('reading')
      else setStep('analyzing')

      await wait(1500)
    }

    try {
      const url = withCacheBuster(apiUrl(`/api/results/${jobId}`))
      console.log('Final check URL:', url)
      const response = await fetch(url, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        console.log('Final check response:', data)
        if (data.status === 'done') {
          setStep('done')
          await wait(600)
          navigate(`/results/${jobId}`)
          return
        }
        if (data.status === 'failed') {
          setStep('error')
          setError(data.error || 'Analysis failed.')
          return
        }
      }
    } catch {
      // Fall through to the timeout message below.
    }

    setStep('error')
    setError('Analysis is still processing. Please check the result again in a minute.')
  }

  const startAnalysis = async () => {
    if (!file) return
    if (!navigator.onLine) {
      await enqueueUpload({
        file,
        fileName: file.name,
        fileType: file.type,
        meta: {
          pumpName,
          city,
          licenseNumber,
          language,
          lat,
          lng,
        },
      })
      setQueueNotice('You are offline. Upload queued and will submit when you are back online.')
      setStep('idle')
      return
    }
    setError('')
    setStep('uploading')
    setProgress(0)
    analysisStartRef.current = Date.now()

    const payload = new FormData()
    payload.append('video', file)
    payload.append('pumpName', pumpName)
    payload.append('city', city)
    payload.append('licenseNumber', licenseNumber)
    payload.append('language', language)
    if (lat && lng) {
      payload.append('lat', lat)
      payload.append('lng', lng)
    }

    try {
      const jobId = await uploadWithProgress(payload)
      await pollJob(jobId)
    } catch (err) {
      setStep('error')
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setStep('idle')
    setProgress(0)
    setFrameCount(0)
    setOcrValues([])
    setError('')
    setQueueNotice('')
    analysisStartRef.current = null
  }

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported in this browser.')
      return
    }
    setLocating(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6))
        setLng(pos.coords.longitude.toFixed(6))
        setLocating(false)
      },
      () => {
        setLocationError('Unable to access location. Please allow permission.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const showProgress = step !== 'idle'
  const isProcessing = step !== 'idle' && step !== 'error'
  const showStartButton = step === 'idle' || step === 'error'

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="font-mono text-3xl lg:text-4xl font-bold text-foreground">
            Upload Your Video
          </h1>
          <p className="text-muted-foreground mt-3">
            Record or upload a video of the fuel pump meter for AI analysis.
          </p>
        </motion.div>

        {/* Upload Zone */}
        {!file && !showCamera && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative cursor-pointer rounded-xl border-2 border-dashed p-12 lg:p-16 text-center
                transition-all duration-300 group
                ${dragOver
                  ? 'border-primary bg-primary/5 shadow-[var(--shadow-glow)]'
                  : 'border-border hover:border-primary/40 hover:bg-card/50'
                }
              `}
            >
              {/* Pulse rings when idle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-32 rounded-full border border-primary/10 animate-pulse-ring" />
                <div className="w-32 h-32 rounded-full border border-primary/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
              </div>

              <div className="relative z-10">
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/15 transition-colors">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-mono text-lg font-semibold text-foreground mb-2">
                  Drag & drop your video here
                </h3>
                <p className="text-sm text-muted-foreground mb-1">
                  Supports MP4, MOV, AVI, WebM - up to 200MB
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse files
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/mov,video/avi,video/webm,video/*"
                capture="environment"
                className="hidden"
                onChange={onFileSelect}
              />
            </div>

            {/* Camera option */}
            <div className="mt-6 text-center">
              <button
                onClick={(e) => { e.stopPropagation(); openCamera() }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-card/50 transition-all"
              >
                <Camera className="w-4 h-4" />
                Record directly from browser
              </button>
            </div>
          </motion.div>
        )}

        {/* Camera Mode */}
        {showCamera && !file && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            <div className="aspect-video bg-card relative flex items-center justify-center">
              {cameraStream ? (
                <video
                  ref={cameraVideoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              ) : (
                <div className="text-center px-6">
                  <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {cameraError || 'Starting camera...'}
                  </p>
                </div>
              )}

              {/* Alignment guide overlay */}
              <div className="absolute inset-12 border-2 border-dashed border-primary/30 rounded-lg" />
            </div>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className={`font-data ${lightingStatus.tone}`}>Light: {lightingStatus.label}</span>
                {shakeWarning && (
                  <span className="text-warning font-data">Hold steady</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={stopCamera}>
                  Cancel
                </Button>
                {!recording ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={startRecording}
                    disabled={!cameraStream}
                  >
                    <span className="w-2 h-2 rounded-full bg-destructive" />
                    Start Recording
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" className="gap-2" onClick={stopRecording}>
                    Stop Recording
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* File Preview */}
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            {/* Video Preview */}
            <div className="relative">
              {preview && (
                <video
                  src={preview}
                  className="w-full aspect-video object-cover bg-card"
                  controls={!isProcessing}
                />
              )}
              {!isProcessing && (
                <button
                  onClick={clearFile}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              )}
            </div>

            {/* File info */}
            <div className="p-6 border-t border-border">
              <div className="flex items-center gap-3 mb-4">
                <FileVideo className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground font-data">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              </div>

              {/* Optional fields */}
              {!isProcessing && (
                <div className="grid sm:grid-cols-2 gap-3 mb-6">
                  <div>
                    <label className="text-xs text-muted-foreground font-data block mb-1.5">
                      Pump Name (optional)
                    </label>
                    <input
                      type="text"
                      value={pumpName}
                      onChange={(e) => setPumpName(e.target.value)}
                      placeholder="HP Petrol Pump, MG Road"
                      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-data block mb-1.5">
                      City (optional)
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Mumbai"
                      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-data block mb-1.5">
                      Pump License (optional)
                    </label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="MH/PL/2024/00456"
                      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-data block mb-1.5">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="gu">Gujarati</option>
                      <option value="mr">Marathi</option>
                      <option value="ta">Tamil</option>
                      <option value="te">Telugu</option>
                      <option value="kn">Kannada</option>
                      <option value="bn">Bengali</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-data block mb-1.5">
                      Latitude (optional)
                    </label>
                    <input
                      type="text"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="19.076000"
                      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-data block mb-1.5">
                      Longitude (optional)
                    </label>
                    <input
                      type="text"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="72.877000"
                      className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" className="gap-2" onClick={captureLocation} type="button">
                      <Navigation className="w-3.5 h-3.5" />
                      {locating ? 'Locating...' : 'Use My Location'}
                    </Button>
                    {locationError && (
                      <span className="text-xs text-destructive">{locationError}</span>
                    )}
                    {!locationError && lat && lng && (
                      <span className="text-xs text-primary">Location captured.</span>
                    )}
                  </div>
                </div>
              )}

              {step !== 'error' && (error || fileTooLarge) && (
                <div className="mb-4 flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <span>{fileTooLarge ? 'File exceeds 200MB. Please upload a smaller video.' : error}</span>
                </div>
              )}
              {queueNotice && (
                <div className="mb-4 flex items-start gap-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
                  <CheckCircle className="w-4 h-4 mt-0.5" />
                  <span>{queueNotice}</span>
                </div>
              )}

              {/* Analysis Progress */}
              <AnimatePresence mode="wait">
                {showProgress && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6"
                  >
                    <div className="space-y-4">
                      {step === 'uploading' && (
                        <div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-muted-foreground font-data">Uploading video...</span>
                            <span className="text-primary font-data">{progress}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {step === 'extracting' && (
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          <span className="text-sm text-muted-foreground">Extracting frames...</span>
                          <span className="font-data text-xs text-primary ml-auto">Frame {frameCount} / 180</span>
                        </div>
                      )}

                      {step === 'reading' && (
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            <span className="text-sm text-muted-foreground">Reading meter values...</span>
                          </div>
                          <div className="terminal-block max-h-32 overflow-y-auto">
                            {ocrValues.map((v, i) => (
                              <motion.div
                                key={`${v}-${i}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs"
                              >
                                <span className="text-muted-foreground">[{String(i * 4).padStart(2, '0')}s]</span>
                                {' '}
                                <span className="text-primary">READING:</span> {v}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {step === 'analyzing' && (
                        <div className="relative">
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            <span className="text-sm text-muted-foreground">Running fraud analysis...</span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden relative">
                            <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                          </div>
                        </div>
                      )}

                      {step === 'done' && (
                        <div className="flex items-center gap-3 text-primary">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm font-medium">Analysis complete. Redirecting...</span>
                        </div>
                      )}

                      {step === 'error' && (
                        <div className="flex items-center gap-3 text-destructive">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="text-sm font-medium">{error || stepMessages.error}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Start Analysis button */}
              {showStartButton && (
                <Button
                  variant="hero"
                  size="xl"
                  className="w-full gap-2"
                  onClick={startAnalysis}
                  disabled={fileTooLarge}
                >
                  <Film className="w-4 h-4" />
                  Start Analysis
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
