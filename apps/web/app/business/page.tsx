'use client';

import Link from 'next/link';
import styles from './page.module.css';

const packages = [
  {
    name: 'Paid pilot',
    price: 'NPR 8,000–12,000',
    billing: 'one-time',
    description: 'Prove one useful workflow before committing to a larger implementation.',
    items: ['One narrow business use case', 'Approved FAQs or a small document set', 'Agreed answer tests and fallback behavior', 'One review round and handover'],
    featured: false,
  },
  {
    name: 'Business assistant',
    price: 'NPR 15,000–25,000',
    billing: 'setup + NPR 3,000–6,000/month',
    description: 'A managed website assistant for a defined set of recurring questions.',
    items: ['Branded website chat experience', 'Approved business knowledge sources', 'Usage limits and basic monitoring', 'Scheduled content update and support'],
    featured: true,
  },
  {
    name: 'Custom workflow',
    price: 'NPR 30,000–75,000+',
    billing: 'scoped quote',
    description: 'A tailored workflow for document handling, lead qualification, or approved integrations.',
    items: ['Discovery and written scope', 'Integration and workflow design', 'Acceptance tests before launch', 'Separately scoped maintenance'],
    featured: false,
  },
];

export default function BusinessAssistantPage() {
  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link className={styles.brand} href="/" aria-label="IIA home">
          <span className={styles.brandMark}>II</span>
          <span>Integrated Intelligence Agent</span>
        </Link>
        <Link className={styles.navLink} href="/">Open IIA <span aria-hidden="true">↗</span></Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>AI that works with your business knowledge</p>
          <h1>Answer repeat questions. Give your team time back.</h1>
          <p className={styles.lede}>
            IIA Business Knowledge Assistant helps customers and staff find answers from your approved FAQs and documents—with a clear fallback when information is missing.
          </p>
          <div className={styles.actions}>
            <a className={styles.primaryButton} href="#packages">Explore pilot packages <span aria-hidden="true">↓</span></a>
            <Link className={styles.secondaryButton} href="/">Try the IIA app</Link>
          </div>
          <p className={styles.note}>Scoped implementations. Human oversight. No promise of perfect AI answers.</p>
        </div>
        <div className={styles.demoCard} aria-label="Illustration of a grounded business assistant conversation">
          <div className={styles.demoTop}>
            <span className={styles.statusDot} />
            <div><strong>Business knowledge assistant</strong><small>Example conversation · sample content</small></div>
          </div>
          <div className={styles.chatBubbleUser}>What documents do I need to enroll?</div>
          <div className={styles.chatBubbleBot}>
            <span className={styles.answerLabel}>IIA ANSWER</span>
            The sample enrollment guide lists an application form, identification, and prior academic records. Please confirm the current requirements with the admissions team.
            <div className={styles.source}>▤ Enrollment guide · sample source</div>
          </div>
          <div className={styles.fallback}>
            <span aria-hidden="true">↗</span>
            If the approved information doesn't cover a question, IIA can direct the visitor to your team.
          </div>
        </div>
      </section>

      <section className={styles.trustStrip} aria-label="Service principles">
        <div><span>01</span><strong>Uses approved information</strong></div>
        <div><span>02</span><strong>Clear fallback to people</strong></div>
        <div><span>03</span><strong>Scope and usage agreed up front</strong></div>
      </section>

      <section className={styles.section} id="how-it-works">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>A practical first use case</p>
          <h2>Start with one problem worth solving.</h2>
          <p>We agree what the assistant should answer, connect only approved source material, and test the result before it is used with real customers.</p>
        </div>
        <div className={styles.steps}>
          <article><span>01</span><h3>Choose the questions</h3><p>Identify repetitive customer or staff questions and the business outcome you want to improve.</p></article>
          <article><span>02</span><h3>Connect approved knowledge</h3><p>Use your FAQs, service descriptions, policies, or other authorized documents.</p></article>
          <article><span>03</span><h3>Test before launch</h3><p>Check representative questions, unsupported questions, privacy boundaries, and human handoff.</p></article>
        </div>
      </section>

      <section className={styles.pricingSection} id="packages">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Transparent starting ranges</p>
          <h2>Choose a sensible first step.</h2>
          <p>These are indicative launch prices. Final quotes depend on scope, data, integrations, usage, and support requirements.</p>
        </div>
        <div className={styles.pricingGrid}>
          {packages.map((pkg) => (
            <article className={pkg.featured ? styles.featuredPackage : styles.package} key={pkg.name}>
              {pkg.featured && <div className={styles.featuredLabel}>ONGOING SUPPORT</div>}
              <h3>{pkg.name}</h3>
              <p className={styles.packageDescription}>{pkg.description}</p>
              <p className={styles.price}>{pkg.price}</p>
              <p className={styles.billing}>{pkg.billing}</p>
              <ul>{pkg.items.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
              <a className={pkg.featured ? styles.primaryButton : styles.secondaryButton} href="#pilot">Discuss scope <span aria-hidden="true">↓</span></a>
            </article>
          ))}
        </div>
        <p className={styles.disclaimer}>Third-party model/API usage, hosting, extra integrations, OCR, and work outside the agreed scope may cost extra. Usage limits and support terms are confirmed in writing.</p>
      </section>

      <section className={styles.pilotSection} id="pilot">
        <div>
          <p className={styles.eyebrow}>Before any paid pilot</p>
          <h2>Agree on the result—not just the technology.</h2>
          <p>Every pilot should have a written scope, approved data sources, sample test questions, a fallback plan, usage limits, and clear acceptance criteria.</p>
        </div>
        <div className={styles.pilotChecklist}>
          <p><span>✓</span> Defined use case and success measure</p>
          <p><span>✓</span> Authorized documents and privacy boundaries</p>
          <p><span>✓</span> Agreed price, usage, timeline, and support</p>
          <p><span>✓</span> Test results reviewed before launch</p>
          <Link className={styles.primaryButton} href="/">Open IIA to explore the current app <span aria-hidden="true">↗</span></Link>
          <p className={styles.note}>This page describes a proposed service offer. Availability depends on technical readiness and an agreed scope; it does not imply that a pilot has been booked.</p>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/"><span className={styles.brandMark}>II</span><span>Integrated Intelligence Agent</span></Link>
        <span>AI assistance with clear scope and human oversight.</span>
      </footer>
    </main>
  );
}
