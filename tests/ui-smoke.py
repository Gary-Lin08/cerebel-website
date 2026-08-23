import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

LEAD = {
    "id": "lead-test-1",
    "name": "Test Lead",
    "email": "lead@example.com",
    "organization": "Example Robotics",
    "interest": "Robotics and embodied AI",
    "message": "We want to evaluate the wearable platform for demonstration collection.",
    "status": "new",
    "notes": "",
    "owner": "",
    "sourcePage": "/?utm_source=linkedin",
    "referrer": "https://linkedin.com/",
    "utmSource": "linkedin",
    "utmMedium": "social",
    "utmCampaign": "robotics",
    "sessionId": "session-test",
    "country": "CN",
    "region": "Shanghai",
    "city": "Shanghai",
    "timezone": "Asia/Shanghai",
    "ipAddress": "203.0.113.42",
    "ipMasked": "203.***.***.42",
    "userAgent": "Mozilla/5.0 Chrome",
    "createdAt": 1785110400000,
    "updatedAt": 1785110400000,
}

SUMMARY = {
    "period": "Last 30 days",
    "totals": {"visitors": 1284, "page_views": 2918, "clicks": 346, "leads": 18, "allLeads": 42},
    "previous": {"visitors": 1002, "page_views": 2410, "clicks": 301, "leads": 12},
    "daily": [
        {"day": f"2026-07-{day:02d}", "visitors": 20 + (day * 7) % 53, "page_views": 60 + day, "clicks": 4 + day % 9}
        for day in range(1, 28)
    ],
    "markets": [
        {"country": "US", "visitors": 482, "events": 810},
        {"country": "CN", "visitors": 321, "events": 620},
        {"country": "DE", "visitors": 142, "events": 251},
        {"country": "GB", "visitors": 116, "events": 203},
    ],
    "sources": [
        {"source": "Direct", "visitors": 520},
        {"source": "linkedin", "visitors": 380},
        {"source": "https://google.com/", "visitors": 240},
    ],
    "devices": [
        {"device": "desktop", "visitors": 910},
        {"device": "mobile", "visitors": 310},
        {"device": "tablet", "visitors": 64},
    ],
    "recentLeads": [LEAD],
}


def api_route(route):
    path = route.request.url.split("5173", 1)[-1]
    if path.startswith("/api/admin/summary"):
        payload = SUMMARY
    elif path.startswith("/api/admin/leads"):
        payload = {"ok": True} if route.request.method == "PATCH" else {"leads": [LEAD]}
    elif path.startswith("/api/leads"):
        payload = {"ok": True, "id": "submitted-lead"}
    else:
        payload = {"ok": True}
    route.fulfill(status=201 if route.request.method == "POST" else 200, content_type="application/json", body=json.dumps(payload))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    )

    desktop = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    desktop.set_default_timeout(120000)
    desktop.route("**/api/**", api_route)
    errors = []
    desktop.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    desktop.goto("http://127.0.0.1:5173/", wait_until="networkidle", timeout=120000)
    assert "Capture Human Motion" in desktop.locator("h1").first.inner_text()
    desktop.get_by_role("link", name="Book a Demo").first.click()
    desktop.locator('input[name="name"]').fill("Kai Lin")
    desktop.locator('input[name="email"]').fill("lin@motionverse.ai")
    desktop.locator('input[name="organization"]').fill("Motionverse")
    desktop.locator('select[name="interest"]').select_option(index=1)
    desktop.locator('textarea[name="message"]').fill("Testing the production lead flow.")
    desktop.get_by_role("button", name="Request a Demo").click()
    desktop.get_by_text("Thank you. Your request is saved").wait_for()
    desktop.screenshot(path=str(ROOT / "screenshots" / "website-form-success.png"), full_page=False)

    desktop.goto("http://127.0.0.1:5173/admin", wait_until="networkidle", timeout=120000)
    assert desktop.get_by_role("heading", name="Website intelligence").is_visible()
    assert desktop.get_by_text("1,284").is_visible()
    desktop.screenshot(path=str(ROOT / "screenshots" / "admin-overview.png"), full_page=True)
    desktop.get_by_text("Test Lead", exact=True).click()
    assert desktop.get_by_label("Lead details for Test Lead").get_by_text("203.0.113.42", exact=True).is_visible()
    desktop.get_by_placeholder("Add follow-up context…").fill("Follow up next week.")
    desktop.get_by_role("button", name="Save changes").click()
    desktop.get_by_text("Saved", exact=True).wait_for()
    desktop.screenshot(path=str(ROOT / "screenshots" / "admin-dashboard.png"), full_page=False)
    assert not errors, f"Browser console errors: {errors}"

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile.set_default_timeout(120000)
    mobile.route("**/api/**", api_route)
    mobile.goto("http://127.0.0.1:5173/admin", wait_until="networkidle", timeout=120000)
    assert mobile.get_by_role("heading", name="Website intelligence").is_visible()
    mobile.screenshot(path=str(ROOT / "screenshots" / "admin-mobile.png"), full_page=True)

    browser.close()

print("UI smoke test passed: website form, admin dashboard, lead drawer, and mobile layout.")
