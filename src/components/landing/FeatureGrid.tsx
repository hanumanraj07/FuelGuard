import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Search, Zap, Lock, BarChart3, FileCheck, Globe } from 'lucide-react'

const features = [
  {
    icon: Search,
    title: 'Frame-by-Frame Analysis',
    description: 'Our AI extracts every frame from your video and reads the meter digits using advanced OCR technology.',
  },
  {
    icon: Zap,
    title: 'Results in Under 60 Seconds',
    description: 'Lightning-fast processing pipeline delivers your fraud analysis before you finish your chai.',
  },
  {
    icon: Lock,
    title: 'Your Video Stays Private',
    description: 'End-to-end encrypted uploads. Videos are processed and deleted. We never share your data.',
  },
  {
    icon: BarChart3,
    title: 'Physics-Based Detection',
    description: 'Our algorithms check flow rates against physical limits — no pump can dispense 500L/min.',
  },
  {
    icon: FileCheck,
    title: 'Court-Admissible Reports',
    description: 'Generate blockchain-sealed PDF evidence reports accepted by consumer courts across India.',
  },
  {
    icon: Globe,
    title: '8 Indian Languages',
    description: 'Results available in Hindi, Gujarati, Marathi, Tamil, Telugu, Kannada, Bengali, and English.',
  },
]

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "100px" })

  return (
    <motion.div
      ref={ref}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0.4, y: 10 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="glass-card p-6 group hover:border-[hsl(160_100%_45%/0.3)] transition-all duration-300"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
        <feature.icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-mono text-sm font-semibold text-foreground mb-2">
        {feature.title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {feature.description}
      </p>
    </motion.div>
  )
}

export function FeatureGrid() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
      {features.map((feature, i) => (
        <FeatureCard key={feature.title} feature={feature} index={i} />
      ))}
    </div>
  )
}