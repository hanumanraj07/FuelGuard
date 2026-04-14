import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { v2 as cloudinary } from 'cloudinary'
import Razorpay from 'razorpay'
import { JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers'
import PDFDocument from 'pdfkit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000'
const JWT_SECRET = process.env.JWT_SECRET?.trim()
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL?.trim() || ''
const POLYGON_PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY?.trim() || ''
const POLYGON_CHAIN_ID = Number(process.env.POLYGON_CHAIN_ID || 137)
const BLOCKCHAIN_ANCHORING_ENABLED = process.env.BLOCKCHAIN_ANCHORING_ENABLED !== 'false'
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required to start the backend.')
}

let blockchainAnchoringDisabledReason = ''

const UPLOAD_DIR = path.join(__dirname, 'tmp')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const requiredEnv = ['MONGODB_URI', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
const missing = requiredEnv.filter((key) => !process.env[key])
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is required to start the backend.')
}
await mongoose.connect(process.env.MONGODB_URI)

const jobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  userId: { type: String, default: null },
  status: { type: String, default: 'pending' },
  stage: { type: String, default: 'uploading' },
  videoUrl: { type: String },
  videoHash: { type: String },
  pumpId: { type: String, default: null },
  pumpName: { type: String },
  city: { type: String },
  licenseNumber: { type: String },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  language: { type: String, default: 'en' },
  result: { type: mongoose.Schema.Types.Mixed },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
})

const Job = mongoose.model('Job', jobSchema)

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, default: '' },
  role: { type: String, default: 'consumer' },
  language: { type: String, default: 'en' },
  plan: { type: String, default: 'Free' },
  subscriptionCycle: { type: String, default: 'monthly' },
  subscriptionStatus: { type: String, default: 'inactive' },
  nextBillingDate: { type: Date, default: null },
  analysesThisMonth: { type: Number, default: 0 },
  fuelCoins: { type: Number, default: 0 },
  isVerifiedReporter: { type: Boolean, default: false },
  referralCode: { type: String, default: '' },
  referredBy: { type: String, default: '' },
  notificationEmail: { type: Boolean, default: true },
  resetToken: { type: String, default: '' },
  resetTokenExpires: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
})

const User = mongoose.model('User', userSchema)

const pumpSchema = new mongoose.Schema({
  pumpId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  city: { type: String, required: true },
  status: { type: String, required: true },
  score: { type: Number, required: true },
  reports: { type: Number, required: true },
  date: { type: String, required: true },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  company: { type: String, required: true },
  licenseNumber: { type: String, default: '' },
  lastCalibrationDate: { type: String, default: '' },
  reviews: {
    type: [
      {
        user: { type: String, default: 'Anonymous' },
        rating: { type: Number, required: true },
        text: { type: String, required: true },
        date: { type: String, required: true },
      },
    ],
    default: [],
  },
  jobIds: { type: [String], default: [] },
})

const Pump = mongoose.model('Pump', pumpSchema)

const reportSchema = new mongoose.Schema({
  pumpId: { type: String, required: true },
  jobId: { type: String, default: '' },
  status: { type: String, required: true },
  city: { type: String, default: '' },
  reason: { type: String, default: '' },
  fraudType: { type: String, default: '' },
  inspector: { type: String, default: 'Unassigned' },
  createdAt: { type: Date, default: Date.now },
})

const Report = mongoose.model('Report', reportSchema)

const fleetSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, unique: true },
  companyName: { type: String, default: 'FuelGuard Fleet' },
  vehicles: {
    type: [
      {
        registration: { type: String, required: true },
        driverName: { type: String, default: 'Unassigned' },
        totalFills: { type: Number, default: 0 },
        flaggedFills: { type: Number, default: 0 },
        lastFillAt: { type: Date, default: null },
        status: { type: String, default: 'normal' },
        fills: {
          type: [
            {
              date: { type: Date, required: true },
              liters: { type: Number, required: true },
              amount: { type: Number, required: true },
              status: { type: String, default: 'normal' },
              notes: { type: String, default: '' },
              pumpName: { type: String, default: '' },
              pumpCity: { type: String, default: '' },
              pumpLat: { type: Number, default: null },
              pumpLng: { type: Number, default: null },
              invoiceUrl: { type: String, default: '' },
              invoiceName: { type: String, default: '' },
            },
          ],
          default: [],
        },
      },
    ],
    default: [],
  },
  monthlyReport: {
    totalSpend: { type: Number, default: 0 },
    estimatedFraudLoss: { type: Number, default: 0 },
  },
})

const Fleet = mongoose.model('Fleet', fleetSchema)

await seedPumps()
await backfillReportsFromJobs()

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const safeName = (file.originalname || 'upload')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 120)
      const unique = crypto.randomUUID()
      cb(null, `${unique}-${safeName}`)
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
})

const invoiceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const safeName = (file.originalname || 'invoice')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 120)
      const unique = crypto.randomUUID()
      cb(null, `${unique}-${safeName}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const app = express()
app.use(cors({ origin:"https://fuel-guard-dev.vercel.app", credentials: true }))
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'video file is required' })
      return
    }

    const pumpName = (req.body.pumpName || '').toString().trim()
    const city = (req.body.city || '').toString().trim()
    const licenseNumber = (req.body.licenseNumber || '').toString().trim()
    const language = (req.body.language || 'en').toString().trim()
    const lat = parseOptionalNumber(req.body.lat)
    const lng = parseOptionalNumber(req.body.lng)
    const userId = getOptionalUserIdFromRequest(req)

    let uploadResult
    try {
      uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'fuelguard/uploads',
        context: {
          pumpName,
          city,
          licenseNumber,
        },
      })
    } catch (cloudErr) {
      console.error('Cloudinary upload failed:', cloudErr)
      res.status(502).json({
        error: 'Cloudinary upload failed',
        detail: cloudErr?.message || 'Unknown Cloudinary error',
      })
      return
    }

    const jobId = crypto.randomUUID()
    const identity = buildPumpIdentity({ jobId, pumpName, city })
    await Job.create({
      jobId,
      userId,
      pumpId: identity.pumpId,
      status: 'processing',
      stage: 'uploaded',
      videoUrl: uploadResult.secure_url,
      pumpName,
      city,
      licenseNumber,
      lat,
      lng,
      language,
    })

    res.status(202).json({ jobId })

    void processJob({
      jobId,
      videoUrl: uploadResult.secure_url,
      language,
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      error: 'Upload failed',
      detail: error?.message || 'Unknown server error',
    })
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {})
    }
  }
})

app.get('/api/results/:jobId', async (req, res) => {
  const jobId = req.params.jobId
  
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    if (jobId === 'demo') {
      res.json(buildDemoJobPayload())
      return
    }

    const job = await Job.findOne({ jobId }).lean()
    
    console.log(`[API /api/results] Query result: jobId=${jobId}, found=${!!job}, status=${job?.status}, hasResult=${!!job?.result}`)
    
    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    res.json({
      jobId: job.jobId,
      status: job.status,
      stage: job.stage,
      videoUrl: job.videoUrl || '',
      result: job.result || null,
      error: job.error || null,
      pump: {
        id: job.pumpId || job.jobId,
        name: job.pumpName || 'Unknown Pump',
        city: job.city || 'Unknown',
        licenseNumber: job.licenseNumber || ''
      }
    })
  } catch (err) {
    console.error(`[API /api/results] Error:`, err.message)
    res.status(500).json({ error: 'Database error' })
  }
})

app.get('/api/results/:jobId/pdf', async (req, res) => {
  if (req.params.jobId === 'demo') {
    streamEvidencePdf(res, buildDemoPdfJob())
    return
  }

  const job = await Job.findOne({ jobId: req.params.jobId })
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  if (job.status !== 'done' || !job.result) {
    res.status(400).json({ error: 'Report not ready yet' })
    return
  }

  streamEvidencePdf(res, job)
})

app.post('/api/subscribe', async (req, res) => {
  const planKey = normalizeSubscriptionPlanKey(
    req.body.planKey || req.body.planId || req.body.plan || req.body.planName
  )
  const billingCycle = normalizeBillingCycle(req.body.billingCycle)
  const plan = getSubscriptionPlan(planKey)

  if (!plan) {
    res.status(400).json({ error: 'Unsupported plan selection' })
    return
  }

  if (plan.key === 'enterprise') {
    res.json({
      mode: 'contact_sales',
      plan: serializeSubscriptionPlan(plan, billingCycle),
      message: 'Enterprise plans are handled by our sales team.',
      contact: 'enterprise@fuelguard.in',
    })
    return
  }

  if (plan.key === 'free') {
    res.json({
      mode: 'free',
      checkoutId: `free_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`,
      plan: serializeSubscriptionPlan(plan, billingCycle),
      methods: [],
      message: 'Free plan selected. No payment needed.',
    })
    return
  }

  const userId = getOptionalUserIdFromRequest(req)
  const user = userId ? await User.findById(userId).lean() : null
  const mode = resolveSubscriptionMode(plan, billingCycle)

  if (mode === 'live') {
    const customerNotify = req.body.customerNotify === false ? 0 : 1
    const totalCount = Number(req.body.totalCount || 12)
    const livePlanId = getRazorpayPlanId(plan, billingCycle)

    if (!livePlanId) {
      res.status(400).json({ error: 'Live Razorpay plan is not configured for this selection.' })
      return
    }

    try {
      const subscription = await razorpay.subscriptions.create({
        plan_id: livePlanId,
        customer_notify: customerNotify,
        total_count: Number.isFinite(totalCount) ? totalCount : 12,
      })
      res.json({
        mode: 'live',
        checkoutId: subscription.id,
        subscription,
        plan: serializeSubscriptionPlan(plan, billingCycle),
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        message: 'Live Razorpay subscription created on the backend.',
      })
      return
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Failed to create subscription' })
      return
    }
  }

  const checkoutId = `mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  res.json({
    mode: 'mock',
    checkoutId,
    plan: serializeSubscriptionPlan(plan, billingCycle),
    methods: ['upi', 'card', 'netbanking'],
    merchant: 'FuelGuard Demo',
    note: 'Demo checkout only. No real money will be charged.',
    prefill: {
      name: user?.name || '',
      email: user?.email || '',
      contact: user?.phone || '',
    },
  })
})

app.post('/api/subscribe/confirm', async (req, res) => {
  const checkoutId = (req.body.checkoutId || '').toString().trim()
  const planKey = normalizeSubscriptionPlanKey(
    req.body.planKey || req.body.planId || req.body.plan || req.body.planName
  )
  const billingCycle = normalizeBillingCycle(req.body.billingCycle)
  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod)
  const plan = getSubscriptionPlan(planKey)

  if (!plan) {
    res.status(400).json({ error: 'Unsupported plan selection' })
    return
  }

  if (!checkoutId && plan.key !== 'free') {
    res.status(400).json({ error: 'checkoutId is required' })
    return
  }

  const userId = getOptionalUserIdFromRequest(req)
  let serializedUser = null
  let nextBillingDate = null

  if (userId) {
    const user = await User.findById(userId)
    if (user) {
      nextBillingDate = plan.key === 'free' ? null : calculateNextBillingDate(billingCycle)
      user.plan = plan.displayName
      user.subscriptionCycle = billingCycle
      user.subscriptionStatus = plan.key === 'free' ? 'active' : 'active'
      user.nextBillingDate = nextBillingDate
      if (plan.key !== 'free') {
        user.fuelCoins = (user.fuelCoins || 0) + 25
      }
      await user.save()
      serializedUser = serializeUser(user)
    }
  }

  res.json({
    ok: true,
    mode: plan.key === 'free' ? 'free' : 'mock',
    paymentId: plan.key === 'free' ? '' : `pay_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`,
    subscriptionId: `sub_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`,
    checkoutId: checkoutId || `free_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`,
    status: 'active',
    paymentMethod,
    plan: serializeSubscriptionPlan(plan, billingCycle),
    nextBillingDate: nextBillingDate ? formatReportDate(nextBillingDate) : null,
    user: serializedUser,
    message: serializedUser
      ? `${plan.displayName} activated successfully.`
      : plan.key === 'free'
        ? 'Free plan selected.'
        : 'Demo payment completed. Log in to persist the subscription on your account.',
  })
})

app.post('/api/auth/register', async (req, res) => {
  const name = (req.body.name || '').toString().trim()
  const email = (req.body.email || '').toString().trim().toLowerCase()
  const password = (req.body.password || '').toString()
  const phone = (req.body.phone || '').toString().trim()
  const language = (req.body.language || 'en').toString().trim()

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required.' })
    return
  }
  if (!email.includes('@')) {
    res.status(400).json({ error: 'Please enter a valid email address.' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' })
    return
  }

  const existing = await User.findOne({ email })
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({
    name,
    email,
    passwordHash,
    phone,
    language,
    role: 'consumer',
    referralCode: generateReferralCode(name),
    notificationEmail: true,
  })

  const token = createToken(user)
  res.json({ token, user: serializeUser(user) })
})

app.post('/api/auth/login', async (req, res) => {
  const email = (req.body.email || '').toString().trim().toLowerCase()
  const password = (req.body.password || '').toString()

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' })
    return
  }

  const user = await User.findOne({ email })
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' })
    return
  }

  const matches = await bcrypt.compare(password, user.passwordHash)
  if (!matches) {
    res.status(401).json({ error: 'Invalid email or password.' })
    return
  }

  const token = createToken(user)
  res.json({ token, user: serializeUser(user) })
})

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user) {
    res.status(404).json({ error: 'User not found.' })
    return
  }
  res.json({ user: serializeUser(user) })
})

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user) {
    res.status(404).json({ error: 'User not found.' })
    return
  }

  const name = (req.body.name || '').toString().trim()
  const phone = (req.body.phone || '').toString().trim()
  const language = (req.body.language || '').toString().trim()
  const notificationEmail = typeof req.body.notificationEmail === 'boolean'
    ? req.body.notificationEmail
    : user.notificationEmail

  if (name) user.name = name
  if (phone || phone === '') user.phone = phone
  if (language) user.language = language
  user.notificationEmail = notificationEmail

  await user.save()

  res.json({ user: serializeUser(user) })
})

app.post('/api/auth/forgot', async (req, res) => {
  const email = (req.body.email || '').toString().trim().toLowerCase()
  if (!email) {
    res.status(400).json({ error: 'Email is required.' })
    return
  }

  const user = await User.findOne({ email })
  if (!user) {
    res.json({ ok: true })
    return
  }

  const token = crypto.randomBytes(20).toString('hex')
  const expires = new Date(Date.now() + 1000 * 60 * 30)
  user.resetToken = token
  user.resetTokenExpires = expires
  await user.save()

  const allowResetTokenResponse = process.env.ALLOW_RESET_TOKEN_RESPONSE === 'true'
  res.json(allowResetTokenResponse ? { ok: true, resetToken: token } : { ok: true })
})

app.post('/api/auth/reset', async (req, res) => {
  const token = (req.body.token || '').toString().trim()
  const password = (req.body.password || '').toString()

  if (!token || !password) {
    res.status(400).json({ error: 'Token and new password are required.' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' })
    return
  }

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: new Date() },
  })

  if (!user) {
    res.status(400).json({ error: 'Reset token is invalid or expired.' })
    return
  }

  user.passwordHash = await bcrypt.hash(password, 10)
  user.resetToken = ''
  user.resetTokenExpires = null
  await user.save()

  res.json({ ok: true })
})

app.get('/api/user/history', requireAuth, async (req, res) => {
  const limit = Number(req.query.limit || 50)
  const jobs = await Job.find({ status: 'done', userId: req.userId })
    .sort({ createdAt: -1 })
    .limit(Number.isFinite(limit) ? limit : 50)
    .lean()

  const items = jobs.map((job) => {
    const pumpName = (job.pumpName || '').trim()
    const city = (job.city || '').trim()
    const pumpLabel = pumpName
      ? city ? `${pumpName}, ${city}` : pumpName
      : city || 'Unknown Pump'

    return {
      id: job.jobId,
      date: formatReportDate(job.processedAt || job.createdAt),
      pump: pumpLabel,
      status: job.result?.status || 'normal',
      hasPdf: job.status === 'done',
    }
  })

  res.json({ items, total: items.length })
})

app.get('/api/reports', async (req, res) => {
  const status = (req.query.status || '').toString().trim()
  const city = (req.query.city || '').toString().trim()
  const company = (req.query.company || '').toString().trim()
  const query = (req.query.q || '').toString().trim()

  const filter = {}
  if (status && status !== 'all') {
    filter.status = status
  }
  if (city) {
    filter.city = city
  }
  if (company) {
    filter.company = company
  }
  if (query) {
    const regex = new RegExp(escapeRegExp(query), 'i')
    filter.$or = [{ name: regex }, { city: regex }]
  }

  const pumps = await Pump.find(filter).sort({ date: -1 }).lean()
  res.json({
    items: pumps.map((pump) => ({
      id: pump.pumpId,
      name: pump.name,
      city: pump.city,
      status: pump.status,
      score: pump.score,
      reports: pump.reports,
      date: pump.date,
      lat: pump.lat,
      lng: pump.lng,
      company: pump.company,
    })),
    total: pumps.length,
  })
})

app.get('/api/reports/heatmap', async (req, res) => {
  const pumps = await Pump.find().lean()
  const points = buildHeatmapPoints(pumps)
  res.json({
    items: points,
    total: points.length,
  })
})

app.post('/api/report', async (req, res) => {
  const statusInput = (req.body.status || 'suspicious').toString().trim()
  const status = normalizeReportStatus(statusInput)
  const reason = (req.body.reason || '').toString().trim()
  const pumpIdInput = (req.body.pumpId || '').toString().trim()
  const pumpName = (req.body.pumpName || '').toString().trim()
  const city = (req.body.city || '').toString().trim()
  const jobId = (req.body.jobId || '').toString().trim()

  let pumpId = pumpIdInput
  if (!pumpId) {
    if (jobId) {
      const job = await Job.findOne({ jobId }).lean()
      if (job) {
        const identity = buildPumpIdentity(job)
        pumpId = identity.pumpId
      }
    }
  }

  if (!pumpId) {
    const identity = buildPumpIdentity({ jobId: jobId || crypto.randomUUID(), pumpName, city })
    pumpId = identity.pumpId
  }

  let pump = await Pump.findOne({ pumpId })
  if (!pump) {
    const identity = buildPumpIdentity({ jobId: jobId || crypto.randomUUID(), pumpName, city, pumpId })
    pump = await Pump.create({
      pumpId: identity.pumpId,
      name: identity.name,
      city: identity.city,
      status,
      score: statusScore(status),
      reports: 0,
      date: formatReportDate(new Date()),
      lat: null,
      lng: null,
      company: guessCompanyFromName(identity.name),
      licenseNumber: '',
      lastCalibrationDate: generateCalibrationDate(identity.pumpId),
      reviews: [],
      jobIds: [],
    })
  }

  await Report.create({
    pumpId: pump.pumpId,
    jobId,
    status,
    city: pump.city || city,
    reason,
    fraudType: inferFraudType(status, reason),
  })

  const nextStatus = chooseWorseStatus(pump.status, status)
  pump.status = nextStatus
  pump.score = statusScore(nextStatus)
  pump.reports = (pump.reports || 0) + 1
  pump.date = formatReportDate(new Date())
  await pump.save()

  res.json({
    ok: true,
    pump: serializePump(pump),
  })
})

app.get('/api/gov/dashboard', async (req, res) => {
  const reports = await Report.find().sort({ createdAt: -1 }).lean()
  const pumps = await Pump.find().lean()

  const totalReports = reports.length
  const pumpsFlagged = pumps.filter((pump) => pump.status !== 'normal').length
  const activeInspections = reports.filter((report) => (report.inspector || '') !== 'Unassigned').length
  const avgResolutionDays = calculateAvgResolution(reports)

  const fraudByCity = buildFraudByCity(reports)
  const fraudByCompany = buildFraudByCompany(pumps)
  const monthlyTrend = buildMonthlyTrend(reports)
  const recentReports = buildRecentReports(reports, pumps)
  const alerts = buildAlerts(reports, pumps)

  res.json({
    stats: {
      totalReports,
      activeInspections,
      pumpsFlagged,
      avgResolutionDays,
    },
    fraudByCity,
    fraudByCompany,
    monthlyTrend,
    recentReports,
    alerts,
  })
})

app.post('/api/pump/lookup', async (req, res) => {
  const licenseNumber = (req.body.licenseNumber || '').toString().trim()
  if (!licenseNumber) {
    res.status(400).json({ error: 'licenseNumber is required' })
    return
  }

  let pump = await Pump.findOne({ licenseNumber }).lean()
  if (!pump) {
    pump = await Pump.findOne({
      licenseNumber: { $regex: new RegExp(escapeRegExp(licenseNumber), 'i') },
    }).lean()
  }

  const calibrationDate = pump?.lastCalibrationDate || generateCalibrationDate(licenseNumber)
  const nextDueDate = generateCalibrationDueDate(calibrationDate)

  res.json({
    found: Boolean(pump),
    pump: pump ? serializePump(pump) : null,
    licenseNumber,
    lastCalibrationDate: calibrationDate,
    nextCalibrationDue: nextDueDate,
    authority: 'Legal Metrology Department',
    status: calibrationDate ? 'records_found' : 'records_unavailable',
  })
})

app.get('/api/pump/:pumpId', async (req, res) => {
  const pumpId = (req.params.pumpId || '').trim()
  if (!pumpId) {
    res.status(400).json({ error: 'pumpId is required' })
    return
  }

  let pump = await Pump.findOne({ pumpId }).lean()

  if (!pump) {
    const jobId = pumpId.startsWith('job_') ? pumpId.slice(4) : pumpId
    const job = await Job.findOne({ jobId }).lean()
    if (job) {
      const identity = buildPumpIdentity(job)
      if (!job.pumpId) {
        await Job.updateOne({ _id: job._id }, { pumpId: identity.pumpId })
      }
      pump = await Pump.findOne({ pumpId: identity.pumpId }).lean()
      if (!pump) {
        const status = job.result?.status || 'normal'
        const score = statusScore(status)
        const coords = isValidCoord(job.lat, job.lng)
          ? { lat: job.lat, lng: job.lng }
          : guessCityCoords(identity.city)

        const created = await Pump.create({
          pumpId: identity.pumpId,
          name: identity.name,
          city: identity.city,
          status,
          score,
          reports: 1,
          date: formatReportDate(job.processedAt || job.createdAt),
          lat: coords ? coords.lat : null,
          lng: coords ? coords.lng : null,
          company: guessCompanyFromName(identity.name),
          licenseNumber: job.licenseNumber || '',
          lastCalibrationDate: generateCalibrationDate(job.licenseNumber || identity.pumpId),
          jobIds: [job.jobId],
        })
        pump = created.toObject()
      }
    }
  }

  if (!pump) {
    res.status(404).json({ error: 'Pump not found' })
    return
  }

  let jobs = []
  if (Array.isArray(pump.jobIds) && pump.jobIds.length) {
    jobs = await Job.find({ jobId: { $in: pump.jobIds }, status: 'done' })
      .sort({ processedAt: -1, createdAt: -1 })
      .limit(10)
      .lean()
  } else {
    jobs = await Job.find({ pumpId: pump.pumpId, status: 'done' })
      .sort({ processedAt: -1, createdAt: -1 })
      .limit(10)
      .lean()
  }

  if (!jobs.length && pump.name && pump.city) {
    jobs = await Job.find({
      pumpName: pump.name,
      city: pump.city,
      status: 'done',
    })
      .sort({ processedAt: -1, createdAt: -1 })
      .limit(10)
      .lean()
  }

  const analyses = jobs.map((job) => ({
    id: job.jobId,
    date: formatReportDate(job.processedAt || job.createdAt),
    status: job.result?.status || 'normal',
    verdict: buildVerdict(job.result),
  }))

  res.json({
    pump: serializePump(pump),
    analyses,
    reviews: Array.isArray(pump.reviews) ? pump.reviews : [],
  })
})

app.post('/api/pump/:pumpId/review', async (req, res) => {
  const pumpId = (req.params.pumpId || '').trim()
  if (!pumpId) {
    res.status(400).json({ error: 'pumpId is required' })
    return
  }

  const rating = Number(req.body.rating)
  const text = (req.body.text || '').toString().trim()
  const user = (req.body.user || 'Anonymous').toString().trim() || 'Anonymous'

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'rating must be between 1 and 5' })
    return
  }

  if (!text) {
    res.status(400).json({ error: 'review text is required' })
    return
  }

  const pump = await Pump.findOne({ pumpId })
  if (!pump) {
    res.status(404).json({ error: 'Pump not found' })
    return
  }

  const review = {
    user,
    rating,
    text,
    date: formatReportDate(new Date()),
  }

  pump.reviews = Array.isArray(pump.reviews) ? pump.reviews : []
  pump.reviews.unshift(review)
  if (pump.reviews.length > 50) {
    pump.reviews = pump.reviews.slice(0, 50)
  }

  await pump.save()

  res.json({ reviews: pump.reviews })
})

app.get('/api/fleet/dashboard', requireAuth, async (req, res) => {
  const fleet = await getOrCreateFleet(req.userId)
  const vehicles = Array.isArray(fleet.vehicles) ? fleet.vehicles : []
  const normalizedVehicles = vehicles.map((vehicle) => {
    const fills = Array.isArray(vehicle.fills) ? vehicle.fills : []
    const updated = updateVehicleAggregates(vehicle, fills)
    return updated
  })

  const totalVehicles = normalizedVehicles.length
  const fillsThisMonth = normalizedVehicles.reduce((sum, vehicle) => sum + (vehicle.totalFills || 0), 0)
  const flaggedIncidents = normalizedVehicles.reduce((sum, vehicle) => sum + (vehicle.flaggedFills || 0), 0)
  const estimatedFraudLoss = estimateFraudLoss(normalizedVehicles)

  res.json({
    stats: {
      totalVehicles,
      fillsThisMonth,
      flaggedIncidents,
      estimatedFraudLoss,
    },
    vehicles: normalizedVehicles.map((vehicle) => ({
      reg: vehicle.registration,
      driver: vehicle.driverName,
      lastFill: vehicle.lastFillAt ? formatReportDate(vehicle.lastFillAt) : 'Not yet',
      status: vehicle.status || 'normal',
      flagged: vehicle.flaggedFills || 0,
    })),
  })
})

app.get('/api/fleet/report', requireAuth, async (req, res) => {
  const fleet = await getOrCreateFleet(req.userId)
  const vehicles = Array.isArray(fleet.vehicles) ? fleet.vehicles : []
  const normalizedVehicles = vehicles.map((vehicle) => updateVehicleAggregates(vehicle, vehicle.fills || []))
  const estimatedFraudLoss = estimateFraudLoss(normalizedVehicles)
  const totalSpend = normalizedVehicles.reduce((sum, vehicle) => {
    const fills = Array.isArray(vehicle.fills) ? vehicle.fills : []
    return sum + fills.reduce((vehicleSum, fill) => vehicleSum + (Number(fill.amount) || 0), 0)
  }, 0)

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="fuelguard-fleet-report.pdf"')

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.pipe(res)

  doc.fontSize(20).fillColor('#0A0C0F').text('FuelGuard Fleet Monthly Report')
  doc.moveDown(0.5)
  doc.fontSize(10).fillColor('#5A6478').text(`Generated: ${formatReportDate(new Date())}`)
  doc.text(`Company: ${fleet.companyName || 'FuelGuard Fleet'}`)
  doc.moveDown(1)

  doc.fontSize(14).fillColor('#0A0C0F').text('Summary')
  doc.moveDown(0.3)
  doc.fontSize(11).fillColor('#1F2937')
  doc.text(`Total Vehicles: ${normalizedVehicles.length}`)
  doc.text(`Total Spend: INR ${formatINR(totalSpend)}`)
  doc.text(`Estimated Fraud Loss: INR ${formatINR(estimatedFraudLoss)}`)
  doc.moveDown(1)

  doc.fontSize(14).fillColor('#0A0C0F').text('Vehicles')
  doc.moveDown(0.3)
  normalizedVehicles.slice(0, 20).forEach((vehicle, index) => {
    doc.fontSize(10).fillColor('#1F2937').text(
      `${index + 1}. ${vehicle.registration} | Driver: ${vehicle.driverName} | Fills: ${vehicle.totalFills || 0} | Flagged: ${vehicle.flaggedFills || 0} | Status: ${formatStatus(vehicle.status || 'normal')}`
    )
  })

  doc.end()
})

app.post('/api/fleet/invoice', requireAuth, invoiceUpload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'invoice file is required' })
      return
    }

    let uploadResult
    try {
      const isImage = (req.file.mimetype || '').startsWith('image/')
      uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: isImage ? 'image' : 'raw',
        folder: 'fuelguard/invoices',
      })
    } catch (cloudErr) {
      console.error('Invoice upload failed:', cloudErr)
      res.status(502).json({
        error: 'Invoice upload failed',
        detail: cloudErr?.message || 'Unknown Cloudinary error',
      })
      return
    }

    res.json({
      url: uploadResult.secure_url,
      name: req.file.originalname || 'invoice',
      type: req.file.mimetype || 'application/octet-stream',
    })
  } catch (error) {
    console.error('Invoice upload error:', error)
    res.status(500).json({ error: 'Invoice upload failed' })
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {})
    }
  }
})

app.post('/api/fleet/vehicle', requireAuth, async (req, res) => {
  const registration = (req.body.registration || '').toString().trim()
  const driverName = (req.body.driver || '').toString().trim()

  if (!registration) {
    res.status(400).json({ error: 'registration is required' })
    return
  }

  const fleet = await getOrCreateFleet(req.userId)
  const normalized = normalizeRegistration(registration)
  if (!normalized) {
    res.status(400).json({ error: 'registration is required' })
    return
  }
  const existing = (fleet.vehicles || []).find(
    (vehicle) => normalizeRegistration(vehicle.registration) === normalized
  )

  if (existing) {
    res.status(409).json({ error: 'Vehicle already exists' })
    return
  }

  fleet.vehicles.push({
    registration: normalized,
    driverName: driverName || 'Unassigned',
    totalFills: 0,
    flaggedFills: 0,
    lastFillAt: null,
    status: 'normal',
    fills: [],
  })

  await fleet.save()

  const vehicles = fleet.vehicles || []
  const normalizedVehicles = vehicles.map((vehicle) => updateVehicleAggregates(vehicle, vehicle.fills || []))
  const totalVehicles = normalizedVehicles.length
  const fillsThisMonth = normalizedVehicles.reduce((sum, vehicle) => sum + (vehicle.totalFills || 0), 0)
  const flaggedIncidents = normalizedVehicles.reduce((sum, vehicle) => sum + (vehicle.flaggedFills || 0), 0)
  const estimatedFraudLoss = estimateFraudLoss(normalizedVehicles)

  res.json({
    stats: {
      totalVehicles,
      fillsThisMonth,
      flaggedIncidents,
      estimatedFraudLoss,
    },
    vehicles: normalizedVehicles.map((vehicle) => ({
      reg: vehicle.registration,
      driver: vehicle.driverName,
      lastFill: vehicle.lastFillAt ? formatReportDate(vehicle.lastFillAt) : 'Not yet',
      status: vehicle.status || 'normal',
      flagged: vehicle.flaggedFills || 0,
    })),
  })
})

app.get('/api/fleet/vehicle/:registration', requireAuth, async (req, res) => {
  const registration = (req.params.registration || '').toString().trim()
  if (!registration) {
    res.status(400).json({ error: 'registration is required' })
    return
  }

  const fleet = await getOrCreateFleet(req.userId)
  const normalized = normalizeRegistration(registration)
  const vehicle = (fleet.vehicles || []).find(
    (item) => normalizeRegistration(item.registration) === normalized
  )

  if (!vehicle) {
    res.status(404).json({ error: 'Vehicle not found' })
    return
  }
  res.json(buildVehicleResponse(vehicle))
})

app.post('/api/fleet/vehicle/:registration/fill', requireAuth, async (req, res) => {
  const registration = (req.params.registration || '').toString().trim()
  if (!registration) {
    res.status(400).json({ error: 'registration is required' })
    return
  }

  const liters = Number(req.body.liters)
  const amount = Number(req.body.amount)
  const status = (req.body.status || 'normal').toString().trim() || 'normal'
  const notes = (req.body.notes || '').toString().trim()
  const pumpName = (req.body.pumpName || '').toString().trim()
  const pumpCity = (req.body.pumpCity || '').toString().trim()
  const pumpLat = parseOptionalNumber(req.body.pumpLat)
  const pumpLng = parseOptionalNumber(req.body.pumpLng)
  const invoiceUrl = (req.body.invoiceUrl || '').toString().trim()
  const invoiceName = (req.body.invoiceName || '').toString().trim()
  const dateInput = (req.body.date || '').toString().trim()
  const fillDate = dateInput ? new Date(dateInput) : new Date()

  if (!Number.isFinite(liters) || liters <= 0) {
    res.status(400).json({ error: 'liters must be a positive number' })
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' })
    return
  }
  if (Number.isNaN(fillDate.getTime())) {
    res.status(400).json({ error: 'date is invalid' })
    return
  }

  const fleet = await getOrCreateFleet(req.userId)
  const normalized = normalizeRegistration(registration)
  const vehicle = (fleet.vehicles || []).find(
    (item) => normalizeRegistration(item.registration) === normalized
  )

  if (!vehicle) {
    res.status(404).json({ error: 'Vehicle not found' })
    return
  }

  vehicle.fills = Array.isArray(vehicle.fills) ? vehicle.fills : []
  vehicle.fills.push({
    date: fillDate,
    liters,
    amount,
    status,
    notes,
    pumpName,
    pumpCity,
    pumpLat,
    pumpLng,
    invoiceUrl,
    invoiceName,
  })

  const updated = updateVehicleAggregates(vehicle, vehicle.fills)
  vehicle.totalFills = updated.totalFills
  vehicle.flaggedFills = updated.flaggedFills
  vehicle.lastFillAt = updated.lastFillAt
  vehicle.status = updated.status

  await fleet.save()
  res.json(buildVehicleResponse(vehicle))
})

app.patch('/api/fleet/vehicle/:registration', requireAuth, async (req, res) => {
  const registration = (req.params.registration || '').toString().trim()
  if (!registration) {
    res.status(400).json({ error: 'registration is required' })
    return
  }

  const fleet = await getOrCreateFleet(req.userId)
  const normalized = normalizeRegistration(registration)
  const vehicle = (fleet.vehicles || []).find(
    (item) => normalizeRegistration(item.registration) === normalized
  )

  if (!vehicle) {
    res.status(404).json({ error: 'Vehicle not found' })
    return
  }

  const newRegistrationRaw = (req.body.registration || '').toString().trim()
  const newDriver = (req.body.driver || '').toString().trim()

  if (newRegistrationRaw) {
    const newNormalized = normalizeRegistration(newRegistrationRaw)
    if (!newNormalized) {
      res.status(400).json({ error: 'registration is required' })
      return
    }

    const conflict = (fleet.vehicles || []).find(
      (item) => normalizeRegistration(item.registration) === newNormalized
    )

    if (conflict && conflict !== vehicle) {
      res.status(409).json({ error: 'Another vehicle already uses this registration.' })
      return
    }

    vehicle.registration = newNormalized
  }

  if (newDriver) {
    vehicle.driverName = newDriver
  }

  await fleet.save()

  res.json(buildVehicleResponse(vehicle))
})

app.get('/api/data/insights', requireAuth, async (req, res) => {
  const reports = await Report.find().sort({ createdAt: -1 }).lean()
  const pumps = await Pump.find().lean()

  res.json({
    generatedAt: new Date().toISOString(),
    totals: {
      reports: reports.length,
      pumps: pumps.length,
      flaggedPumps: pumps.filter((pump) => pump.status !== 'normal').length,
    },
    fraudByCity: buildFraudByCity(reports),
    fraudByCompany: buildFraudByCompany(pumps),
    monthlyTrend: buildMonthlyTrend(reports),
    heatmap: buildHeatmapPoints(pumps),
  })
})

app.post('/api/share-card', async (req, res) => {
  const jobId = (req.body.jobId || '').toString().trim()
  let status = (req.body.status || '').toString().trim()
  let confidence = Number(req.body.confidence)
  let pumpName = (req.body.pumpName || '').toString().trim()
  let city = (req.body.city || '').toString().trim()
  let summary = (req.body.summary || '').toString().trim()

  if (jobId) {
    if (jobId === 'demo') {
      const demo = buildDemoJobPayload()
      status = demo.result.status
      confidence = demo.result.confidence
      pumpName = demo.pump.name
      city = demo.pump.city
      summary = demo.result.summary
    } else {
      const job = await Job.findOne({ jobId }).lean()
      if (job?.result) {
        status = job.result.status || status
        confidence = job.result.confidence || confidence
        pumpName = job.pumpName || pumpName
        city = job.city || city
        summary = job.result.summary || summary
      }
    }
  }

  const payload = {
    jobId: jobId || 'manual',
    status: normalizeReportStatus(status || 'suspicious'),
    confidence: Number.isFinite(confidence) ? confidence : 0.87,
    pumpName: pumpName || 'Fuel Pump Analysis',
    city: city || 'India',
    summary: summary || 'FuelGuard detected anomalies in the uploaded fueling video.',
  }

  const svg = buildShareCardSvg(payload)
  const imageUrl = svgToDataUrl(svg)

  res.json({
    ok: true,
    imageUrl,
    svg,
    shareText: `${formatStatus(payload.status)} at ${payload.pumpName}${payload.city ? `, ${payload.city}` : ''}. ${truncateText(payload.summary, 140)}`,
  })
})

app.post('/api/complaint/file', async (req, res) => {
  const jobId = (req.body.jobId || '').toString().trim()
  const pumpId = (req.body.pumpId || '').toString().trim()
  const channel = (req.body.channel || 'consumer_forum').toString().trim()
  const description = (req.body.description || '').toString().trim()

  let job = null
  if (jobId && jobId !== 'demo') {
    job = await Job.findOne({ jobId }).lean()
  }

  let pump = null
  if (pumpId) {
    pump = await Pump.findOne({ pumpId }).lean()
  } else if (job?.pumpId) {
    pump = await Pump.findOne({ pumpId: job.pumpId }).lean()
  }

  const payload = buildComplaintPayload({
    channel,
    description,
    jobId,
    pump,
    job,
  })

  res.json(payload)
})

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(PORT, () => {
  console.log(`FuelGuard backend running on http://localhost:${PORT}`)
})

async function processJob({ jobId, videoUrl, language }) {
  console.log(`[processJob] Starting job: ${jobId}, videoUrl: ${videoUrl}`)
  try {
    await Job.updateOne({ jobId }, { status: 'processing', stage: 'analyzing' })
    console.log(`[processJob] Job ${jobId} status updated to analyzing`)

    console.log(`[processJob] Calling FastAPI at ${FASTAPI_URL}/analyze`)
    const response = await fetch(`${FASTAPI_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: videoUrl, language }),
    })
    console.log(`[processJob] FastAPI response status: ${response.status}`)
    
    let responseBody = null
    try {
      responseBody = await response.json()
    } catch (parseError) {
      responseBody = null
    }
    console.log(`[processJob] FastAPI response body keys:`, responseBody ? Object.keys(responseBody) : 'null')
    
    if (!response.ok) {
      const detail = extractServiceErrorDetail(responseBody, response)
      throw new Error(detail)
    }

    const result = responseBody
    console.log(`[processJob] Result status from AI:`, result?.status)
    const videoHash = result.video_sha256 || null

    try {
      const txHash = await anchorEvidence(videoHash)
      if (txHash) {
        result.blockchain_tx_hash = txHash
      }
    } catch (anchorError) {
      console.error('Blockchain anchor failed:', anchorError?.message || anchorError)
    }

    await upsertPumpFromJob(jobId, result)

    console.log(`[processJob] About to update job ${jobId} with result:`, result ? `status=${result.status}, confidence=${result.confidence}` : 'null')
    
    await Job.updateOne(
      { jobId },
      {
        status: 'done',
        stage: 'done',
        result,
        videoHash,
        processedAt: new Date(),
      }
    )
    console.log(`[processJob] Job ${jobId} completed successfully!`)
    
    const verifyJob = await Job.findOne({ jobId })
    console.log(`[processJob] Verified job in DB:`, JSON.stringify({ status: verifyJob?.status, stage: verifyJob?.stage, result: verifyJob?.result ? 'exists' : 'none' }))
  } catch (error) {
    console.error(`[processJob] Job ${jobId} failed:`, error)
    const message = formatProcessingError(error)
    await Job.updateOne(
      { jobId },
      { status: 'failed', stage: 'failed', error: message }
    )
  }
}

function getCorsOrigins() {
  const fallbackOrigins = ['http://localhost:5173']
  if (!process.env.CORS_ORIGIN) return fallbackOrigins
  const origins = process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  return origins.length ? origins : fallbackOrigins
}

async function anchorEvidence(videoHash) {
  if (!videoHash) return null
  if (!BLOCKCHAIN_ANCHORING_ENABLED) return null
  if (blockchainAnchoringDisabledReason) return null
  if (!POLYGON_RPC_URL || !POLYGON_PRIVATE_KEY) return null

  try {
    const provider = new JsonRpcProvider(POLYGON_RPC_URL, POLYGON_CHAIN_ID, { staticNetwork: true })
    const wallet = new Wallet(POLYGON_PRIVATE_KEY, provider)
    const data = normalizeHashToHex(videoHash)

    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0n,
      data,
    })
    const receipt = await tx.wait()
    return receipt?.hash || tx.hash
  } catch (error) {
    if (shouldDisableBlockchainAnchoring(error)) {
      blockchainAnchoringDisabledReason = formatBlockchainAnchorError(error)
      console.warn(`Blockchain anchoring disabled for this process: ${blockchainAnchoringDisabledReason}`)
      return null
    }
    throw error
  }
}

function shouldDisableBlockchainAnchoring(error) {
  const code = (error?.code || error?.cause?.code || '').toString()
  const responseStatus = (error?.info?.responseStatus || '').toString().toLowerCase()
  const message = (error?.message || '').toString().toLowerCase()

  return (
    code === 'SERVER_ERROR' ||
    code === 'NETWORK_ERROR' ||
    code === 'TIMEOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    responseStatus.includes('401') ||
    responseStatus.includes('403') ||
    message.includes('failed to detect network') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('tenant disabled') ||
    message.includes('fetch failed')
  )
}

function formatBlockchainAnchorError(error) {
  const responseStatus = (error?.info?.responseStatus || '').toString().trim()
  const responseBody = (error?.info?.responseBody || '').toString().trim()
  const message = (error?.message || 'Unknown blockchain error').toString().trim()

  if (responseStatus && responseBody) {
    return `${responseStatus}: ${responseBody}`
  }
  if (responseStatus) {
    return `${responseStatus}: ${message}`
  }
  return message
}

function normalizeHashToHex(value) {
  const raw = value.startsWith('0x') ? value.slice(2) : value
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return `0x${raw}`
  }
  return keccak256(toUtf8Bytes(value))
}

function formatProcessingError(error) {
  const message = error?.message || 'Processing failed'
  const code = error?.cause?.code || error?.code || ''
  if (
    message.toLowerCase().includes('fetch failed') ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND'
  ) {
    return `AI service unreachable at ${FASTAPI_URL}. Make sure FastAPI is running.`
  }
  return message
}

function extractServiceErrorDetail(responseBody, response) {
  const detail = normalizeServiceErrorDetail(responseBody?.detail)
  if (detail) return detail

  const error = normalizeServiceErrorDetail(responseBody?.error)
  if (error) return error

  return `FastAPI returned ${response.status}`
}

function normalizeServiceErrorDetail(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeServiceErrorDetail(item))
      .filter(Boolean)
      .join('; ')
  }

  if (typeof value === 'object') {
    if (typeof value.message === 'string' && value.message.trim()) return value.message.trim()
    if (typeof value.msg === 'string' && value.msg.trim()) return value.msg.trim()
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }

  return ''
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    joinedAt: formatReportDate(user.createdAt),
    language: user.language || 'en',
    plan: user.plan || 'Free',
    fuelCoins: user.fuelCoins || 0,
    analysesThisMonth: user.analysesThisMonth || 0,
    isVerifiedReporter: Boolean(user.isVerifiedReporter),
    referralCode: user.referralCode || '',
    notificationEmail: user.notificationEmail !== false,
    subscriptionCycle: user.subscriptionCycle || 'monthly',
    subscriptionStatus: user.subscriptionStatus || 'inactive',
    nextBillingDate: user.nextBillingDate ? formatReportDate(user.nextBillingDate) : null,
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Missing auth token.' })
    return
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

function getOptionalUserIdFromRequest(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return payload.sub || null
  } catch (error) {
    return null
  }
}

function normalizeBillingCycle(value) {
  return value === 'annual' ? 'annual' : 'monthly'
}

function normalizeSubscriptionPlanKey(value) {
  const raw = (value || '').toString().trim().toLowerCase()
  if (!raw) return ''

  const normalized = raw
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  if (normalized === 'free' || normalized === 'starter') return 'free'
  if (
    normalized === 'consumer-pro' ||
    normalized === 'consumerpro' ||
    normalized === 'pro' ||
    normalized === 'consumer'
  ) {
    return 'consumer-pro'
  }
  if (normalized === 'business' || normalized === 'fleet' || normalized === 'business-pro') {
    return 'business'
  }
  if (normalized === 'enterprise' || normalized === 'custom') return 'enterprise'
  return normalized
}

function normalizePaymentMethod(value) {
  const method = (value || '').toString().trim().toLowerCase()
  if (method === 'card') return 'card'
  if (method === 'netbanking') return 'netbanking'
  return 'upi'
}

function getSubscriptionPlan(planKey) {
  const plans = {
    free: {
      key: 'free',
      displayName: 'Free',
      monthlyPrice: 0,
      annualPrice: 0,
      features: ['3 analyses / month'],
    },
    'consumer-pro': {
      key: 'consumer-pro',
      displayName: 'Consumer Pro',
      monthlyPrice: 99,
      annualPrice: 990,
      features: ['Unlimited analyses', 'PDF evidence reports', 'Priority processing'],
    },
    business: {
      key: 'business',
      displayName: 'Business',
      monthlyPrice: 999,
      annualPrice: 9990,
      features: ['Fleet dashboard', 'Bulk upload', 'API access'],
    },
    enterprise: {
      key: 'enterprise',
      displayName: 'Enterprise',
      monthlyPrice: -1,
      annualPrice: -1,
      features: ['White-label portal', 'Gov integrations', 'Dedicated support'],
    },
  }
  return plans[planKey] || null
}

function serializeSubscriptionPlan(plan, billingCycle) {
  const amount = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice
  return {
    key: plan.key,
    displayName: plan.displayName,
    billingCycle,
    amount,
    amountDisplay: amount < 0 ? 'Custom' : `Rs. ${amount}`,
    currency: 'INR',
    features: Array.isArray(plan.features) ? plan.features : [],
  }
}

function resolveSubscriptionMode(plan, billingCycle) {
  const requested = (process.env.PAYMENTS_MODE || '').toLowerCase().trim()
  if (requested === 'mock' || requested === 'demo') return 'mock'
  if (requested === 'live' && razorpay && getRazorpayPlanId(plan, billingCycle)) return 'live'
  if (razorpay && getRazorpayPlanId(plan, billingCycle)) return 'live'
  return 'mock'
}

function getRazorpayPlanId(plan, billingCycle) {
  if (!plan) return ''
  if (plan.key === 'consumer-pro') {
    return billingCycle === 'annual'
      ? process.env.RAZORPAY_PLAN_CONSUMER_PRO_ANNUAL || ''
      : process.env.RAZORPAY_PLAN_CONSUMER_PRO_MONTHLY || ''
  }
  if (plan.key === 'business') {
    return billingCycle === 'annual'
      ? process.env.RAZORPAY_PLAN_BUSINESS_ANNUAL || ''
      : process.env.RAZORPAY_PLAN_BUSINESS_MONTHLY || ''
  }
  return ''
}

function calculateNextBillingDate(billingCycle) {
  const date = new Date()
  if (billingCycle === 'annual') {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    date.setMonth(date.getMonth() + 1)
  }
  return date
}

function normalizeReportStatus(value) {
  if (value === 'scam') return 'scam'
  if (value === 'normal') return 'normal'
  return 'suspicious'
}

function statusRank(status) {
  if (status === 'scam') return 2
  if (status === 'suspicious') return 1
  return 0
}

function chooseWorseStatus(a, b) {
  return statusRank(a) >= statusRank(b) ? a : b
}

function serializePump(pump) {
  return {
    id: pump.pumpId,
    name: pump.name,
    city: pump.city,
    status: pump.status,
    score: pump.score,
    reports: pump.reports,
    date: pump.date,
    lat: pump.lat,
    lng: pump.lng,
    company: pump.company,
    licenseNumber: pump.licenseNumber || '',
    lastCalibrationDate: pump.lastCalibrationDate || '',
  }
}

function inferFraudType(status, reason) {
  if (reason) return reason.slice(0, 48)
  if (status === 'scam') return 'Flow Rate Violation'
  if (status === 'suspicious') return 'Meter Not Zero'
  return 'Normal'
}

function formatStatus(status) {
  if (status === 'scam') return 'SCAM LIKELY'
  if (status === 'suspicious') return 'SUSPICIOUS'
  return 'NORMAL'
}

function formatConfidence(value) {
  if (typeof value !== 'number') return 'N/A'
  const pct = value > 1 ? value : value * 100
  return `${Math.round(pct)}%`
}

function formatFinding(finding) {
  if (!finding?.type) return 'Unspecified finding'
  if (finding.type === 'sudden_jump') {
    return `Sudden jump at ${finding.timestamp}: ${finding.from_value}L -> ${finding.to_value}L`
  }
  if (finding.type === 'flow_rate_violation') {
    return `Flow rate violation at ${finding.timestamp}: ${finding.detected_rate_lpm} L/min (max ${finding.max_physical_lpm} L/min)`
  }
  if (finding.type === 'meter_not_zero') {
    return `Meter not zero at start: ${finding.to_value}L`
  }
  return `${finding.type} at ${finding.timestamp || 'unknown time'}`
}

function formatReportDate(date) {
  if (!date) return 'Unknown'
  const value = new Date(date)
  return value.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

async function upsertPumpFromJob(jobId, result) {
  const job = await Job.findOne({ jobId }).lean()
  if (!job) return

  const identity = buildPumpIdentity(job)
  if (!job.pumpId) {
    await Job.updateOne({ jobId }, { pumpId: identity.pumpId })
  }
  const status = result?.status || 'normal'
  const score = statusScore(status)
  const nowLabel = formatReportDate(new Date())
  const coords = isValidCoord(job.lat, job.lng)
    ? { lat: job.lat, lng: job.lng }
    : guessCityCoords(identity.city)
  const licenseNumber = (job.licenseNumber || '').trim()

  const pump = await Pump.findOne({ pumpId: identity.pumpId })
  if (!pump) {
    await Pump.create({
      pumpId: identity.pumpId,
      name: identity.name,
      city: identity.city,
      status,
      score,
      reports: 1,
      date: nowLabel,
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null,
      company: guessCompanyFromName(identity.name),
      licenseNumber,
      lastCalibrationDate: generateCalibrationDate(licenseNumber || identity.pumpId),
      jobIds: [jobId],
    })
    return
  }

  const jobIds = pump.jobIds || []
  if (!jobIds.includes(jobId)) {
    jobIds.push(jobId)
  }
  pump.jobIds = jobIds
  pump.reports = jobIds.length
  pump.status = status
  pump.score = score
  pump.date = nowLabel
  pump.name = identity.name
  pump.city = identity.city
  pump.company = guessCompanyFromName(identity.name)
  if (licenseNumber) {
    pump.licenseNumber = licenseNumber
  }
  if (!pump.lastCalibrationDate) {
    pump.lastCalibrationDate = generateCalibrationDate(licenseNumber || identity.pumpId)
  }
  if (coords) {
    pump.lat = coords.lat
    pump.lng = coords.lng
  }
  await pump.save()
}

function derivePumpId(name, city) {
  const raw = `${name}|${city}`.toLowerCase()
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8)
  return `p_${hash}`
}

function statusScore(status) {
  if (status === 'scam') return 25
  if (status === 'suspicious') return 55
  return 85
}

function guessCompanyFromName(name) {
  const value = (name || '').toLowerCase()
  if (value.includes('indian oil') || value.includes('iocl')) return 'IOCL'
  if (value.includes('bpcl')) return 'BPCL'
  if (value.includes('essar')) return 'Essar'
  if (value.includes('hp')) return 'HPCL'
  return 'Independent'
}

function guessCityCoords(city) {
  const key = (city || '').toLowerCase()
  const map = {
    mumbai: { lat: 19.076, lng: 72.877 },
    delhi: { lat: 28.644, lng: 77.216 },
    bangalore: { lat: 12.935, lng: 77.624 },
    bengaluru: { lat: 12.935, lng: 77.624 },
    chennai: { lat: 13.085, lng: 80.21 },
    ahmedabad: { lat: 23.022, lng: 72.571 },
    kolkata: { lat: 22.572, lng: 88.363 },
    pune: { lat: 18.52, lng: 73.856 },
    hyderabad: { lat: 17.385, lng: 78.486 },
  }
  return map[key] || null
}

function isValidCoord(lat, lng) {
  if (lat === null || lng === null) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  return lat !== 0 && lng !== 0
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildPumpIdentity(job) {
  const existingPumpId = (job.pumpId || '').trim()
  const name = (job.pumpName || '').trim()
  const city = (job.city || '').trim()

  if (existingPumpId) {
    return {
      pumpId: existingPumpId,
      name: name || 'Unknown Pump',
      city: city || 'Unknown',
      aggregate: Boolean(name || city),
    }
  }

  if (name || city) {
    const resolvedName = name || 'Unknown Pump'
    const resolvedCity = city || 'Unknown'
    return {
      pumpId: derivePumpId(resolvedName, resolvedCity),
      name: resolvedName,
      city: resolvedCity,
      aggregate: true,
    }
  }

  return {
    pumpId: `job_${job.jobId}`,
    name: `Unknown Pump (${job.jobId.slice(0, 6)})`,
    city: 'Unknown',
    aggregate: false,
  }
}

async function seedPumps() {
  const count = await Pump.countDocuments()
  if (count > 0) return

  await Pump.insertMany([
    {
      pumpId: '1',
      name: 'HP Petrol Pump - MG Road',
      city: 'Mumbai',
      status: 'scam',
      score: 23,
      reports: 12,
      date: '22 Mar 2026',
      lat: 19.076,
      lng: 72.877,
      company: 'HPCL',
      licenseNumber: 'MH/LM/2025/1102',
      lastCalibrationDate: '12 Feb 2026',
    },
    {
      pumpId: '2',
      name: 'Indian Oil - Ring Road',
      city: 'Delhi',
      status: 'suspicious',
      score: 56,
      reports: 5,
      date: '21 Mar 2026',
      lat: 28.644,
      lng: 77.216,
      company: 'IOCL',
      licenseNumber: 'DL/LM/2025/0841',
      lastCalibrationDate: '04 Jan 2026',
    },
    {
      pumpId: '3',
      name: 'BPCL - Koramangala',
      city: 'Bangalore',
      status: 'normal',
      score: 91,
      reports: 0,
      date: '20 Mar 2026',
      lat: 12.935,
      lng: 77.624,
      company: 'BPCL',
      licenseNumber: 'KA/LM/2025/2218',
      lastCalibrationDate: '17 Mar 2026',
    },
    {
      pumpId: '4',
      name: 'HP Pump - Anna Nagar',
      city: 'Chennai',
      status: 'normal',
      score: 87,
      reports: 1,
      date: '22 Mar 2026',
      lat: 13.085,
      lng: 80.21,
      company: 'HPCL',
      licenseNumber: 'TN/LM/2025/1944',
      lastCalibrationDate: '28 Feb 2026',
    },
    {
      pumpId: '5',
      name: 'Essar - SG Highway',
      city: 'Ahmedabad',
      status: 'suspicious',
      score: 48,
      reports: 8,
      date: '19 Mar 2026',
      lat: 23.022,
      lng: 72.571,
      company: 'Essar',
      licenseNumber: 'GJ/LM/2025/7021',
      lastCalibrationDate: '09 Dec 2025',
    },
    {
      pumpId: '6',
      name: 'Indian Oil - Park Street',
      city: 'Kolkata',
      status: 'normal',
      score: 82,
      reports: 2,
      date: '22 Mar 2026',
      lat: 22.572,
      lng: 88.363,
      company: 'IOCL',
      licenseNumber: 'WB/LM/2025/5530',
      lastCalibrationDate: '19 Jan 2026',
    },
    {
      pumpId: '7',
      name: 'BPCL - FC Road',
      city: 'Pune',
      status: 'scam',
      score: 19,
      reports: 15,
      date: '21 Mar 2026',
      lat: 18.52,
      lng: 73.856,
      company: 'BPCL',
      licenseNumber: 'MH/LM/2025/3319',
      lastCalibrationDate: '07 Nov 2025',
    },
    {
      pumpId: '8',
      name: 'HP - Jubilee Hills',
      city: 'Hyderabad',
      status: 'normal',
      score: 78,
      reports: 1,
      date: '20 Mar 2026',
      lat: 17.385,
      lng: 78.486,
      company: 'HPCL',
      licenseNumber: 'TS/LM/2025/6422',
      lastCalibrationDate: '11 Mar 2026',
    },
  ])
}

async function backfillReportsFromJobs() {
  const jobs = await Job.find({ status: 'done' }).lean()
  if (!jobs.length) return

  const grouped = new Map()

  for (const job of jobs) {
    const identity = buildPumpIdentity(job)
    if (!job.pumpId) {
      await Job.updateOne({ _id: job._id }, { pumpId: identity.pumpId })
    }
    const key = identity.pumpId
    const existing = grouped.get(key) || {
      pumpId: identity.pumpId,
      name: identity.name,
      city: identity.city,
      company: guessCompanyFromName(identity.name),
      jobIds: [],
      latestStatus: job.result?.status || 'normal',
      latestDate: job.processedAt || job.createdAt || new Date(),
      licenseNumber: job.licenseNumber || '',
      lat: null,
      lng: null,
    }

    existing.jobIds.push(job.jobId)

    if (!existing.licenseNumber && job.licenseNumber) {
      existing.licenseNumber = job.licenseNumber
    }

    const jobDate = job.processedAt || job.createdAt || new Date()
    if (jobDate > existing.latestDate) {
      existing.latestDate = jobDate
      existing.latestStatus = job.result?.status || existing.latestStatus
    }

    if (isValidCoord(job.lat, job.lng)) {
      existing.lat = job.lat
      existing.lng = job.lng
    } else if (existing.lat === null && existing.lng === null) {
      const coords = guessCityCoords(identity.city)
      if (coords) {
        existing.lat = coords.lat
        existing.lng = coords.lng
      }
    }

    grouped.set(key, existing)
  }

  for (const value of grouped.values()) {
    const reports = value.jobIds.length
    const status = value.latestStatus
    const score = statusScore(status)
    const date = formatReportDate(value.latestDate)

    await Pump.findOneAndUpdate(
      { pumpId: value.pumpId },
      {
        $set: {
          pumpId: value.pumpId,
          name: value.name,
          city: value.city,
          status,
          score,
          reports,
          date,
          lat: value.lat,
          lng: value.lng,
          company: value.company,
          jobIds: value.jobIds,
          licenseNumber: value.licenseNumber,
          lastCalibrationDate: generateCalibrationDate(value.licenseNumber || value.pumpId),
        },
      },
      { upsert: true }
    )
  }
}

function buildVerdict(result) {
  if (!result) return 'Analysis completed.'
  const summary = typeof result.summary === 'string' ? result.summary.trim() : ''
  if (summary) {
    return truncateText(summary, 160)
  }
  if (Array.isArray(result.findings) && result.findings.length) {
    return formatFinding(result.findings[0])
  }
  if (result.status === 'normal') return 'No anomalies detected.'
  return 'Anomalies detected.'
}

function buildDemoAnalysis() {
  return {
    status: 'scam',
    confidence: 0.93,
    meter_type: 'digital_7seg',
    physical_inspection_score: 34,
    findings: [
      {
        type: 'sudden_jump',
        frame: 142,
        timestamp: '00:31',
        from_value: 5.2,
        to_value: 36.8,
        delta: 31.6,
        delta_seconds: 3,
      },
      {
        type: 'flow_rate_violation',
        frame: 142,
        timestamp: '00:31',
        detected_rate_lpm: 632,
        max_physical_lpm: 50,
        delta_seconds: 3,
      },
    ],
    audio_anomaly_flags: [
      {
        type: 'silence_gap',
        timestamp: '00:28',
        duration_ms: 1200,
        source: 'timing_proxy',
      },
    ],
    low_confidence_frames: [
      {
        timestamp: '00:18',
        value: 4.6,
        confidence: 0.61,
        frame: 86,
        seconds: 18,
      },
    ],
    frame_hashes: [
      { frame: 0, timestamp: '00:00', sha256: '9e42731c6e314f11f8ed9cf2ba61d8df985f5d4ccffad1f5287c77e9282ad31c' },
      { frame: 142, timestamp: '00:31', sha256: '45aa8f7468a65a72c013f5a61e01d0f6af0cd9eb095e1aa8d1ff03b2bc3357ce' },
    ],
    terminal_findings: [
      { time: '00:04', text: 'METER START: 0.00L', status: 'ok' },
      { time: '00:12', text: 'READING: 3.40L', status: 'ok' },
      { time: '00:28', text: 'READING: 7.80L', status: 'ok' },
      { time: '00:31', text: 'READING: 36.20L - JUMP DETECTED (+28.40L in 3s)', status: 'error' },
      { time: '00:31', text: 'FLOW RATE: 632 L/min detected - MAX PHYSICAL: 50 L/min', status: 'error' },
      { time: '00:28', text: 'AUDIO/TIMING FLAG: silence_gap (1200 ms)', status: 'warning' },
    ],
    chart_data: [
      { time: 4, value: 0 },
      { time: 12, value: 3.4 },
      { time: 18, value: 4.6 },
      { time: 28, value: 7.8 },
      { time: 31, value: 36.8 },
    ],
    metrics: {
      max_jump_liters: 31.6,
      avg_flow_rate_lpm: 73.6,
      max_flow_rate_lpm: 632,
      total_dispensed_liters: 36.8,
    },
    readings: [
      { timestamp: '00:04', value: 0.0, confidence: 0.96, frame: 20, seconds: 4 },
      { timestamp: '00:12', value: 3.4, confidence: 0.91, frame: 60, seconds: 12 },
      { timestamp: '00:18', value: 4.6, confidence: 0.61, frame: 86, seconds: 18 },
      { timestamp: '00:28', value: 7.8, confidence: 0.9, frame: 130, seconds: 28 },
      { timestamp: '00:31', value: 36.8, confidence: 0.88, frame: 142, seconds: 31 },
    ],
    summary: 'Meter jumped from 5.20L to 36.80L in 3 seconds at 00:31. That implies 632 L/min against a physical limit of 50 L/min, which is about 12.6x the maximum possible rate. This is strong evidence of tampering.',
    blockchain_tx_hash: '0x5c7f6a8b8c2d44d0f4d893ea4d39d22f8ab291d0a3e1ee09156a2fc4b3e97811',
    video_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649bfd7f3b7b12d84d0c4f5c',
    video_url: '',
  }
}

function buildDemoJobPayload() {
  return {
    jobId: 'demo',
    status: 'done',
    stage: 'done',
    videoUrl: '',
    result: buildDemoAnalysis(),
    error: null,
    pump: {
      id: 'demo-pump',
      name: 'Indian Oil - Ring Road Demo',
      city: 'Delhi',
      licenseNumber: 'DL/LM/2025/DEMO',
    },
  }
}

function buildDemoPdfJob() {
  const payload = buildDemoJobPayload()
  return {
    jobId: payload.jobId,
    pumpName: payload.pump.name,
    city: payload.pump.city,
    licenseNumber: payload.pump.licenseNumber,
    processedAt: new Date(),
    createdAt: new Date(),
    result: payload.result,
  }
}

function streamEvidencePdf(res, job) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="fuelguard-report-${job.jobId}.pdf"`)

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.pipe(res)

  const result = job.result || {}
  const reportDate = formatReportDate(job.processedAt || job.createdAt)

  doc.fontSize(20).fillColor('#0A0C0F').text('FuelGuard Evidence Report', { align: 'left' })
  doc.moveDown(0.5)
  doc.fontSize(10).fillColor('#5A6478').text(`Report Date: ${reportDate}`)
  doc.text(`Job ID: ${job.jobId}`)
  doc.moveDown(1)

  doc.fontSize(14).fillColor('#0A0C0F').text('Pump Details')
  doc.moveDown(0.3)
  doc.fontSize(11).fillColor('#1F2937')
  doc.text(`Pump Name: ${job.pumpName || 'Not Provided'}`)
  doc.text(`City: ${job.city || 'Not Provided'}`)
  doc.text(`License Number: ${job.licenseNumber || 'Not Provided'}`)
  doc.moveDown(1)

  doc.fontSize(14).fillColor('#0A0C0F').text('Analysis Summary')
  doc.moveDown(0.3)
  doc.fontSize(11).fillColor('#1F2937')
  doc.text(`Status: ${formatStatus(result.status || 'normal')}`)
  doc.text(`Confidence: ${formatConfidence(result.confidence)}`)
  if (result.blockchain_tx_hash) {
    doc.text(`Blockchain TX: ${result.blockchain_tx_hash}`)
  }
  if (result.metrics) {
    doc.text(`Max Jump: ${result.metrics.max_jump_liters || 0}L`)
    doc.text(`Peak Flow Rate: ${result.metrics.max_flow_rate_lpm || 0} L/min`)
  }
  doc.moveDown(0.5)
  doc.text(result.summary || 'No summary available.')
  doc.moveDown(1)

  if (Array.isArray(result.findings) && result.findings.length) {
    doc.fontSize(14).fillColor('#0A0C0F').text('Detected Findings')
    doc.moveDown(0.3)
    doc.fontSize(11).fillColor('#1F2937')
    result.findings.forEach((finding, index) => {
      doc.text(`${index + 1}. ${formatFinding(finding)}`)
    })
    doc.moveDown(1)
  }

  if (Array.isArray(result.readings) && result.readings.length) {
    doc.fontSize(14).fillColor('#0A0C0F').text('Meter Readings (Sample)')
    doc.moveDown(0.3)
    doc.fontSize(10).fillColor('#1F2937')
    result.readings.slice(0, 12).forEach((reading) => {
      doc.text(`${reading.timestamp} | ${reading.value.toFixed(2)}L | ${Math.round(reading.confidence * 100)}%`)
    })
  }

  doc.end()
}

function buildHeatmapPoints(pumps) {
  return pumps
    .filter((pump) => isValidCoord(pump.lat, pump.lng))
    .map((pump) => ({
      id: pump.pumpId,
      lat: pump.lat,
      lng: pump.lng,
      intensity: Math.max(1, pump.reports || 1),
      score: pump.score,
      status: pump.status,
      city: pump.city,
      pump: pump.name,
    }))
}

function buildShareCardSvg({ jobId, status, confidence, pumpName, city, summary }) {
  const statusText = formatStatus(status)
  const statusColor = status === 'scam' ? '#FF3B3B' : status === 'suspicious' ? '#F5A623' : '#00E5A0'
  const confidencePct = Math.round(confidence > 1 ? confidence : confidence * 100)
  const safeSummary = escapeXml(truncateText(summary, 180))
  const safePumpName = escapeXml(pumpName)
  const safeCity = escapeXml(city)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0A0C0F" />
          <stop offset="100%" stop-color="#111419" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00E5A0" />
          <stop offset="100%" stop-color="#0EA5E9" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)" rx="36" />
      <rect x="34" y="34" width="1132" height="562" rx="28" fill="none" stroke="rgba(255,255,255,0.08)" />
      <rect x="64" y="76" width="184" height="42" rx="21" fill="rgba(0,229,160,0.12)" stroke="rgba(0,229,160,0.24)" />
      <text x="92" y="103" fill="#00E5A0" font-size="20" font-family="IBM Plex Mono, monospace">FuelGuard</text>
      <text x="64" y="182" fill="#E8ECF0" font-size="62" font-family="IBM Plex Mono, monospace" font-weight="700">Pump Verdict</text>
      <rect x="64" y="222" width="360" height="74" rx="18" fill="rgba(255,255,255,0.03)" stroke="${statusColor}" />
      <text x="92" y="270" fill="${statusColor}" font-size="34" font-family="IBM Plex Mono, monospace" font-weight="700">${statusText}</text>
      <text x="64" y="348" fill="#5A6478" font-size="24" font-family="DM Sans, sans-serif">Confidence</text>
      <text x="64" y="394" fill="#E8ECF0" font-size="54" font-family="IBM Plex Mono, monospace" font-weight="700">${confidencePct}%</text>
      <text x="64" y="470" fill="#5A6478" font-size="24" font-family="DM Sans, sans-serif">Pump</text>
      <text x="64" y="508" fill="#E8ECF0" font-size="32" font-family="DM Sans, sans-serif" font-weight="700">${safePumpName}</text>
      <text x="64" y="548" fill="#5A6478" font-size="24" font-family="DM Sans, sans-serif">${safeCity}</text>
      <rect x="610" y="118" width="520" height="360" rx="28" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <text x="650" y="176" fill="#00E5A0" font-size="24" font-family="IBM Plex Mono, monospace">Forensic Summary</text>
      <foreignObject x="650" y="206" width="430" height="210">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:DM Sans,sans-serif;color:#E8ECF0;font-size:28px;line-height:1.45;">
          ${safeSummary}
        </div>
      </foreignObject>
      <line x1="650" y1="464" x2="1080" y2="464" stroke="url(#accent)" stroke-width="4" stroke-linecap="round" />
      <text x="650" y="518" fill="#5A6478" font-size="20" font-family="Roboto Mono, monospace">Job ${escapeXml(jobId)}</text>
      <text x="650" y="554" fill="#5A6478" font-size="20" font-family="Roboto Mono, monospace">Built for India. Powered by AI. Backed by physics.</text>
    </svg>
  `.trim()
}

function svgToDataUrl(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildComplaintPayload({ channel, description, jobId, pump, job }) {
  const reference = `FG-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const portal = normalizeComplaintChannel(channel)
  const pumpName = pump?.name || job?.pumpName || 'Unknown Pump'
  const city = pump?.city || job?.city || 'Unknown'
  const summary = description || job?.result?.summary || 'Suspected meter tampering reported through FuelGuard.'

  return {
    ok: true,
    complaintId: reference,
    status: 'drafted',
    portal,
    submittedAt: new Date().toISOString(),
    nextSteps: [
      'Download the evidence PDF and keep the job link safely stored.',
      'Submit the complaint reference to the fuel station manager and local Legal Metrology office.',
      'Escalate to consumer court or e-Daakhil if the pump fails to respond.',
    ],
    complaint: {
      jobId: jobId || job?.jobId || '',
      pump: pumpName,
      city,
      summary,
    },
  }
}

function normalizeComplaintChannel(value) {
  const channel = (value || '').toLowerCase()
  if (channel === 'iocl') return 'Indian Oil Complaint Portal'
  if (channel === 'bpcl') return 'BPCL Consumer Portal'
  if (channel === 'hpcl') return 'HPCL Consumer Portal'
  if (channel === 'edaakhil') return 'e-Daakhil'
  return 'Consumer Forum'
}

function truncateText(value, limit) {
  if (!value) return ''
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 3).trim()}...`
}

function formatINR(value) {
  const amount = Number(value) || 0
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)
}

function generateReferralCode(name) {
  const prefix = (name || 'FG').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'FG'
  return `${prefix}${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

function generateCalibrationDate(seed) {
  const value = String(seed || 'fuelguard')
  const hash = crypto.createHash('sha256').update(value).digest('hex')
  const monthOffset = parseInt(hash.slice(0, 2), 16) % 9
  const day = (parseInt(hash.slice(2, 4), 16) % 27) + 1
  const date = new Date()
  date.setMonth(date.getMonth() - monthOffset)
  date.setDate(day)
  return formatReportDate(date)
}

function generateCalibrationDueDate(calibrationDate) {
  if (!calibrationDate) return ''
  const parsed = new Date(calibrationDate)
  if (Number.isNaN(parsed.getTime())) return ''
  parsed.setFullYear(parsed.getFullYear() + 1)
  return formatReportDate(parsed)
}

async function getOrCreateFleet(ownerId) {
  let fleet = await Fleet.findOne({ ownerId })
  if (!fleet) {
    fleet = await Fleet.create({ ownerId })
  }
  return fleet
}

function estimateFraudLoss(vehicles) {
  const list = Array.isArray(vehicles) ? vehicles : []
  let total = 0
  for (const vehicle of list) {
    const fills = Array.isArray(vehicle.fills) ? vehicle.fills : []
    for (const fill of fills) {
      const amount = Number(fill.amount)
      if (!Number.isFinite(amount) || amount <= 0) continue
      const status = (fill.status || 'normal').toString().toLowerCase()
      if (status === 'suspicious') {
        total += amount * 0.1
      } else if (status === 'scam') {
        total += amount * 0.3
      }
    }
  }
  return Math.round(total)
}

function normalizeRegistration(value) {
  return value.replace(/\s+/g, '').toUpperCase()
}

function updateVehicleAggregates(vehicle, fills) {
  const base = vehicle?.toObject ? vehicle.toObject() : (vehicle || {})
  const fillList = Array.isArray(fills)
    ? fills
    : Array.isArray(base.fills)
      ? base.fills
      : []
  const lastFill = fillList.length
    ? fillList.reduce((latest, current) => {
        const currentDate = new Date(current.date)
        if (!latest) return currentDate
        return currentDate > latest ? currentDate : latest
      }, null)
    : null
  const flaggedFills = fillList.filter((fill) => (fill.status || '') !== 'normal').length
  const totalFills = fillList.length
  const latestFill = fillList
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

  return {
    ...base,
    registration: base.registration || vehicle?.registration || '',
    driverName: base.driverName || vehicle?.driverName || 'Unassigned',
    totalFills,
    flaggedFills,
    lastFillAt: lastFill || base.lastFillAt || null,
    status: latestFill?.status || base.status || 'normal',
    fills: fillList,
  }
}

function summarizeFills(fills) {
  const fillList = Array.isArray(fills) ? fills : []
  const totals = fillList.reduce(
    (acc, fill) => {
      acc.totalLiters += Number(fill.liters) || 0
      acc.totalAmount += Number(fill.amount) || 0
      return acc
    },
    { totalLiters: 0, totalAmount: 0 }
  )

  return {
    totalLiters: Math.round(totals.totalLiters * 100) / 100,
    totalAmount: Math.round(totals.totalAmount * 100) / 100,
    averageRate: fillList.length && totals.totalLiters > 0
      ? Math.round((totals.totalAmount / totals.totalLiters) * 100) / 100
      : 0,
  }
}

function serializeFills(fills) {
  return fills
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((fill) => ({
      date: formatReportDate(fill.date),
      dateIso: new Date(fill.date).toISOString(),
      liters: fill.liters,
      amount: fill.amount,
      status: fill.status || 'normal',
      notes: fill.notes || '',
      pumpName: fill.pumpName || '',
      pumpCity: fill.pumpCity || '',
      pumpLat: fill.pumpLat ?? null,
      pumpLng: fill.pumpLng ?? null,
      invoiceUrl: fill.invoiceUrl || '',
      invoiceName: fill.invoiceName || '',
    }))
}

function buildVehicleResponse(vehicle) {
  const fills = Array.isArray(vehicle.fills) ? vehicle.fills : []
  const normalizedVehicle = updateVehicleAggregates(vehicle, fills)
  const summary = summarizeFills(fills)

  return {
    vehicle: {
      reg: normalizedVehicle.registration,
      driver: normalizedVehicle.driverName,
      status: normalizedVehicle.status || 'normal',
      totalFills: normalizedVehicle.totalFills || 0,
      flaggedFills: normalizedVehicle.flaggedFills || 0,
      lastFill: normalizedVehicle.lastFillAt ? formatReportDate(normalizedVehicle.lastFillAt) : 'Not yet',
    },
    summary,
    fills: serializeFills(fills),
  }
}

function calculateAvgResolution(reports) {
  if (!reports.length) return 0
  const now = Date.now()
  const days = reports.map((report) => (now - new Date(report.createdAt).getTime()) / (1000 * 60 * 60 * 24))
  const avg = days.reduce((sum, value) => sum + value, 0) / days.length
  return Math.round(avg * 10) / 10
}

function buildFraudByCity(reports) {
  if (!reports.length) return []
  const counts = new Map()
  for (const report of reports) {
    const city = (report.city || 'Unknown').toString()
    counts.set(city, (counts.get(city) || 0) + 1)
  }
  const total = reports.length || 1
  return Array.from(counts.entries())
    .map(([city, count]) => ({
      city,
      rate: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8)
}

function buildFraudByCompany(pumps) {
  if (!pumps.length) return []
  const counts = new Map()
  for (const pump of pumps) {
    const company = (pump.company || 'Independent').toString()
    counts.set(company, (counts.get(company) || 0) + (pump.reports || 0))
  }
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0) || 1
  return Array.from(counts.entries())
    .map(([name, count], index) => ({
      name,
      value: Math.round((count / total) * 100),
      color: index % 2 === 0 ? 'hsl(160 100% 45%)' : 'hsl(38 91% 55%)',
    }))
}

function buildMonthlyTrend(reports) {
  const now = new Date()
  const buckets = new Map()
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    buckets.set(key, { month: date.toLocaleDateString('en-GB', { month: 'short' }), reports: 0 })
  }

  reports.forEach((report) => {
    const date = new Date(report.createdAt)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (buckets.has(key)) {
      buckets.get(key).reports += 1
    }
  })

  return Array.from(buckets.values())
}

function buildRecentReports(reports, pumps) {
  const pumpMap = new Map(pumps.map((pump) => [pump.pumpId, pump]))
  return reports.slice(0, 8).map((report) => {
    const pump = pumpMap.get(report.pumpId)
    return {
      pump: pump?.name || 'Unknown Pump',
      city: report.city || pump?.city || 'Unknown',
      type: report.fraudType || inferFraudType(report.status, report.reason),
      count: pump?.reports || 1,
      date: formatReportDate(report.createdAt),
      inspector: report.inspector || 'Unassigned',
    }
  })
}

function buildAlerts(reports, pumps) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const counts = new Map()
  reports.forEach((report) => {
    if (new Date(report.createdAt) < since) return
    counts.set(report.pumpId, (counts.get(report.pumpId) || 0) + 1)
  })

  const pumpMap = new Map(pumps.map((pump) => [pump.pumpId, pump]))
  const alerts = []
  counts.forEach((count, pumpId) => {
    if (count >= 5) {
      const pump = pumpMap.get(pumpId)
      alerts.push({
        pump: `${pump?.name || 'Unknown Pump'}${pump?.city ? `, ${pump.city}` : ''}`,
        message: `${count} reports in 7 days - auto alert triggered`,
        time: 'recent',
      })
    }
  })
  return alerts
}
