// Shared HTML shell for every templated email in this codebase (first real
// caller: nurture-day0/3/7.ts). Table-based layout with inline styles only —
// email clients strip <style> blocks and ignore CSS custom properties, so
// the Midnight/Gold brand colors (packages/design-tokens/src/colors.json)
// are hardcoded here rather than referencing the app's design tokens.
const MIDNIGHT = "#0D1B2A";
const GOLD = "#C9A84C";
const NEUTRAL_50 = "#F7F9FC";
const NEUTRAL_600 = "#3A4C61";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function renderEmailLayout(params: { preheader: string; bodyHtml: string }): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:${NEUTRAL_50};font-family:Arial,Helvetica,sans-serif;">
    <span style="display:none;font-size:1px;color:${NEUTRAL_50};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${params.preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${NEUTRAL_50};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:${MIDNIGHT};padding:20px 32px;">
                <span style="color:${GOLD};font-size:18px;font-weight:bold;letter-spacing:0.02em;">VELA</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:${NEUTRAL_600};font-size:15px;line-height:1.6;">
                ${params.bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
