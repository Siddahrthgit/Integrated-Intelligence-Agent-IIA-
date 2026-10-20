'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Plan = { id: 'student-monthly' | 'student-annual'; name: string; price: string; duration: string; description: string; features: string[] };

const plans: Plan[] = [
  { id: 'student-monthly', name: 'Study Plus · 30 days', price: 'NPR 499', duration: '30 days of access', description: 'Flexible access while you prepare for your next exam.', features: ['PDF upload and text extraction', 'Ask questions about your own PDF', 'Generate practice exams from study material', 'Review answers and explanations'] },
  { id: 'student-annual', name: 'Study Plus · 365 days', price: 'NPR 4,999', duration: '365 days of access', description: 'A full year of study support at a lower effective monthly price.', features: ['Everything in the 30-day plan', 'One payment for a full year', 'Access continues for the purchased period'] },
];

export default function PricingPage() {
  const [token, setToken] = useState('');
  const [busyPlan, setBusyPlan] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [subscription, setSubscription] = useState<{ planId: string; expiresAt: string } | null>(null);
  const [paymentConfigured, setPaymentConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const payment = query.get('payment');
    if (payment === 'success') setNotice('Payment verified. Your IIA Study Plus access is active.');
    else if (payment === 'pending') setNotice('Khalti has not confirmed this payment yet. Your access will not activate until verification completes.');
    else if (payment === 'failed') setNotice('Payment was not completed. You can try checkout again.');
    else if (payment === 'unconfigured') setNotice('Payment verification is not configured. Please contact IIA support.');
    const savedToken = window.sessionStorage.getItem('iia_token') || '';
    setToken(savedToken);
    if (!savedToken) return;
    fetch('/api/payments/status', { headers: { authorization: `Bearer ${savedToken}` }, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Could not check your plan.');
        setSubscription(payload.subscription || null);
        setPaymentConfigured(Boolean(payload.paymentConfigured));
      })
      .catch((failure) => setError(failure instanceof Error ? failure.message : 'Could not check your plan.'));
  }, []);

  const checkout = async (planId: Plan['id']) => {
    if (!token) {
      setError('Create an IIA account or sign in first, then return here to purchase access.');
      return;
    }
    setBusyPlan(planId);
    setError('');
    try {
      const response = await fetch('/api/payments/khalti/initiate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.paymentUrl !== 'string') throw new Error(payload.message || 'Could not start payment checkout.');
      window.location.assign(payload.paymentUrl);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not start payment checkout.');
      setBusyPlan('');
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#111827', padding: '32px 18px 56px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 44 }}>
          <Link href="/" style={{ color: '#111827', fontWeight: 700, textDecoration: 'none' }}>← Back to IIA</Link>
          <Link href="/business" style={{ color: '#374151' }}>IIA Business</Link>
        </nav>
        <header style={{ maxWidth: 720, margin: '0 auto 30px', textAlign: 'center' }}>
          <p style={{ color: '#4f46e5', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>IIA Study Plus</p>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.3rem)', lineHeight: 1.1, margin: '12px 0' }}>Your study material. Your practice exam. One workspace.</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: '#4b5563' }}>Purchase a fixed access period through Khalti. Access activates only after the server verifies the payment with the provider. Plans do not auto-renew.</p>
        </header>

        {notice ? <p role="status" style={{ padding: 14, background: '#eef2ff', borderRadius: 12, textAlign: 'center' }}>{notice}</p> : null}
        {subscription ? <p role="status" style={{ padding: 14, background: '#ecfdf5', borderRadius: 12, textAlign: 'center' }}>Your plan is active until {new Date(subscription.expiresAt).toLocaleString()}.</p> : null}
        {!token ? <p style={{ textAlign: 'center', padding: 14, background: '#fff7ed', borderRadius: 12 }}>You need an IIA account to purchase access. <Link href="/" style={{ fontWeight: 700 }}>Sign in or create an account</Link>, then return to this page.</p> : null}
        {token && paymentConfigured === false ? <p style={{ textAlign: 'center', padding: 14, background: '#fff7ed', borderRadius: 12 }}>Online checkout is not enabled on the server yet. No payment will be taken until the IIA merchant account is configured.</p> : null}
        {error ? <p role="alert" style={{ color: '#b91c1c', textAlign: 'center', margin: '16px 0' }}>{error}</p> : null}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20, marginTop: 28 }}>
          {plans.map((plan) => (
            <article key={plan.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 26, boxShadow: '0 12px 35px rgba(15,23,42,.06)' }}>
              <h2 style={{ fontSize: 23, margin: '0 0 8px' }}>{plan.name}</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.5, minHeight: 48 }}>{plan.description}</p>
              <p style={{ fontSize: 34, fontWeight: 800, margin: '22px 0 4px' }}>{plan.price}</p>
              <p style={{ color: '#6b7280', marginTop: 0 }}>{plan.duration}</p>
              <ul style={{ paddingLeft: 20, lineHeight: 1.9, minHeight: 150 }}>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <button type="button" onClick={() => void checkout(plan.id)} disabled={Boolean(busyPlan) || paymentConfigured === false} style={{ width: '100%', border: 0, borderRadius: 12, padding: '14px 16px', background: busyPlan === plan.id ? '#6366f1' : '#312e81', color: '#fff', fontWeight: 700, cursor: busyPlan || paymentConfigured === false ? 'not-allowed' : 'pointer', opacity: paymentConfigured === false ? .55 : 1 }}>
                {busyPlan === plan.id ? 'Opening secure checkout…' : paymentConfigured === false ? 'Checkout not configured' : 'Pay securely with Khalti'}
              </button>
            </article>
          ))}
        </section>
        <p style={{ textAlign: 'center', color: '#6b7280', lineHeight: 1.6, maxWidth: 760, margin: '26px auto 0' }}>Payments are verified server-to-server before paid access is activated. Keep your account credentials private. If you paid but the status is pending, do not pay again immediately; contact IIA support and include your payment reference.</p>
        <footer style={{ marginTop: 48, borderTop: '1px solid #e5e7eb', paddingTop: 22, textAlign: 'center', color: '#6b7280' }}>Integrated Intelligence Agent · Study with human judgment and verify important answers.</footer>
      </div>
    </main>
  );
}
