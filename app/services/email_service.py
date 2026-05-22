"""
Email service - SMTP email receipt system with premium HTML templates
"""
import smtplib
import ssl
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import Config


def _build_receipt_html(transaction_id, timestamp, items, total_amount, payment_method="UPI", analytics=None):
    """Build a premium HTML email receipt."""

    # Build cart items rows
    items_rows = ""
    for item in items:
        items_rows += f"""
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #374151;">{item['name']}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #6b7280; text-align: center;">{item['qty']}</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #374151; text-align: right; font-weight: 600;">₹{item['price']:.2f}</td>
        </tr>"""

    html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

    <!-- Wrapper -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto;">

                    <!-- Logo Header -->
                    <tr>
                        <td align="center" style="padding: 24px 0 20px;">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="background: linear-gradient(135deg, #06b6d4, #10b981); width: 48px; height: 48px; border-radius: 14px; text-align: center; vertical-align: middle;">
                                        <span style="font-size: 22px; color: #ffffff;">⚡</span>
                                    </td>
                                    <td style="padding-left: 12px;">
                                        <span style="font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.5px;">Retail</span><span style="font-size: 22px; font-weight: 800; color: #06b6d4; letter-spacing: -0.5px;">Scan</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Main Card -->
                    <tr>
                        <td>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">

                                <!-- Success Banner -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #16a34a, #22c55e); padding: 32px 24px; text-align: center;">
                                        <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; line-height: 56px;">
                                            <span style="font-size: 28px;">✅</span>
                                        </div>
                                        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">Payment Successful</h1>
                                        <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.85);">Your transaction has been completed</p>
                                    </td>
                                </tr>

                                <!-- Amount Highlight -->
                                <tr>
                                    <td style="padding: 28px 24px 20px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                                        <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600;">Amount Paid</p>
                                        <p style="margin: 0; font-size: 36px; font-weight: 800; color: #16a34a; letter-spacing: -1px;">₹{total_amount:.2f}</p>
                                    </td>
                                </tr>

                                <!-- Transaction Details -->
                                <tr>
                                    <td style="padding: 20px 24px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding: 10px 0; border-bottom: 1px solid #f9fafb;">
                                                    <span style="font-size: 13px; color: #9ca3af;">Transaction ID</span><br>
                                                    <span style="font-size: 14px; font-weight: 600; color: #111827; font-family: 'Courier New', monospace; letter-spacing: 0.5px;">{transaction_id}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 10px 0; border-bottom: 1px solid #f9fafb;">
                                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                                        <tr>
                                                            <td>
                                                                <span style="font-size: 13px; color: #9ca3af;">Date & Time</span><br>
                                                                <span style="font-size: 14px; font-weight: 500; color: #374151;">{timestamp}</span>
                                                            </td>
                                                            <td style="text-align: right;">
                                                                <span style="font-size: 13px; color: #9ca3af;">Payment Method</span><br>
                                                                <span style="font-size: 14px; font-weight: 600; color: #374151;">💳 {payment_method}</span>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 10px 0;">
                                                    <span style="font-size: 13px; color: #9ca3af;">UPI ID</span><br>
                                                    <span style="font-size: 14px; font-weight: 500; color: #374151;">smartcart@upi</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Items Header -->
                                <tr>
                                    <td style="padding: 0 24px;">
                                        <div style="background-color: #f9fafb; border-radius: 10px; overflow: hidden; border: 1px solid #f0f0f0;">
                                            <div style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
                                                <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280;">🛒 Order Summary</span>
                                            </div>

                                            <!-- Items Table -->
                                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                                <tr style="background-color: #f3f4f6;">
                                                    <td style="padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af;">Product</td>
                                                    <td style="padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; text-align: center;">Qty</td>
                                                    <td style="padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; text-align: right;">Price</td>
                                                </tr>
                                                {items_rows}
                                            </table>

                                            <!-- Total -->
                                            <div style="padding: 16px; background-color: #f0fdf4; border-top: 2px solid #16a34a;">
                                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td style="font-size: 15px; font-weight: 700; color: #111827;">Total Paid</td>
                                                        <td style="text-align: right; font-size: 18px; font-weight: 800; color: #16a34a;">₹{total_amount:.2f}</td>
                                                    </tr>
                                                </table>
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                <!-- Thank You -->
                                <tr>
                                    <td style="padding: 20px 24px 8px; text-align: center;">
                                        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #111827;">Thank you for shopping with RetailScan! 🎉</p>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>

                    {{analytics_sections}}

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 16px; text-align: center;">
                            <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">This is an automated receipt from RetailScan</p>
                            <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">Need help? Contact us at <a href="mailto:support@retailscan.app" style="color: #06b6d4; text-decoration: none;">support@retailscan.app</a></p>
                            <p style="margin: 12px 0 0; font-size: 11px; color: #d1d5db;">© 2026 RetailScan. All rights reserved.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>"""
    # Replace analytics placeholder with computed sections
    analytics_html = _build_analytics_sections(analytics) if analytics else ""
    html = html.replace("{analytics_sections}", analytics_html)
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
    Send an analytics-enhanced HTML payment receipt email.
    Runs in a background thread to not block the response.
    """
    def _send():
        try:
            if not Config.EMAIL_USER or not Config.EMAIL_PASS:
                print("[EMAIL] Skipped — EMAIL_USER or EMAIL_PASS not configured (set env vars in Render Dashboard)")
                return
            print(f"[EMAIL] Starting send to {user_email}...")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"✅ Payment Receipt — ₹{total_amount:.2f} | RetailScan"
            msg["From"] = f"RetailScan <{Config.EMAIL_USER}>"
            msg["To"] = user_email

            plain = (
                f"Payment Successful!\n\nTransaction ID: {transaction_id}\n"
                f"Amount: ₹{total_amount:.2f}\nDate: {timestamp}\n\n"
                f"Thank you for shopping with RetailScan!"
            )
            msg.attach(MIMEText(plain, "plain"))

            html = _build_receipt_html(transaction_id, timestamp, items, total_amount,
                                       analytics=analytics)
            msg.attach(MIMEText(html, "html"))

            print(f"[EMAIL] Connecting to {Config.SMTP_SERVER}:{Config.SMTP_PORT} (STARTTLS)...")
            with smtplib.SMTP(Config.SMTP_SERVER, Config.SMTP_PORT, timeout=30) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                print(f"[EMAIL] Logging in as {Config.EMAIL_USER}...")
                server.login(Config.EMAIL_USER, Config.EMAIL_PASS)
                print(f"[EMAIL] Sending to {user_email}...")
                server.sendmail(Config.EMAIL_USER, user_email, msg.as_string())
                server.sendmail(Config.EMAIL_USER, user_email, msg.as_string())

            print(f"[EMAIL] Receipt sent to {user_email} for {transaction_id}")
        except Exception as e:
            print(f"[EMAIL] Failed to send to {user_email}: {e}")

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()
