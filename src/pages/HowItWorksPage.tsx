import { motion } from 'framer-motion'
import { HowItWorksSection } from '@/components/landing/HowItWorksSection'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { useState } from 'react'

const faqs = [
  {
    q: 'Is this court-admissible?',
    a: 'Yes. Our evidence reports include blockchain-sealed timestamps, SHA-256 video fingerprints, and chain-of-custody documentation accepted by Indian consumer courts under the Information Technology Act, 2000.',
  },
  {
    q: 'How long is my video stored?',
    a: 'Free tier videos are processed and deleted within 24 hours. Pro and Business plans retain videos for 90 days with encrypted cloud storage. Enterprise plans offer custom retention policies.',
  },
  {
    q: 'What meter types are supported?',
    a: 'Our OCR engine supports digital LED displays, LCD panels, and mechanical rolling counters across all major Indian fuel pump manufacturers including Gilbarco, Tokheim, Wayne, and IOCL/BPCL standard units.',
  },
  {
    q: 'What languages are supported for results?',
    a: 'English, Hindi, Gujarati, Marathi, Tamil, Telugu, Kannada, and Bengali. We are adding more languages regularly.',
  },
  {
    q: 'How accurate is the detection?',
    a: 'Our AI achieves 98% accuracy on controlled datasets. In real-world conditions, accuracy ranges from 85-96% depending on video quality, lighting, and meter type.',
  },
]

export function HowItWorksPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16 max-w-2xl mx-auto"
        >
          <span className="font-data text-xs text-primary tracking-widest uppercase">
            Process
          </span>
          <h1 className="font-mono text-3xl lg:text-5xl font-bold text-foreground mt-3">
            How FuelGuard Works
          </h1>
          <p className="text-muted-foreground mt-4 text-lg">
            From video upload to fraud verdict — powered by AI, secured by blockchain.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto mb-24">
          <HowItWorksSection />
        </div>

        {/* Interactive demo CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-24"
        >
          <div className="glass-card rounded-xl p-10 max-w-xl mx-auto">
            <h2 className="font-mono text-xl font-bold text-foreground mb-3">
              See it in action
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Upload a sample video and watch the analysis happen in real-time.
            </p>
            <Link to="/upload">
              <Button variant="hero" size="xl" className="gap-2">
                Try a Demo Analysis
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="font-mono text-2xl font-bold text-foreground text-center mb-10">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="glass-card rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-mono text-sm font-medium text-foreground pr-4">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-5 pb-5"
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}