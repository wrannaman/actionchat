export const metadata = {
  title: "Terms of Service - ActionChat",
  description: "Terms and conditions for using ActionChat services.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>

      <div className="prose prose-neutral dark:prose-invert mt-8">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of ActionChat&apos;s
          website, applications, and services (collectively, the &quot;Services&quot;). By accessing
          or using our Services, you agree to be bound by these Terms.
        </p>

        <h2 id="acceptance">1. Acceptance of Terms</h2>
        <p>
          By creating an account, accessing, or using our Services, you acknowledge that 
          you have read, understood, and agree to be bound by these Terms and our Privacy 
          Policy.
        </p>

        <h2 id="eligibility">2. Eligibility</h2>
        <p>
          You must be at least 13 years old to use our Services. By using our Services, 
          you represent and warrant that you meet these eligibility requirements.
        </p>

        <h2 id="account">3. Your Account</h2>
        <p>
          To use certain features of our Services, you must create an account. You agree to:
        </p>
        <ul>
          <li>Provide accurate, current, and complete information</li>
          <li>Maintain and promptly update your account information</li>
          <li>Keep your password secure and confidential</li>
          <li>Accept responsibility for all activities under your account</li>
        </ul>

        <h2 id="use-license">4. License to Use Services</h2>
        <p>
          Subject to your compliance with these Terms, we grant you a limited, non-exclusive, 
          non-transferable, revocable license to access and use our Services for your personal 
          or internal business purposes.
        </p>

        <h2 id="restrictions">5. Restrictions</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Services for any illegal purpose or in violation of any laws</li>
          <li>Upload content that infringes any third party's rights</li>
          <li>Transmit viruses, malware, or other harmful code</li>
          <li>Attempt to gain unauthorized access to our systems</li>
          <li>Use the Services to harass, abuse, or harm others</li>
        </ul>

        <h2 id="content">6. Your Content</h2>
        <p>
          You retain ownership of content you upload to the Services ("Your Content"). By 
          uploading Your Content, you grant us a worldwide, non-exclusive, royalty-free 
          license to use, store, process, reproduce, and display Your Content solely to 
          provide the Services to you.
        </p>

        <h2 id="payment">7. Payment and Billing</h2>
        <p>
          Some features of our Services require payment. By subscribing to a paid plan, you 
          authorize us to charge your payment method on a recurring basis. All fees are 
          non-refundable unless otherwise stated.
        </p>

        <h2 id="termination">8. Termination</h2>
        <p>
          We may suspend or terminate your access to the Services at any time for any reason, 
          including violation of these Terms.
        </p>

        <h2 id="changes">9. Changes to Terms</h2>
        <p>
          We may update these Terms from time to time. We will notify you of material changes 
          by posting the new Terms and updating the "Last updated" date.
        </p>

        <h2 id="contact">10. Contact Information</h2>
        <p>
          If you have questions about these Terms, please contact us at{" "}
          <a href="mailto:legal@actionchat.io">legal@actionchat.io</a>.
        </p>
      </div>
    </main>
  );
}

