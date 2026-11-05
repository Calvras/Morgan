import os
import sys
import json
import re
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DATA_DIR = os.path.join(BASE_DIR, "data")

os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*'
}

def download_file(url, target_path):
    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        return target_path, True, "Already exists"
    
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
            with open(target_path, 'wb') as f:
                f.write(content)
        return target_path, True, f"Downloaded {len(content)} bytes"
    except Exception as e:
        return target_path, False, str(e)

print("--- Step 1: Downloading main HTML, JS, CSS, and base static files ---")
base_files = [
    ("https://morgangoods.com/", os.path.join(PUBLIC_DIR, "index.html")),
    ("https://morgangoods.com/assets/index-B7yQPykp.js", os.path.join(PUBLIC_DIR, "assets", "index-B7yQPykp.js")),
    ("https://morgangoods.com/assets/index-DreFGSOT.css", os.path.join(PUBLIC_DIR, "assets", "index-DreFGSOT.css")),
    ("https://morgangoods.com/logo.svg", os.path.join(PUBLIC_DIR, "logo.svg")),
    ("https://morgangoods.com/og-image-v2.jpg", os.path.join(PUBLIC_DIR, "og-image-v2.jpg")),
    ("https://morgangoods.com/robots.txt", os.path.join(PUBLIC_DIR, "robots.txt")),
    ("https://morgangoods.com/sitemap.xml", os.path.join(PUBLIC_DIR, "sitemap.xml")),
]

for url, dest in base_files:
    p, success, msg = download_file(url, dest)
    print(f"[{'OK' if success else 'FAIL'}] {url} -> {os.path.relpath(dest, BASE_DIR)}: {msg}")

print("\n--- Step 2: Fetching API data ---")
api_endpoints = {
    '/api/categories': 'api_categories.json',
    '/api/products': 'api_products.json',
    '/api/wholesale/categories': 'api_wholesale_categories.json',
    '/api/wholesale/products': 'api_wholesale_products.json',
    '/api/combos': 'api_combos.json'
}

for ep, filename in api_endpoints.items():
    dest = os.path.join(DATA_DIR, filename)
    url = f"https://morgangoods.com{ep}"
    p, success, msg = download_file(url, dest)
    print(f"[{'OK' if success else 'FAIL'}] {ep} -> {filename}: {msg}")

print("\n--- Step 3: Collecting all images ---")
images_to_download = []

# Category images from JS
cat_images = [
    "/categories/blenders-juicers.jpg",
    "/categories/cctv-cameras.jpg",
    "/categories/fufu-machine.jpg",
    "/categories/grills-toasters.jpg",
    "/categories/rice-cookers.jpg"
]
for cat_img in cat_images:
    url = f"https://morgangoods.com{cat_img}"
    dest = os.path.join(PUBLIC_DIR, cat_img.lstrip("/"))
    images_to_download.append((url, dest))

# Products and Wholesale Products
for fname in ['api_products.json', 'api_wholesale_products.json']:
    fpath = os.path.join(DATA_DIR, fname)
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            items = json.load(f)
            for item in items:
                for img in item.get('images', []):
                    if img.startswith('http'):
                        # External image
                        url = img
                        # Store in public/external-images/<hash or cleaned path>
                        # e.g., preserve path after host
                        clean_path = re.sub(r'^https?://[^/]+/', '', img)
                        dest = os.path.join(PUBLIC_DIR, "external", clean_path)
                        images_to_download.append((url, dest))
                    elif img.startswith('/'):
                        url = f"https://morgangoods.com{img}"
                        dest = os.path.join(PUBLIC_DIR, img.lstrip("/"))
                        images_to_download.append((url, dest))

# JS images
with open(os.path.join(PUBLIC_DIR, "assets", "index-B7yQPykp.js"), 'r', encoding='utf-8') as f:
    js_content = f.read()
    js_img_matches = re.findall(r'["\'`](/[a-zA-Z0-9_\-\./]+\.(?:png|jpg|jpeg|webp|svg|gif))["\'`]', js_content)
    for m in js_img_matches:
        url = f"https://morgangoods.com{m}"
        dest = os.path.join(PUBLIC_DIR, m.lstrip("/"))
        images_to_download.append((url, dest))

# Deduplicate by destination
unique_downloads = {}
for u, d in images_to_download:
    unique_downloads[d] = u

print(f"Total unique images to verify/download: {len(unique_downloads)}")

success_count = 0
failed_list = []

with ThreadPoolExecutor(max_workers=10) as executor:
    future_to_file = {executor.submit(download_file, url, dest): (url, dest) for dest, url in unique_downloads.items()}
    for future in as_completed(future_to_file):
        url, dest = future_to_file[future]
        try:
            target_path, ok, info = future.result()
            if ok:
                success_count += 1
            else:
                failed_list.append((url, info))
        except Exception as e:
            failed_list.append((url, str(e)))

print(f"\nDownload finished: {success_count} succeeded, {len(failed_list)} failed.")
if failed_list:
    print(f"Failed count: {len(failed_list)}")
    for u, err in failed_list[:10]:
        print(f" - {u} : {err}")
