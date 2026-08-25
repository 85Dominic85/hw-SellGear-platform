"""
Convierte las imagenes del catalogo comercial web (repo hw-qamarero-catalog)
a los assets de la app: WebP q=88, max 1200px de lado largo, alpha preservado.

Uso, desde la raiz del repo:
    python scripts/import-catalog-images.py <ruta-al-repo-catalogo>

El repo de catalogo es qamarero/hw-qamarero-catalog. Reejecutalo cuando alli
cambien las fotos: es idempotente y sobreescribe las salidas.

Origen : <repo>/public/products/<nombre-versionado>
Destino: apps/web/public/products/<products.code>.webp

Se usa q=88 (y no 75) porque el optimizador de next/image reencoda a 75:
partir de una fuente ya muy comprimida produce doble perdida visible en los
degradados de las carcasas.
"""
import sys
from pathlib import Path
from PIL import Image

MAX_SIDE = 1200
QUALITY = 88

# origen (fichero en <repo>/public/products/) -> destino (products.code)
MAPPING = {
    # --- Packs ---
    "pack-essential-v5.webp":       "pack-esencial",
    "pack-basic-v9.webp":           "pack-basic",
    "pack-pro-v9.webp":             "pack-pro",
    "pack-premium-v6.webp":         "pack-premium",
    "pack-cocina-digital-v8.webp":  "pack-cocina-digital",
    # --- TPV ---
    "tpv-standard-v3.webp":         "tpv-estandar",
    "tpv-pro-v3.png":               "tpv-pro",
    "tpv-premium.webp":             "tpv-premium",
    # --- KDS ---
    "kds-tablet-lenovo-v2.png":     "tablet-kds-lenovo",
    "kds-android-22-v2.png":        "kds-estandar",
    "kds-pro-v2.png":               "kds-pro",
    "kds-premium-v2.webp":          "kds-premium",
    # --- Impresoras ---
    "printer-usblan.webp":          "printer-cable",
    "printer-wifi.png":             "printer-wifi",
    "printer-tp808.png":            "printer-tp808-wifi",
    "printer-kitchen.png":          "printer-cocina-usb-lan",
    # --- Perifericos ---
    "cash-drawer.png":              "cajon",
    "scale-minerva.png":            "bascula-minerva-15",
    "pagers-posiflex.png":          "avisadores-10pos",
    "pagers-approx.png":            "avisadores-aqprox",
    # --- Red ---
    "router-flint.png":             "router-flint",
    "router-opal.png":              "router-opal",
}

# Canarias: varios reutilizan la misma foto que su equivalente peninsular.
MAPPING_CANARIAS = {
    "pack-basic-canarias-v2.webp":   "pack-basic-canarias",
    "pack-pro-canarias-v2.webp":     "pack-pro-canarias",
    "pack-premium-canarias-v2.webp": "pack-premium-canarias",
    "tpv-pro-v3.png":                "tpv-pro-canarias",
    "kds-premium-v2.webp":           "kds-canarias",
    "printer-usblan.webp":           "printer-cable-canarias",
    "printer-wifi-canarias.webp":    "printer-wifi-canarias",
    "cash-drawer.png":               "cajon-canarias",
}

# Modelos alternativos del TPV Pro -> subcarpeta models/
MAPPING_MODELS = {
    "tpv-pro-apptpv05-v3.webp": "tpv-pro-apptpv05",
    "tpv-pro-10pos-v3.webp":    "tpv-pro-10pos",
}

# Copia literal, sin reencodar (vectorial).
COPY_AS_IS = {"kds-pending.svg": "_pending.svg"}


def convert(src: Path, dest: Path) -> tuple[int, int, str]:
    with Image.open(src) as im:
        im.load()
        # Normaliza a RGBA para no perder el recorte sobre alpha.
        if im.mode not in ("RGBA", "LA"):
            im = im.convert("RGBA")
        w, h = im.size
        if max(w, h) > MAX_SIDE:
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "WEBP", quality=QUALITY, method=6)
        return w, h, f"{im.size[0]}x{im.size[1]}"


def main() -> int:
    if len(sys.argv) < 2:
        print("uso: python .tmp-catalog-images.py <ruta-al-repo-catalogo>")
        return 2

    src_dir = Path(sys.argv[1]) / "public" / "products"
    dest_dir = Path("apps/web/public/products")
    if not src_dir.is_dir():
        print(f"ERROR: no existe {src_dir}")
        return 1

    # OJO: no fusionar los dicts con {**A, **B}: varias fotos se reutilizan
    # entre peninsula y Canarias (tpv-pro-v3.png, kds-premium-v2.webp,
    # printer-usblan.webp, cash-drawer.png) y la clave duplicada se perderia.
    jobs: list[tuple[str, Path]] = []
    for mapping in (MAPPING, MAPPING_CANARIAS):
        for name, code in mapping.items():
            jobs.append((name, dest_dir / f"{code}.webp"))
    for name, code in MAPPING_MODELS.items():
        jobs.append((name, dest_dir / "models" / f"{code}.webp"))

    total_in = total_out = 0
    missing: list[str] = []

    for name, dest in jobs:
        src = src_dir / name
        if not src.is_file():
            missing.append(name)
            continue
        size_in = src.stat().st_size
        w, h, out_dims = convert(src, dest)
        size_out = dest.stat().st_size
        total_in += size_in
        total_out += size_out
        flag = " (redim.)" if out_dims != f"{w}x{h}" else ""
        print(f"  {name:32s} -> {dest.name:30s} "
              f"{size_in/1024:8.1f} KB -> {size_out/1024:7.1f} KB  {out_dims}{flag}")

    for name, out_name in COPY_AS_IS.items():
        src = src_dir / name
        if not src.is_file():
            missing.append(name)
            continue
        dest = dest_dir / out_name
        dest.write_bytes(src.read_bytes())
        total_in += src.stat().st_size
        total_out += dest.stat().st_size
        print(f"  {name:32s} -> {dest.name:30s} (copia literal)")

    brand_src = Path(sys.argv[1]) / "public" / "brand"
    brand_dest = Path("apps/web/public/brand")
    if brand_src.is_dir():
        brand_dest.mkdir(parents=True, exist_ok=True)
        for svg in sorted(brand_src.glob("*.svg")):
            (brand_dest / svg.name).write_bytes(svg.read_bytes())
            print(f"  brand/{svg.name:26s} -> brand/{svg.name}")

    print()
    print(f"  {len(jobs) + len(COPY_AS_IS) - len(missing)} ficheros")
    print(f"  {total_in/1024/1024:.2f} MB -> {total_out/1024/1024:.2f} MB "
          f"({100 - total_out/total_in*100:.0f}% menos)")
    if missing:
        print(f"  FALTAN EN ORIGEN: {', '.join(missing)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
