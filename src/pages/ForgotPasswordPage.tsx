import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { requestPasswordReset, resetPassword } from '@/lib/auth'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [stage, setStage] = useState<'request' | 'reset'>('request')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!email.trim()) {
      setError('Please enter your email.')
      return
    }
    setLoading(true)
    try {
      const resetToken = await requestPasswordReset(email.trim())
      setLoading(false)
      setStage('reset')
      setMessage(
        resetToken
          ? 'Development reset token generated. Review or paste it below to continue.'
          : 'If the email exists, use the issued reset token to continue.'
      )
      if (resetToken) {
        setToken(resetToken)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request reset.')
      setLoading(false)
    }
  }

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!token.trim() || !newPassword.trim()) {
      setError('Reset token and new password are required.')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token.trim(), newPassword)
      setLoading(false)
      setMessage('Password reset successful. You can now sign in.')
      setStage('request')
      setEmail('')
      setToken('')
      setNewPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-mono text-3xl font-bold text-foreground">Reset Password</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your email to start the password reset flow.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card rounded-xl p-6 lg:p-8"
        >
          {stage === 'request' ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-data block mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              {message && (
                <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
                  {message}
                </div>
              )}

              <Button type="submit" variant="default" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Token'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-data block mb-1.5">
                  Reset Token
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste reset token"
                  className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-data block mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2.5 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              {message && (
                <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
                  {message}
                </div>
              )}

              <Button type="submit" variant="default" className="w-full" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          )}

          <div className="text-xs text-muted-foreground mt-4 text-center">
            Remember your password?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
