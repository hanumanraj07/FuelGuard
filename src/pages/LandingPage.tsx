import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { HowItWorksSection } from '@/components/landing/HowItWorksSection'
import { AnimatedCounter } from '@/components/landing/AnimatedCounter'
import { ArrowRight, Shield, Hash, Scale } from 'lucide-react'

function FadeInSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "50px" })

  return (
    <motion.div
      ref={ref}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0.5, y: 8 }}
      transition={{ duration: 0.6, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden scanline-overlay">
        {/* Background layers */}
        <div className="absolute inset-0 hero-mesh" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'url(/images/hero-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />

        <div className="relative z-10 container mx-auto px-4 lg:px-8 py-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Eyebrow badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-glow-pulse" />
              <span className="text-xs font-data text-primary tracking-wide">
                AI-POWERED FRAUD DETECTION
              </span>
            </motion.div>

            <h1 className="font-mono text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.1]">
              Don't get cheated{' '}
              <span className="text-gradient-primary">at the pump.</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload your fueling video. Our AI reads the meter, frame by frame,
              and tells you if something's wrong.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Link to="/upload">
                <Button variant="hero" size="xl" className="gap-2">
                  Analyze My Video
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/results/demo">
                <Button variant="hero-secondary" size="xl">
                  See a Live Demo
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Floating demo preview */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="mt-16 lg:mt-20 max-w-4xl mx-auto"
          >
            <div className="glass-card p-1.5 rounded-xl shadow-[var(--shadow-glow)]">
              <div className="rounded-lg overflow-hidden relative">
                <img
                  src="/images/fuel-pump-meter.png"
                  alt="FuelGuard AI analyzing a fuel pump meter in real-time"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="glass-card px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-glow-pulse" />
                      <span className="font-data text-xs text-primary">ANALYZING FRAMES...</span>
                    </div>
                    <span className="font-data text-xs text-muted-foreground">Frame 42 / 180</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <FadeInSection className="text-center mb-16">
            <span className="font-data text-xs text-primary tracking-widest uppercase">
              Capabilities
            </span>
            <h2 className="font-mono text-3xl lg:text-4xl font-bold text-foreground mt-3">
              Forensic-grade analysis
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              Every tool you need to detect, document, and report fuel pump fraud.
            </p>
          </FadeInSection>
          <FeatureGrid />
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-20 border-y border-border bg-card/50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <AnimatedCounter end={10000} suffix="+" label="Pumps Analyzed" />
            <AnimatedCounter end={2800} suffix="+" label="Frauds Detected" />
            <AnimatedCounter end={47} suffix="" label="Cities Covered" />
            <AnimatedCounter end={98} suffix="%" label="Detection Accuracy" />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <FadeInSection className="text-center mb-16">
            <span className="font-data text-xs text-primary tracking-widest uppercase">
              Process
            </span>
            <h2 className="font-mono text-3xl lg:text-4xl font-bold text-foreground mt-3">
              How it works
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              From video upload to fraud verdict in six simple steps.
            </p>
          </FadeInSection>
          <HowItWorksSection />
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-4 lg:px-8">
          <FadeInSection className="text-center mb-12">
            <h2 className="font-mono text-2xl lg:text-3xl font-bold text-foreground">
              Trusted & Verified
            </h2>
          </FadeInSection>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { icon: Shield, label: 'Blockchain Verified', desc: 'Every analysis is sealed on Polygon with a tamper-proof hash.' },
              { icon: Hash, label: 'SHA-256 Fingerprinted', desc: 'Video integrity verified with cryptographic fingerprints.' },
              { icon: Scale, label: 'Court-Admissible PDF', desc: 'Generate evidence reports accepted by Indian consumer courts.' },
            ].map((badge) => (
              <div
                key={badge.label}
                className="glass-card p-6 text-center group hover:border-[hsl(160_100%_45%/0.3)] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <badge.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-mono text-sm font-semibold text-foreground mb-2">{badge.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 hero-mesh" />
        <div className="relative z-10 container mx-auto px-4 lg:px-8 text-center">
          <FadeInSection>
            <h2 className="font-mono text-3xl lg:text-5xl font-bold text-foreground max-w-2xl mx-auto leading-tight">
              Stop fuel fraud.<br />
              <span className="text-gradient-primary">Start here.</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-md mx-auto">
              Free to use. No signup required for your first analysis. Upload a video and get results in under 60 seconds.
            </p>
            <Link to="/upload">
              <Button variant="hero" size="xl" className="mt-8 gap-2">
                Analyze My Video
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </FadeInSection>
        </div>
      </section>
    </>
  )
}