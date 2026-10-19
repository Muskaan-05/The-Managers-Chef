import React, { useState } from 'react';
import { Sparkles, Eye, EyeOff, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { signup } from '../../services/api';
import '../../styles/auth.css';

export default function SignUpPage({ onNavigate, onSignUp }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const result = await signup(name.trim(), email.trim(), password, timezone);

      if (result.requiresConfirmation) {
        setSuccessMsg('Account created successfully! If email confirmation is enabled, please verify your email before signing in.');
        setTimeout(() => {
          onNavigate('signin');
        }, 3000);
      } else {
        onSignUp(result.user);
      }
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* Brand & Logo Header */}
        <div className="auth-brand-header">
          <div className="auth-logo-badge" onClick={() => onNavigate('landing')} style={{ cursor: 'pointer' }}>
            <Sparkles size={22} />
          </div>
          <div className="auth-title-group">
            <h1 className="auth-title">Create your workspace</h1>
            <p className="auth-subtitle">Start organizing your team's context with AI</p>
          </div>
        </div>

        {/* Error Alert if any */}
        {error && <div className="auth-error-msg">{error}</div>}

        {/* Success Alert if confirmation required */}
        {successMsg && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--badge-emerald-bg)',
            color: 'var(--badge-emerald-text)',
            border: '1px solid var(--badge-emerald-border)',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Sign Up Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label className="auth-label" htmlFor="name">
              Full Name
            </label>
            <div className="auth-input-wrapper">
              <input
                id="name"
                type="text"
                className="auth-input"
                placeholder="Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="email">
              Work Email
            </label>
            <div className="auth-input-wrapper">
              <input
                id="email"
                type="email"
                className="auth-input"
                placeholder="alex.morgan@company.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="password">
              Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-auth-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={16} className="spin-icon" /> Creating Account...
              </span>
            ) : (
              'Create Workspace Account'
            )}
          </button>
        </form>

        {/* Footer Navigation Links */}
        <div className="auth-footer-links">
          <div>
            Already have an account?{' '}
            <button
              type="button"
              className="auth-link"
              onClick={() => onNavigate('signin')}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      {/* Link back to Landing Page */}
      <button
        type="button"
        className="auth-back-home"
        onClick={() => onNavigate('landing')}
      >
        <ArrowLeft size={14} /> Back to Landing Page
      </button>
    </div>
  );
}
