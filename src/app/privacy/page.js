export const metadata = {
  title: "Privacy Policy - ActionChat",
  description: "How ActionChat collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>

      <div className="prose prose-neutral dark:prose-invert mt-8">
        <p>
          This Privacy Policy explains how ActionChat (&quot;ActionChat&quot;, &quot;we&quot;, &quot;us&quot;)
          collects, uses, and protects information when you use our website and
          services for natural-language API operations
          (collectively, the &quot;Services&quot;). By using the Services, you agree to the
          practices described here.
        </p>

        <h2 id="what-we-collect">1. Information we collect</h2>
        <p>We collect the following categories of information:</p>
        <ul>
          <li>
            <strong>Account information</strong>: Email address and (optionally) name or
            profile details you choose to provide.
          </li>
          <li>
            <strong>Content</strong>: Chat messages, API configurations, agent settings,
            and other content you create or provide through the Services.
          </li>
          <li>
            <strong>Integrations</strong>: If you connect third‑party services (e.g., APIs via
            OpenAPI specs), we receive only the data needed to provide the integration you authorize.
          </li>
          <li>
            <strong>Usage and device data</strong>: Interactions with the app, timestamps,
            IP address, device/browser type, and basic diagnostic information to
            keep the Service reliable and secure.
          </li>
          <li>
            <strong>Cookies and similar technologies</strong>: Used for essential
            functionality, analytics, and support. See “Cookies” below.
          </li>
        </ul>

        <h2 id="how-we-use">2. How we use information</h2>
        <ul>
          <li>Provide and operate the Services you request (natural-language API operations, agent management, chat).</li>
          <li>Execute API calls on your behalf through configured agents and OpenAPI integrations.</li>
          <li>Maintain audit logs of actions taken through the platform.</li>
          <li>Maintain security, prevent abuse, and debug/monitor reliability.</li>
          <li>Improve product quality and accuracy using aggregated or de‑identified data.</li>
          <li>Communicate important updates and respond to support inquiries.</li>
        </ul>

        <h2 id="cookies">3. Cookies</h2>
        <p>
          We use cookies and similar technologies for essential functionality and
          analytics (for example, Vercel Analytics) and to provide customer support
          (for example, Crisp chat). You can control cookies in your browser
          settings; blocking some cookies may impact functionality.
        </p>

        <h2 id="sharing">4. How we share information</h2>
        <ul>
          <li>
            <strong>No selling of personal data</strong>.
          </li>
          <li>
            <strong>Service providers</strong>: We use trusted vendors to run our
            infrastructure and product (for example, Supabase for auth, database,
            and storage; Vercel for hosting; Stripe for payments; analytics/support
            tools). They are bound by contracts to protect your data and use it
            only to provide services to us.
          </li>
          <li>
            <strong>Legal</strong>: We may disclose information if required by law or to
            protect rights, safety, and the integrity of the Services.
          </li>
          <li>
            <strong>Business transfers</strong>: If we undergo a merger, acquisition, or
            asset sale, your information may be transferred as part of that
            transaction.
          </li>
        </ul>

        <h2 id="retention">5. Storage and retention</h2>
        <p>
          Your account information, content, and preferences are stored in our
          infrastructure (for example, Supabase storage and databases) and retained
          while your account is active or as needed to operate the Services. All data
          is stored securely and encrypted both in transit and at rest. You
          can request deletion at any time, and we will delete or de‑identify data
          unless we need to retain it to comply with law, resolve disputes, or
          enforce agreements.
        </p>

        <h2 id="rights">6. Your privacy rights</h2>
        <p>
          Depending on your location, you may have rights to access, correct,
          export, object to, restrict, or delete your personal information. You can
          also withdraw consent where we rely on consent. To exercise rights,
          contact us at <a href="mailto:privacy@actionchat.io">privacy@actionchat.io</a> or 
          use our <a href="/data-deletion">data deletion request form</a>.
        </p>

        <h2 id="security">7. Security</h2>
        <p>
          We use industry‑standard measures to protect data in transit and at rest.
          No method of transmission or storage is 100% secure, but we work to keep
          your information safe and review protections regularly.
        </p>

        <h2 id="children">8. Children</h2>
        <p>
          Our Services are not directed to children under 13, and we do not
          knowingly collect personal information from children. If you believe a
          child has provided information, contact us to delete it.
        </p>

        <h2 id="international">9. International data transfers</h2>
        <p>
          We may process and store information in the United States and other
          countries where we or our service providers operate. When we transfer
          personal information internationally, we use appropriate safeguards as
          required by applicable law.
        </p>

        <h2 id="changes">10. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. We will post the updated
          version on this page and update the "Last updated" date above. If
          changes materially affect your rights, we will provide additional notice
          where required by law.
        </p>

        <h2 id="contact">11. Contact</h2>
        <p>
          Questions or requests? Email <a href="mailto:privacy@actionchat.io">privacy@actionchat.io</a>.
        </p>
      </div>
    </main>
  );
}


