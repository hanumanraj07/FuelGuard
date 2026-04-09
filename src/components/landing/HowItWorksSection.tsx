import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Upload, Film, Eye, Cpu, AlertTriangle, FileText } from 'lucide-react'

const steps = [
  {
    icon: Upload,
    number: '01',
    title: 'Record or Upload',
    description: 'Capture the fuel pump meter directly from your browser or upload an existing video.',
  },
  {
    icon: Film,
    number: '02',
    title: 'Secure Upload',
    description: 'Your video is encrypted and securely transmitted to FuelGuard processing servers.',
  },
  {
    icon: Eye,
    number: '03',
    title: 'Frame Extraction',
    description: 'AI extracts one frame per second and isolates the meter display region.',
  },
  {
    icon: Cpu,
    number: '04',
    title: 'OCR Reading',
    description: 'EasyOCR reads every meter digit across all frames with multi-language support.',
  },
  {
    icon: AlertTriangle,
    number: '05',
    title: 'Fraud Analysis',
    description: 'Algorithms check for jumps, non-zero starts, impossible flow rates, and patterns.',
  },
  {
    icon: FileText,
    number: '06',
    title: 'Your Verdict',
    description: 'Receive a detailed analysis with confidence score and optional legal evidence PDF.',
  },
]

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "80px" })

  return (
    <motion.div
      ref={ref}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0.5, x: 0 }}
      transition={{ duration: 0.5, delay: 0.05 }}
      className={`flex items-start gap-6 lg:gap-12 ${
        index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
      }`}
    >
      {/* Content */}
      <div className={`flex-1 ${index % 2 === 0 ? 'lg:text-right' : 'lg:text-left'}`}>
        <div className="glass-card p-6 inline-block">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-data text-xs text-primary/60">{step.number}</span>
            <h3 className="font-mono text-base font-semibold text-foreground">
              {step.title}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>
      </div>

      {/* Center dot */}
      <div className="hidden lg:flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center relative">
          <step.icon className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Spacer for alternating layout */}
      <div className="hidden lg:block flex-1" />
    </motion.div>
  )
}

export function HowItWorksSection() {
  return (
    <div className="relative">
      {/* Vertical line connector */}
      <div className="absolute left-6 lg:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-primary/10 to-transparent hidden md:block" />

      <div className="space-y-8 lg:space-y-12">
        {steps.map((step, i) => (
          <StepCard key={step.number} step={step} index={i} />
        ))}
      </div>
    </div>
  )
}