from pathlib import Path
from playwright.sync_api import sync_playwright


URL = "http://127.0.0.1:5174/"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def wait_for_particle(page):
    page.goto(URL, wait_until="domcontentloaded")
    page.locator(".particle-hero.is-ready").wait_for(state="attached", timeout=12_000)


def resource_report(page):
    return page.evaluate(
        """() => performance.getEntriesByType('resource')
          .filter((entry) => entry.name.includes('cerebel-') && (entry.name.endsWith('.glb') || entry.name.endsWith('.bin')))
          .map((entry) => ({ name: entry.name.split('/').pop(), bytes: entry.transferSize }))"""
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=CHROME)

    desktop_errors = []
    desktop = browser.new_page(viewport={"width": 1440, "height": 900})
    desktop.on("console", lambda message: desktop_errors.append(message.text) if message.type == "error" else None)
    wait_for_particle(desktop)
    surface = desktop.locator(".particle-hero__surface")
    box = surface.bounding_box()
    assert box is not None
    assert desktop.get_by_text("Sampling surface geometry", exact=False).count() == 0
    resources = resource_report(desktop)
    assert resources and all(item["name"].endswith("-points.bin") for item in resources), resources
    assert not any(item["name"].endswith(".glb") for item in resources), resources

    desktop.mouse.move(box["x"] + box["width"] * 0.72, box["y"] + box["height"] * 0.52)
    start_url = desktop.url
    initial_scale = desktop.evaluate("() => window.visualViewport?.scale || 1")
    desktop.keyboard.down("Control")
    desktop.mouse.wheel(0, -160)
    desktop.keyboard.up("Control")
    desktop.mouse.wheel(280, 0)
    surface.evaluate(
        """(element) => {
          const start = new Event('gesturestart', { bubbles: true, cancelable: true });
          const change = new Event('gesturechange', { bubbles: true, cancelable: true });
          Object.defineProperty(change, 'scale', { value: 1.18 });
          element.dispatchEvent(start);
          element.dispatchEvent(change);
          element.dispatchEvent(new Event('gestureend', { bubbles: true, cancelable: true }));
        }"""
    )
    desktop.wait_for_timeout(250)
    assert desktop.url == start_url
    assert desktop.evaluate("() => window.visualViewport?.scale || 1") == initial_scale
    desktop.mouse.down()
    desktop.mouse.move(box["x"] + box["width"] * 0.82, box["y"] + box["height"] * 0.42, steps=8)
    desktop.mouse.up()
    desktop.screenshot(path="/tmp/cerebel-particle-desktop.png")

    mobile_errors = []
    mobile_context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        is_mobile=True,
        has_touch=True,
    )
    mobile = mobile_context.new_page()
    mobile.on("console", lambda message: mobile_errors.append(message.text) if message.type == "error" else None)
    wait_for_particle(mobile)
    mobile_surface = mobile.locator(".particle-hero__surface")
    assert mobile_surface.locator("canvas").count() == 1
    assert mobile.locator(".particle-hero__prelude").count() == 0
    mobile_surface.scroll_into_view_if_needed()
    mobile.wait_for_timeout(200)
    mobile_box = mobile_surface.bounding_box()
    assert mobile_box is not None
    mobile.touchscreen.tap(mobile_box["x"] + mobile_box["width"] / 2, mobile_box["y"] + mobile_box["height"] / 2)
    mobile_surface.evaluate(
        """(element) => {
          const emit = (type, pointerId, x, y) => element.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerType: 'touch', pointerId, clientX: x, clientY: y
          }));
          emit('pointerdown', 11, 240, 390);
          emit('pointerdown', 12, 285, 390);
          emit('pointermove', 11, 220, 390);
          emit('pointermove', 12, 310, 390);
          emit('pointerup', 11, 220, 390);
          emit('pointerup', 12, 310, 390);
        }"""
    )
    assert mobile.evaluate("() => window.visualViewport?.scale || 1") == 1
    mobile.screenshot(path="/tmp/cerebel-particle-mobile.png", full_page=False)

    assert not desktop_errors, desktop_errors
    assert not mobile_errors, mobile_errors
    print({"desktop_resources": resources, "desktop_errors": desktop_errors, "mobile_errors": mobile_errors})
    mobile_context.close()
    browser.close()
