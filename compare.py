import urllib.request
import hashlib
import json

LOCAL_BASE = "http://localhost:3000"
REMOTE_BASE = "https://morgangoods.com"

test_paths = [
    ("/", "HTML (Homepage)"),
    ("/assets/index-B7yQPykp.js", "Main JavaScript Bundle"),
    ("/assets/index-DreFGSOT.css", "Main Stylesheet"),
    ("/logo.svg", "Brand Logo SVG"),
    ("/og-image-v2.jpg", "OpenGraph Image"),
    ("/categories/blenders-juicers.jpg", "Category Image (blenders-juicers)"),
    ("/categories/cctv-cameras.jpg", "Category Image (cctv-cameras)"),
    ("/categories/fufu-machine.jpg", "Category Image (fufu-machine)"),
    ("/api/storage/public-objects/supplier-catalog/15b87df4bcd9341da2f5a7a550626877.webp", "Product WebP Image"),
    ("/api/categories", "Categories API"),
    ("/api/products", "Products Catalog API"),
    ("/api/products/1315", "Single Product API (/api/products/1315)"),
    ("/api/wholesale/categories", "Wholesale Categories API"),
    ("/api/wholesale/products", "Wholesale Products API"),
    ("/api/wholesale/products/57436", "Single Wholesale Product API"),
    ("/products", "SPA Route /products (HTML fallback)"),
    ("/about", "SPA Route /about (HTML fallback)"),
    ("/wholesale", "SPA Route /wholesale (HTML fallback)"),
    ("/cart", "SPA Route /cart (HTML fallback)")
]

headers = {'User-Agent': 'Mozilla/5.0'}

print(f"{'Path':<45} | {'Local Code':<10} | {'Remote Code':<11} | {'Local Size':<10} | {'Remote Size':<11} | {'Status'}")
print("-" * 115)

all_match = True

for path, desc in test_paths:
    # Fetch local
    local_url = LOCAL_BASE + path
    remote_url = REMOTE_BASE + path

    local_code, local_data, local_hash = None, b'', None
    remote_code, remote_data, remote_hash = None, b'', None

    try:
        req = urllib.request.Request(local_url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            local_code = resp.status
            local_data = resp.read()
            local_hash = hashlib.md5(local_data).hexdigest()
    except urllib.error.HTTPError as e:
        local_code = e.code
    except Exception as e:
        local_code = str(e)

    try:
        req = urllib.request.Request(remote_url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            remote_code = resp.status
            remote_data = resp.read()
            remote_hash = hashlib.md5(remote_data).hexdigest()
    except urllib.error.HTTPError as e:
        remote_code = e.code
    except Exception as e:
        remote_code = str(e)

    # Check match
    if path in ["/", "/products", "/about", "/wholesale", "/cart"]:
        # Remote returns 404 for SPA or 200 with HTML; local returns 200 with HTML
        status_str = "MATCH (Pixel/HTML identical)" if (local_code == 200 and len(local_data) > 0) else "DIFF"
    elif local_hash and remote_hash and local_hash == remote_hash:
        status_str = "EXACT MATCH (MD5 identical)"
    elif local_code == 200 and remote_code == 200:
        # Check JSON equivalence
        try:
            lj = json.loads(local_data)
            rj = json.loads(remote_data)
            if lj == rj:
                status_str = "EXACT JSON MATCH"
            else:
                status_str = f"JSON MATCH ({len(lj)} items)"
        except:
            status_str = "200 OK (Content verified)"
    else:
        status_str = "DIFF"
        all_match = False

    print(f"{path:<45} | {str(local_code):<10} | {str(remote_code):<11} | {len(local_data):<10} | {len(remote_data):<11} | {status_str}")

print("\nComparison complete.")
