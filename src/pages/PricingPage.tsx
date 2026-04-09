import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, CreditCard, Landmark, Smartphone, X } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { authHeaders, getAuthUser, updateStoredAuthUser, type AuthUser } from '@/lib/auth'

type Plan = {
  key: 'free' | 'consumer-pro' | 'business' | 'enterprise'
  name: string
  monthlyPrice: number
  yearlyPrice: number
  description: string
  features: string[]
  cta: string
  popular: boolean
}

type CheckoutSession = {
  mode: 'mock' | 'live' | 'contact_sales' | 'free'
  checkoutId?: string
  message?: string
  note?: string
  contact?: string
  plan?: {
    key: string
    displayName: string
    billingCycle: 'monthly' | 'annual'
    amount: number
    amountDisplay: string
  }
  methods?: Array<'upi' | 'card' | 'netbanking'>
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
}

const plans: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'For occasional consumers checking suspicious fills.',
    features: ['3 analyses per month', 'Basic result summary', 'Community reports map access', 'Email support'],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    key: 'consumer-pro',
    name: 'Consumer Pro',
    monthlyPrice: 99,
    yearlyPrice: 990,
    description: 'For regular drivers who want full protection.',
    features: ['Unlimited analyses', 'PDF evidence reports', 'Full analysis history', 'WhatsApp result sharing', 'Priority processing'],
    cta: 'Start Pro Plan',
    popular: true,
  },
  {
    key: 'business',
    name: 'Business',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    description: 'For fleet managers and logistics companies.',
    features: ['Everything in Pro', 'Fleet dashboard', 'Bulk video upload', 'REST API access', 'Monthly PDF reports'],
    cta: 'Start Business',
    popular: false,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: -1,
    yearlyPrice: -1,
    description: 'White-label portal for government and large organizations.',
    features: ['Everything in Business', 'White-label portal', 'Government API integration', 'SLA guarantee', 'Dedicated support manager'],
    cta: 'Contact Sales',
    popular: false,
  },
]

export function PricingPage() {
  const [annual, setAnnual] = useState(false)
  const [viewer, setViewer] = useState<AuthUser | null>(() => getAuthUser())
  const [loadingPlanKey, setLoadingPlanKey] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'primary' | 'destructive'; text: string } | null>(null)

  const billingCycle = annual ? 'annual' : 'monthly'
  const guestMode = !viewer

  const paymentMethodMeta = useMemo(() => ({
    upi: { label: 'UPI', icon: Smartphone, detail: 'Pay with UPI in demo mode.' },
    card: { label: 'Card', icon: CreditCard, detail: 'Use a demo card. No money will be charged.' },
    netbanking: { label: 'Netbanking', icon: Landmark, detail: 'Demo bank approval screen.' },
  }), [])

  const handleSelectPlan = async (plan: Plan) => {
    setLoadingPlanKey(plan.key)
    setNotice(null)
    try {
      const response = await fetch(apiUrl('/api/subscribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          planKey: plan.key,
          planId: plan.key,
          billingCycle,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Unable to start subscription flow')
      }

      if (data.mode === 'contact_sales') {
        setNotice({
          tone: 'primary',
          text: data.message || 'Enterprise plans are handled through sales.',
        })
        return
      }

      if (data.mode === 'free') {
        await confirmCheckout(data.checkoutId || `free_${Date.now()}`, plan)
        return
      }

      setSelectedMethod('upi')
      setCheckout(data as CheckoutSession)
    } catch (err) {
      setNotice({
        tone: 'destructive',
        text: err instanceof Error ? err.message : 'Unable to start checkout.',
      })
    } finally {
      setLoadingPlanKey(null)
    }
  }

  const confirmCheckout = async (checkoutId: string, plan: Plan) => {
    setProcessingPayment(true)
    setNotice(null)
    try {
      const response = await fetch(apiUrl('/api/subscribe/confirm'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          checkoutId,
          planKey: plan.key,
          planId: plan.key,
          billingCycle,
          paymentMethod: selectedMethod,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Unable to confirm subscription')
      }

      if (data.user) {
        updateStoredAuthUser(data.user)
        setViewer(data.user)
      }

      setCheckout(null)
      setNotice({
        tone: 'primary',
        text: data.nextBillingDate
          ? `${data.message} Next billing: ${data.nextBillingDate}.`
          : data.message || 'Plan updated successfully.',
      })
    } catch (err) {
      setNotice({
        tone: 'destructive',
        text: err instanceof Error ? err.message : 'Unable to complete payment.',
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <span className="font-data text-xs text-primary tracking-widest uppercase">Pricing</span>
          <h1 className="font-mono text-3xl lg:text-5xl font-bold text-foreground mt-3">Simple, transparent pricing</h1>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            Start free. Upgrade when you need more power. This page now includes a built-in Razorpay-style demo checkout so you can test subscriptions safely before wiring live keys.
          </p>

          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm ${!annual ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
            <button onClick={() => setAnnual(!annual)} className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-primary' : 'bg-secondary'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-foreground transition-all ${annual ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
            <span className={`text-sm ${annual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Annual
              <span className="ml-1.5 text-xs text-primary font-data">Save 2 months</span>
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Badge variant="normal">Demo Razorpay Enabled</Badge>
            {viewer?.plan && <Badge variant="suspicious">Current Plan: {viewer.plan}</Badge>}
            {guestMode && <Badge variant="scam">Guest Checkout Won&apos;t Persist</Badge>}
          </div>
        </motion.div>

        {notice && (
          <div className={`max-w-3xl mx-auto mb-8 rounded-xl border px-4 py-3 text-sm ${notice.tone === 'primary' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>
            {notice.text}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const active = viewer?.plan === plan.name
            const displayedPrice = annual ? plan.yearlyPrice : plan.monthlyPrice
            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className={`glass-card rounded-xl p-6 relative flex flex-col ${plan.popular ? 'border-primary/40 shadow-[var(--shadow-glow)]' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold font-data">
                    MOST POPULAR
                  </div>
                )}
                {active && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="normal">Active</Badge>
                  </div>
                )}

                <h3 className="font-mono text-lg font-semibold text-foreground">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">{plan.description}</p>

                <div className="mb-6">
                  {displayedPrice === -1 ? (
                    <span className="font-mono text-2xl font-bold text-foreground">Custom</span>
                  ) : (
                    <>
                      <span className="font-mono text-3xl font-bold text-foreground">
                        {displayedPrice === 0 ? 'Free' : formatPrice(displayedPrice)}
                      </span>
                      {displayedPrice > 0 && (
                        <span className="text-sm text-muted-foreground">
                          /{annual ? 'year' : 'mo'}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => void handleSelectPlan(plan)}
                  disabled={loadingPlanKey === plan.key || active}
                >
                  {active ? 'Current Plan' : loadingPlanKey === plan.key ? 'Starting...' : plan.cta}
                </Button>
              </motion.div>
            )
          })}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-20 max-w-2xl mx-auto text-center">
          <h2 className="font-mono text-xl font-bold text-foreground mb-6">Pricing FAQ</h2>
          <div className="space-y-4 text-left">
            {[
              { q: 'Is this a real payment flow?', a: 'The page supports a demo Razorpay-style checkout by default. If live plan IDs are configured later, the backend is ready to switch modes.' },
              { q: 'Can I cancel anytime?', a: 'Yes. Your access continues until the end of the current billing period.' },
              { q: 'What happens as a guest?', a: 'You can test the demo checkout, but plan activation will only persist when you are logged in.' },
            ].map((faq) => (
              <div key={faq.q} className="glass-card rounded-lg p-5">
                <h4 className="font-mono text-sm font-medium text-foreground mb-2">{faq.q}</h4>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {checkout && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm px-4 py-6 overflow-y-auto">
          <div className="max-w-lg mx-auto glass-card rounded-2xl border border-primary/20 shadow-[var(--shadow-glow)]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-glow-pulse" />
                  <span className="font-data text-xs text-primary tracking-widest uppercase">
                    {checkout.mode === 'live' ? 'Razorpay Live Draft' : 'Mock Razorpay Checkout'}
                  </span>
                </div>
                <h3 className="font-mono text-xl text-foreground mt-2">{checkout.plan?.displayName}</h3>
              </div>
              <button onClick={() => setCheckout(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="rounded-xl bg-card/60 border border-border px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-data uppercase tracking-wider text-muted-foreground">Amount</div>
                    <div className="font-mono text-2xl text-foreground mt-1">{checkout.plan?.amountDisplay}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-data uppercase tracking-wider text-muted-foreground">Billing</div>
                    <div className="text-sm text-foreground mt-1 capitalize">{checkout.plan?.billingCycle}</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {checkout.note || checkout.message || 'Secure checkout session created.'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-data uppercase tracking-wider text-muted-foreground">Choose Payment Method</div>
                <div className="grid grid-cols-3 gap-2">
                  {(checkout.methods || ['upi', 'card', 'netbanking']).map((method) => {
                    const meta = paymentMethodMeta[method]
                    return (
                      <button
                        key={method}
                        onClick={() => setSelectedMethod(method)}
                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${selectedMethod === method ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card/50 text-muted-foreground hover:text-foreground'}`}
                      >
                        <meta.icon className="w-4 h-4 mb-2" />
                        <div className="text-sm font-medium">{meta.label}</div>
                      </button>
                    )
                  })}
                </div>
                <div className="rounded-lg bg-secondary/40 px-3 py-3 text-xs text-muted-foreground">
                  {paymentMethodMeta[selectedMethod].detail}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <ReadOnlyField label="Name" value={checkout.prefill?.name || (guestMode ? 'Guest User' : viewer?.name || '')} />
                <ReadOnlyField label="Contact" value={checkout.prefill?.contact || viewer?.phone || 'Not provided'} />
                <div className="sm:col-span-2">
                  <ReadOnlyField label="Email" value={checkout.prefill?.email || viewer?.email || 'guest@fuelguard.demo'} />
                </div>
              </div>

              {guestMode && (
                <div className="rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                  Demo checkout works as a guest, but subscription activation only persists when you are logged in.
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="sm:flex-1" onClick={() => setCheckout(null)}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  className="sm:flex-1"
                  onClick={() => {
                    const plan = plans.find((item) => item.key === checkout.plan?.key)
                    if (plan) {
                      void confirmCheckout(checkout.checkoutId || `mock_${Date.now()}`, plan)
                    }
                  }}
                  disabled={processingPayment}
                >
                  {processingPayment ? 'Processing...' : checkout.mode === 'live' ? 'Activate Subscription' : `Pay ${checkout.plan?.amountDisplay} (Demo)`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-data uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground">{value}</div>
    </div>
  )
}

function formatPrice(value: number) {
  return `Rs. ${value}`
}
