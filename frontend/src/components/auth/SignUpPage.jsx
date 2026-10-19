import React, { useState } from 'react';
import { Sparkles, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import '../../styles/auth.css';

export default function SignUpPage({ onNavigate, onSignUp }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
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
    // Frontend-only mock sign up success
    onSignUp(name, email);
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
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-auth-primary">
            Create Workspace Account
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
