"""
Gemini service - Product recognition using google-generativeai SDK
Uses gemini-2.0-flash model with retry on 429 rate-limit.
"""
import io
import json
import re
import time
import logging
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)

import google.generativeai as genai
from PIL import Image

from app.config import Config

logger = logging.getLogger(__name__)

# All 4 API keys in priority order — exhausted keys are skipped automatically
GEMINI_API_KEYS = [k for k in [
    Config.GEMINI_API_KEY_1,
    Config.GEMINI_API_KEY_2,
    Config.GEMINI_API_KEY_3,
    Config.GEMINI_API_KEY_4,
] if k]

# Retail product detection prompt
RETAIL_PROMPT = """
🛒 RETAIL PRODUCT SCANNER - INDIA

⚠️ CRITICAL INSTRUCTION: DETECT ONLY PHYSICAL PRODUCTS FOR SALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR ONLY JOB: Find retail products (items with price tags that can be purchased)

🚫 NEVER DETECT:
   • Humans, faces, hands, arms, body parts
   • Backgrounds (walls, floors, tables, desks)
   • Room furniture or decorations
   • Computer screens, keyboards, monitors
   • People holding items (detect ONLY the item, NEVER the person)

✅ ONLY DETECT SELLABLE RETAIL PRODUCTS:
   • Beverages: bottles, cans, drinks
   • Food: snacks, chips, biscuits, chocolates
   • Electronics: phones, earphones, chargers, power banks
   • Stationery: pens, notebooks, books
   • Personal care: soap, shampoo, cosmetics
   • Any packaged item being scanned for purchase

🎯 DETECTION RULES:
1. Product must be CLEARLY VISIBLE and IN FOCUS
2. Product must be a SELLABLE ITEM (not environment/background)
3. If person is holding product → detect ONLY product (ignore person completely)
4. If no clear product → return EMPTY array
5. NEVER include people, hands, or background items in detection

🏷️ KNOWN PRODUCTS - FIXED PRICES (ALWAYS use these exact prices if you recognize these items):
┌─────────────────────────────────────────┬────────────┬─────────────────┐
│ Product                                 │ Price (₹)  │ Category        │
├─────────────────────────────────────────┼────────────┼─────────────────┤
│ Nanobot Steel Bottle                    │ ₹329.00    │ Other           │
│ Good Day (biscuits)                     │ ₹10.00     │ Food            │
│ Bingo Mad Angles (chips/snack)          │ ₹5.00      │ Food            │
│ Chocolate Peanut Barfi                  │ ₹10.00     │ Food            │
│ Slice (mango drink / juice)             │ ₹20.00     │ Beverage        │
└─────────────────────────────────────────┴────────────┴─────────────────┘
⚠️ If the image matches any product above → use EXACTLY that price, do NOT guess a different price.

💰 PRICING FOR OTHER PRODUCTS (Indian Rupees - ₹):
• Beverages (500ml): ₹20-60
• Snacks/Chips: ₹10-50
• Electronics accessories: ₹200-2000
• Stationery: ₹5-200
• Personal care: ₹30-500
• Books/Magazines: ₹50-300

📤 OUTPUT FORMAT (JSON ONLY, NO MARKDOWN):
{
  "items": [
    {
      "name": "Product Name (e.g., Coca Cola 500ml)",
      "category": "Beverage|Food|Electronics|Stationery|Personal Care|Other",
      "quantity": 1,
      "unit_price": 45.00,
      "confidence": 0.92
    }
  ],
  "scene": "1 beverage detected",
  "description": "Coca Cola 500ml PET bottle",
  "total_items": 1,
  "subtotal": 45.00,
  "currency": "INR"
}

⚠️ IF NO PRODUCTS VISIBLE (only humans/background):
{
  "items": [],
  "scene": "No products detected",
  "description": "No retail items visible",
  "total_items": 0,
  "subtotal": 0.00,
  "currency": "INR"
}

REMEMBER:
- ONLY detect physical retail products
- IGNORE all humans, backgrounds, environments
- Return prices in INDIAN RUPEES (₹)
- For known products listed above → ALWAYS use the fixed price exactly
- For unknown products → use the general pricing ranges above
- If unsure → return empty items array
"""


def _parse_retry_delay(error_str):
    """Extract retry delay seconds from a 429 error message."""
    match = re.search(r'retry[_\s]delay[^0-9]*(\d+)', error_str, re.IGNORECASE)
    if match:
        return int(match.group(1)) + 2
    match = re.search(r'retry in (\d+)', error_str, re.IGNORECASE)
    if match:
        return int(match.group(1)) + 2
    return 35  # default fallback wait


def _load_and_resize(image_path):
    """Load image and resize if too large."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    max_dim = Config.GEMINI_MAX_IMG_DIM
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img


def _parse_response(raw_text):
    """Parse Gemini response text into structured dict."""
    cleaned = re.sub(r"```(?:json)?", "", raw_text, flags=re.IGNORECASE).strip().strip("`")
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        return _error_response("Could not parse Gemini response as JSON")

    data = json.loads(match.group())
    data.setdefault("items", [])
    data.setdefault("description", "")
    data.setdefault("scene", "")
    data.setdefault("total_items", len(data["items"]))
    data.setdefault("currency", "INR")

    subtotal = sum(
        float(i.get("unit_price", 0)) * int(i.get("quantity", 1))
        for i in data["items"]
    )
    data["subtotal"] = round(subtotal, 2)
    data["error"] = None
    return data


def _error_response(msg):
    """Return a standard error response dict."""
    return {
        "items": [],
        "scene": "Error",
        "description": msg,
        "total_items": 0,
        "subtotal": 0.0,
        "currency": "INR",
        "error": msg,
    }


def call_gemini_api(image_path):
    """
    Analyze image using google-generativeai SDK.
    Iterates over all API keys; within each key tries all models.
    On 429/RESOURCE_EXHAUSTED switches to the next API key.
    Returns structured dict with items, subtotal, etc.
    """
    try:
        pil_img = _load_and_resize(image_path)
    except Exception as e:
        print(f"[ERROR] Image load error: {e}")
        return _error_response(f"Image load error: {e}")

    # Small delay to avoid rate-limit bursts
    print("🔥 GEMINI API CALLED")
    time.sleep(3)

    last_error = ""

    for key_index, api_key in enumerate(GEMINI_API_KEYS):
        key_label = f"key-{key_index + 1}"
        print(f"[INFO] Using {key_label} API key")
        genai.configure(api_key=api_key)
        key_exhausted = False

        for model_name in Config.GEMINI_MODELS:
            if key_exhausted:
                break
            model = genai.GenerativeModel(model_name)

            for attempt in range(1, Config.GEMINI_MAX_RETRY + 1):
                try:
                    print(f"[INFO] Trying {model_name} (attempt {attempt}/{Config.GEMINI_MAX_RETRY}, key={key_label})")
                    response = model.generate_content([RETAIL_PROMPT, pil_img])
                    raw = response.text.strip()
                    print(f"[INFO] {model_name} responded ({len(raw)} chars)")

                    result = _parse_response(raw)
                    if result.get("error") is None:
                        items = result.get("items", [])
                        print(f"[INFO] Detected {len(items)} item(s), subtotal: ₹{result['subtotal']}")
                        for item in items:
                            print(f"  → {item.get('name')} | {item.get('category')} | ₹{item.get('unit_price')}")
                    return result

                except Exception as exc:
                    last_error = str(exc)
                    if "429" in last_error or "RESOURCE_EXHAUSTED" in last_error:
                        if attempt < Config.GEMINI_MAX_RETRY:
                            wait = min(_parse_retry_delay(last_error), 15)
                            print(f"[WARN] {model_name} rate-limited — waiting {wait}s before retry")
                            time.sleep(wait)
                            continue
                        else:
                            print(f"[WARN] {key_label} key quota exhausted. Switching to next key...")
                            key_exhausted = True
                            break
                    else:
                        print(f"[ERROR] {model_name} failed: {exc}")
                        break  # non-429 error, try next model

    print("[ERROR] All API keys and models exhausted.")
    return _error_response(f"All API keys exhausted. Last error: {last_error[:200]}")
