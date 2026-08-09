import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service | VELA",
};

const UPDATED = "9 August 2026";
const CONTACT_EMAIL = "kennzyoguh@gmail.com";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" updated={UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern access to and use of VELA
        (&quot;VELA&quot;, &quot;we&quot;, &quot;us&quot;), a business operations platform for small
        and medium enterprises. By creating an account or otherwise using VELA, you agree to these
        Terms on behalf of yourself and, if applicable, the business you represent.
      </p>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">1. Your account</h2>
        <p>
          You&apos;re responsible for the accuracy of the information you give us and for keeping
          your login credentials confidential. Staff accounts created under your organisation (for
          example, phone-and-PIN point-of-sale logins) are your responsibility to manage, including
          revoking access when someone leaves. You must notify us promptly of any unauthorised use
          of your account.
        </p>
      </div>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">
          2. What VELA does — and doesn&apos;t do
        </h2>
        <p>
          VELA helps you invoice clients, track compliance obligations, run payroll, monitor cash
          flow, and manage point-of-sale operations. Figures relating to tax (VAT, Withholding Tax,
          Companies Income Tax, PAYE, pension contributions) are calculated from our understanding
          of applicable Nigerian tax law and are provided as an operational aid, not as tax, legal,
          or financial advice. You remain responsible for your own filings and for confirming
          figures with FIRS, a licensed accountant, or another qualified professional before relying
          on them.
        </p>
      </div>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">3. Payments</h2>
        <p>
          Payments you send or receive through VELA — including invoice payments and Quick Sale
          links — are processed by Paystack, a third-party payment processor. Paystack&apos;s own
          terms and fees apply to those transactions. VELA is not a bank and does not hold your
          funds; Paystack settles payments directly to the bank account you connect.
        </p>
      </div>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">4. Acceptable use</h2>
        <p>
          You agree not to use VELA to process fraudulent transactions, launder money, evade tax
          obligations you know to be due, or violate any applicable law. We may suspend or terminate
          accounts we reasonably believe are being used this way.
        </p>
      </div>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">5. Your data</h2>
        <p>
          You own the business, client, and financial data you put into VELA. We access it only to
          operate the service, provide support, or as required by law. See our{" "}
          <a href="/privacy" className="text-data-aiAccent hover:underline">
            Privacy Policy
          </a>{" "}
          for how we collect, use, and protect it.
        </p>
      </div>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">6. Availability</h2>
        <p>
          We work to keep VELA available and accurate, but the service is provided &quot;as is&quot;
          without warranties of uninterrupted or error-free operation. We are not liable for
          indirect or consequential losses arising from use of the service, to the maximum extent
          permitted by law.
        </p>
      </div>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">7. Termination</h2>
        <p>
          You may stop using VELA and close your account at any time. We may suspend or terminate
          accounts that violate these Terms, with notice where practical.
        </p>
      </div>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">8. Changes to these Terms</h2>
        <p>
          We may update these Terms as VELA evolves. Material changes will be communicated by email
          or an in-app notice before they take effect.
        </p>
      </div>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">9. Governing law</h2>
        <p>These Terms are governed by the laws of the Federal Republic of Nigeria.</p>
      </div>

      <div>
        <h2 className="font-ui text-[1.05rem] font-bold">10. Contact</h2>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-data-aiAccent hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </LegalPageLayout>
  );
}
