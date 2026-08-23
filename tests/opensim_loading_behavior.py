import time

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5174/"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def verify_desktop(browser):
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.set_default_navigation_timeout(120_000)
    errors = []
    opensim_requests = []
    page.on("console", lambda message: errors.append({"text": message.text, "location": message.location}) if message.type == "error" else None)
    page.on("request", lambda request: opensim_requests.append(request.url) if request.url.endswith("opensim-motion.json") else None)

    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=120_000)
    page.wait_for_load_state("networkidle", timeout=60_000)
    workspace = page.locator(".viewer-workspace")
    workspace.scroll_into_view_if_needed()
    page.locator(".viewer-switcher").wait_for(timeout=60_000)

    kinetic_tab = page.locator(".viewer-switcher button").nth(1)
    kinetic_tab.click()
    page.locator(".viewer-mode-layer.is-active .viewer-frame").wait_for(state="visible")
    preview_was_visible = page.locator(".viewer-mode-layer.is-active .opensim-preview").is_visible()
    page.frame_locator(".viewer-mode-layer.is-active iframe").locator(".app-shell").wait_for(state="attached", timeout=45_000)
    page.locator(".viewer-mode-layer.is-active .viewer-frame.is-ready").wait_for(timeout=45_000)

    page.locator(".viewer-switcher button").nth(0).click()
    page.wait_for_timeout(250)
    kinetic_tab.click()
    page.wait_for_timeout(500)

    assert page.locator(".viewer-mode-layer iframe").count() == 1
    assert len(opensim_requests) == 1, f"OpenSim reloaded {len(opensim_requests)} times"
    unexpected_errors = [error for error in errors if "/api/events" not in error["location"].get("url", "")]
    assert not unexpected_errors, unexpected_errors
    page.screenshot(path="/tmp/cerebel-opensim-desktop.png", full_page=False)
    page.close()
    return {"preview_visible": preview_was_visible, "opensim_requests": len(opensim_requests)}


def verify_mobile(browser):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        is_mobile=True,
        has_touch=True,
        device_scale_factor=2,
    )
    page = context.new_page()
    page.set_default_navigation_timeout(120_000)
    errors = []
    page.on("console", lambda message: errors.append({"text": message.text, "location": message.location}) if message.type == "error" else None)
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=120_000)
    page.wait_for_load_state("networkidle", timeout=60_000)
    page.locator(".viewer-workspace").scroll_into_view_if_needed()
    page.locator(".viewer-switcher").wait_for(timeout=60_000)
    page.locator(".viewer-switcher button").nth(1).click()
    page.frame_locator(".viewer-mode-layer.is-active iframe").locator(".app-shell").wait_for(state="attached", timeout=45_000)
    page.locator(".viewer-mode-layer.is-active .viewer-frame.is-ready").wait_for(timeout=45_000)
    unexpected_errors = [error for error in errors if "/api/events" not in error["location"].get("url", "")]
    assert not unexpected_errors, unexpected_errors
    page.screenshot(path="/tmp/cerebel-opensim-mobile.png", full_page=False)
    context.close()


with sync_playwright() as playwright:
    chromium = playwright.chromium.launch(headless=True, executable_path=CHROME)
    desktop_result = verify_desktop(chromium)
    verify_mobile(chromium)
    chromium.close()
    print(desktop_result)
