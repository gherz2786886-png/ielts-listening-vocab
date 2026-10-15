# -*- coding: utf-8 -*-
import pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab")
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.on("console", lambda m: print("CONSOLE", m.type, m.text))
    pg.on("pageerror", lambda e: print("PAGEERROR", e))
    pg.goto((ROOT / "index.html").as_uri())
    pg.wait_for_timeout(1500)
    print("URL:", pg.url)
    print("title:", pg.title())
    body = pg.locator("body").inner_html()
    print("BODY len:", len(body))
    print(body[:1500])
    pg.screenshot(path=r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab\qa\qa_shots\debug_learn.png")
    b.close()
