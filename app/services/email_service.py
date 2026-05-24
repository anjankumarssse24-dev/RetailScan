"""
Email service - Brevo HTTPS API email receipt system with premium colourful template
"""
import threading
import requests
from app.config import Config


def _build_receipt_html(transaction_id, timestamp, items, total_amount,
                        payment_method="UPI", analytics=None):
    """Build a premium colourful HTML email receipt."""

    # ── item rows ─────────────────────────────────────────────────────────────
    rows = ""
    for item in items:
        name  = item.get("name", "Item")
        qty   = item.get("qty", 1)
        price = float(item.get("price", 0))
        rows += (
            "<tr>"
            f'<td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;">{name}</td>'
            f'<td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#6b7280;text-align:center;">{qty}</td>'
            f'<td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#111827;text-align:right;font-weight:700;">&#8377;{price:.2f}</td>'
            "</tr>"
        )

    # ── static shell (no f-string — curly braces are literal HTML) ────────────
    SHELL = """<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Payment Receipt | RetailScan</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;">

<!-- brand header -->
<tr><td align="center" style="padding:28px 0 20px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);width:52px;height:52px;border-radius:16px;text-align:center;vertical-align:middle;">
      <span style="font-size:26px;line-height:52px;">&#9889;</span></td>
    <td style="padding-left:14px;vertical-align:middle;">
      <span style="font-size:26px;font-weight:800;color:#1e1b4b;">Retail</span><span style="font-size:26px;font-weight:800;color:#6366f1;">Scan</span>
      <div style="font-size:11px;color:#6366f1;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Smart Checkout</div>
    </td>
  </tr></table>
</td></tr>

<!-- main card -->
<tr><td style="background:#ffffff;border-radius:20px;box-shadow:0 8px 40px rgba(99,102,241,.15);overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">

<!-- success banner -->
<tr><td style="background:linear-gradient(135deg,#10b981,#059669);padding:36px 28px;text-align:center;">
  <div style="width:64px;height:64px;background:rgba(255,255,255,.2);border-radius:50%;margin:0 auto 16px;line-height:64px;font-size:30px;">&#9989;</div>
  <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">Payment Successful!</h1>
  <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.88);">Your transaction has been completed securely</p>
</td></tr>

<!-- AMOUNT_SLOT -->
<!-- TXN_SLOT -->
<!-- ITEMS_SLOT -->
<!-- ANALYTICS_SLOT -->

<!-- thank you -->
<tr><td style="padding:28px 28px 32px;text-align:center;">
  <div style="background:linear-gradient(135deg,#eef2ff,#f5f3ff);border-radius:14px;padding:20px;border:1px solid #c7d2fe;">
    <p style="margin:0 0 6px;font-size:17px;font-weight:800;color:#1e1b4b;">Thank you for shopping with RetailScan! &#127881;</p>
    <p style="margin:0;font-size:14px;color:#6b7280;">We hope to see you again soon &#128522;</p>
  </div>
</td></tr>

</table></td></tr>

<!-- footer -->
<tr><td style="padding:24px 16px;text-align:center;">
  <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Automated receipt from <strong>RetailScan</strong></p>
  <!-- FOOTER_EMAIL_SLOT -->
  <p style="margin:12px 0 0;font-size:11px;color:#d1d5db;">&#169; 2026 RetailScan. All rights reserved.</p>
</td></tr>

</table></td></tr></table>
</body></html>"""

    # ── dynamic slots ──────────────────────────────────────────────────────────
    amount_slot = (
        '<tr><td style="padding:32px 28px 24px;text-align:center;border-bottom:2px solid #f3f4f6;">'
        '<p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:700;">Total Amount Paid</p>'
        f'<p style="margin:0;font-size:42px;font-weight:900;color:#059669;letter-spacing:-2px;">&#8377;{total_amount:.2f}</p>'
        '</td></tr>'
    )

    txn_slot = (
        '<tr><td style="padding:20px 28px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        '<tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">'
        '<span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px;">Transaction ID</span><br>'
        f'<span style="font-size:14px;font-weight:700;color:#1e1b4b;font-family:Courier New,monospace;">{transaction_id}</span>'
        '</td></tr>'
        '<tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td>'
        '<span style="font-size:12px;color:#9ca3af;text-transform:uppercase;">Date &amp; Time</span><br>'
        f'<span style="font-size:14px;font-weight:600;color:#374151;">{timestamp}</span>'
        '</td>'
        '<td style="text-align:right;">'
        '<span style="font-size:12px;color:#9ca3af;text-transform:uppercase;">Payment Via</span><br>'
        f'<span style="font-size:14px;font-weight:700;color:#6366f1;">&#128179; {payment_method}</span>'
        '</td>'
        '</tr></table></td></tr>'
        '<tr><td style="padding:10px 0;">'
        '<span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px;">Merchant UPI</span><br>'
        '<span style="font-size:14px;font-weight:600;color:#374151;">retailscan@okaxis</span>'
        '</td></tr>'
        '</table></td></tr>'
    )

    items_slot = (
        '<tr><td style="padding:0 28px 8px;">'
        '<div style="background:#f9fafb;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">'
        '<div style="padding:14px 18px;background:linear-gradient(135deg,#6366f1,#8b5cf6);">'
        '<span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ffffff;">&#128722; Order Summary</span>'
        '</div>'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        '<tr style="background:#f3f4f6;">'
        '<td style="padding:10px 18px;font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;">Product</td>'
        '<td style="padding:10px 18px;font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;text-align:center;">Qty</td>'
        '<td style="padding:10px 18px;font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;text-align:right;">Price</td>'
        '</tr>'
        f'{rows}'
        '</table>'
        '<div style="padding:16px 18px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-top:2px solid #10b981;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td style="font-size:16px;font-weight:800;color:#111827;">Total Paid</td>'
        f'<td style="text-align:right;font-size:20px;font-weight:900;color:#059669;">&#8377;{total_amount:.2f}</td>'
        '</tr></table></div></div></td></tr>'
    )

    from app.config import Config as _Cfg
    footer_email_slot = (
        f'<p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">'
        f'Questions? <a href="mailto:{_Cfg.EMAIL_FROM}" style="color:#6366f1;text-decoration:none;">{_Cfg.EMAIL_FROM}</a></p>'
    )

    analytics_html = _build_analytics_sections(analytics) if analytics else ""

    html = (SHELL
            .replace("<!-- AMOUNT_SLOT -->",       amount_slot)
            .replace("<!-- TXN_SLOT -->",          txn_slot)
            .replace("<!-- ITEMS_SLOT -->",        items_slot)
            .replace("<!-- ANALYTICS_SLOT -->",    analytics_html)
            .replace("<!-- FOOTER_EMAIL_SLOT -->", footer_email_slot))
    return html


def _build_analytics_sections(analytics: dict) -> str:
    """Build HTML sections for savings, points, loyalty, insights, recommendations."""
    if not analytics:
        return ""

    parts    = []
    savings  = analytics.get("savings",  {})
    loyalty  = analytics.get("loyalty",  {})
    insights = analytics.get("insights", [])
    next_time = analytics.get("next_time", [])
    pts      = int(analytics.get("points_earned", 0))

    # Savings section
    if savings.get("has_savings"):
        total_disc  = savings.get("total_discount", 0)
        savings_pct = savings.get("savings_pct", 0)
        breakdown   = savings.get("breakdown", [])
        rows_html   = "".join(
            f'<tr><td style="padding:5px 0;font-size:13px;color:#6b7280;">{b["type"]}</td>'
            f'<td style="padding:5px 0;font-size:13px;font-weight:600;color:#16a34a;text-align:right;">-&#x20B9;{b["amount"]:.2f}</td></tr>'
            for b in breakdown
        )
        parts.append(f"""
                    <tr>
                        <td style="padding: 4px 24px 16px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                   style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;border:1px solid #86efac;">
                                <tr><td style="padding:14px 16px 8px;">
                                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;">&#127881; You Saved Today</p>
                                    <p style="margin:0;font-size:24px;font-weight:800;color:#15803d;">&#x20B9;{total_disc:.2f}
                                       <span style="font-size:13px;font-weight:500;color:#16a34a;">({savings_pct:.1f}% off)</span></p>
                                </td></tr>
                                {f'<tr><td style="padding:0 16px 12px;"><table role="presentation" width="100%">{rows_html}</table></td></tr>' if rows_html else ""}
                            </table>
                        </td>
                    </tr>""")

    # Points section
    if pts > 0:
        parts.append(f"""
                    <tr>
                        <td style="padding: 0 24px 16px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                   style="background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:12px;border:1px solid #c4b5fd;">
                                <tr><td style="padding:14px 16px;">
                                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;">&#11088; Reward Points Earned</p>
                                    <p style="margin:0;font-size:22px;font-weight:800;color:#6d28d9;">+{pts} points
                                       <span style="font-size:13px;font-weight:500;color:#7c3aed;">added to your wallet</span></p>
                                </td></tr>
                            </table>
                        </td>
                    </tr>""")

    # Loyalty progress
    if loyalty.get("tier") and loyalty.get("next_tier"):
        pct   = loyalty.get("progress_pct", 0)
        color = loyalty.get("color", "#f59e0b")
        parts.append(f"""
                    <tr>
                        <td style="padding: 0 24px 16px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                   style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;">
                                <tr><td style="padding:14px 16px;">
                                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#d97706;">
                                        &#128081; {loyalty["tier"].title()} Membership &bull; {loyalty["points"]} pts</p>
                                    <div style="height:8px;background:#fef3c7;border-radius:6px;overflow:hidden;margin-bottom:6px;">
                                        <div style="width:{pct}%;height:100%;background:{color};border-radius:6px;"></div>
                                    </div>
                                    <p style="margin:0;font-size:12px;color:#92400e;">{loyalty.get("message","")}</p>
                                </td></tr>
                            </table>
                        </td>
                    </tr>""")

    # Smart insights
    if insights:
        rows_html = "".join(
            f'<tr><td style="padding:6px 0;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">{ins}</td></tr>'
            for ins in insights[:3]
        )
        parts.append(f"""
                    <tr>
                        <td style="padding: 0 24px 16px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                   style="background:#f8faff;border-radius:12px;border:1px solid #e0e7ff;">
                                <tr><td style="padding:14px 16px 8px;">
                                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4f46e5;">&#128161; Shopping Insights</p>
                                    <table role="presentation" width="100%">{rows_html}</table>
                                </td></tr>
                            </table>
                        </td>
                    </tr>""")

    # Next time recs
    if next_time:
        chips = " &bull; ".join(f'<strong>{r["name"]}</strong>' for r in next_time[:4])
        parts.append(f"""
                    <tr>
                        <td style="padding:0 24px 12px;text-align:center;">
                            <p style="margin:0;font-size:12px;color:#9ca3af;font-weight:500;">
                                &#128722; Next time you might like: {chips}</p>
                        </td>
                    </tr>""")

    return "\n".join(parts)


def send_payment_email(user_email, transaction_id, timestamp, items, total_amount,
                       analytics=None):
    """
    Send an analytics-enhanced HTML payment receipt email via Brevo API (HTTPS).
    Runs in a background thread to not block the response.
    """
    def _send():
        try:
            if not Config.BREVO_API_KEY:
                print("[EMAIL] Skipped — BREVO_API_KEY not configured")
                return
            print(f"[EMAIL] Sending via Brevo to {user_email}...")
            plain = (
                f"Payment Successful!\n\nTransaction ID: {transaction_id}\n"
                f"Amount: Rs.{total_amount:.2f}\nDate: {timestamp}\n\n"
                f"Thank you for shopping with RetailScan!"
            )
            html = _build_receipt_html(transaction_id, timestamp, items, total_amount,
                                       analytics=analytics)
            resp = requests.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": Config.BREVO_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "sender": {"name": "RetailScan", "email": Config.EMAIL_FROM},
                    "to": [{"email": user_email}],
                    "subject": f"Payment Receipt — Rs.{total_amount:.2f} | RetailScan",
                    "htmlContent": html,
                    "textContent": plain,
                },
                timeout=30,
            )
            if resp.status_code in (200, 201):
                print(f"[EMAIL] Receipt sent to {user_email} via Brevo")
            else:
                print(f"[EMAIL] Brevo error {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"[EMAIL] Failed: {e}")

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()
