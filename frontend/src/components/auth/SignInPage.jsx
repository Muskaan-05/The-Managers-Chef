import React, { useState } from 'react';
import { Sparkles, Eye, EyeOff, ArrowLeft, RefreshCw } from 'lucide-react';
import { login } from '../../services/api';
import '../../styles/auth.css';

export default function SignInPage({ onNavigate, onSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const { user } = await login(email.trim(), password);
      onSignIn(user);
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
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
            <h1 className="auth-title">Sign in to workspace</h1>
            <p className="auth-subtitle">Enter your credentials to access your memory workspace</p>
          </div>
        </div>

        {/* Error Alert if any */}
        {error && <div className="auth-error-msg">{error}</div>}

        {/* Sign In Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
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
            <div className="auth-label">
              <label htmlFor="password">Password</label>
            </div>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                placeholder="••••••••"
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

          <button type="submit" className="btn-auth-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={16} className="spin-icon" /> Signing in...
              </span>
            ) : (
              'Sign In to Workspace'
            )}
          </button>
        </form>

        {/* Footer Navigation Links */}
        <div className="auth-footer-links">
          <div>
            Don't have an account?{' '}
            <button
              type="button"
              className="auth-link"
              onClick={() => onNavigate('signup')}
            >
              Sign Up
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
