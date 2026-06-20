#!/usr/bin/env python3
"""
BStock Analytics - Runner principal
Ejecuta captura + analítica en un solo comando
Uso: python run.py MARTES  |  python run.py JUEVES
"""
import sys
from captura import BStockCaptura
from analitica import generar_reporte_json
from config import LISTING_IDS


def main():
    dia = sys.argv[1].upper() if len(sys.argv) >= 2 else "MARTES"
    if dia not in ("MARTES", "JUEVES"):
        print("Uso: python run.py MARTES  |  python run.py JUEVES")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  BStock Analytics — Captura {dia}")
    print(f"{'='*60}\n")

    # 1. Capturar
    captura = BStockCaptura()
    resultados = captura.capturar(LISTING_IDS, dia)

    # 2. Generar analítica
    print("\n📊 Generando análisis...")
    reporte = generar_reporte_json()

    # 3. Resumen en consola
    print(f"\n{'='*60}")
    print(f"  RESUMEN FINAL")
    print(f"{'='*60}")
    print(f"  Lotes capturados : {len(resultados)}/{len(LISTING_IDS)}")

    alertas = reporte.get("alertas", [])
    buenos = [a for a in alertas if a["nivel"] == "BUEN_PRECIO"]
    altos  = [a for a in alertas if a["nivel"] == "PRECIO_ALTO"]

    if buenos:
        print(f"\n  🟢 BUENOS PRECIOS HOY ({len(buenos)}):")
        for a in buenos[:5]:
            print(f"     {a['modelo']}: ${a['ultimo_precio']:,.0f}/u "
                  f"(vs avg ${a['promedio_historico']:,.0f}, {a['cambio_pct']:+.1f}%)")

    if altos:
        print(f"\n  🔴 PRECIOS ALTOS HOY ({len(altos)}):")
        for a in altos[:5]:
            print(f"     {a['modelo']}: ${a['ultimo_precio']:,.0f}/u "
                  f"(vs avg ${a['promedio_historico']:,.0f}, {a['cambio_pct']:+.1f}%)")

    print(f"\n  📁 Abre dashboard.html en tu navegador para ver todo")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
