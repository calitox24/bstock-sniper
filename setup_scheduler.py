#!/usr/bin/env python3
"""
Configura las tareas automáticas en Windows Task Scheduler.
Ejecutar UNA SOLA VEZ como administrador:
  python setup_scheduler.py

Crea dos tareas:
  - BStock_Inicio : Lun-Vie 9:00am  → pipeline.py inicio
  - BStock_Cierre : Lun-Vie 6:30pm  → pipeline.py cierre
"""
import subprocess
import sys
import os

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON = sys.executable
PIPELINE = os.path.join(PROJECT_DIR, "pipeline.py")


def crear_tarea(nombre, hora, fase):
    cmd = [
        "schtasks", "/create", "/f",
        "/tn", nombre,
        "/tr", f'"{PYTHON}" "{PIPELINE}" {fase}',
        "/sc", "WEEKLY",
        "/d", "MON,TUE,WED,THU,FRI",
        "/st", hora,
        "/sd", "01/01/2026",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✅ Tarea '{nombre}' creada → {hora} Lun-Vie")
    else:
        print(f"❌ Error creando '{nombre}': {result.stderr.strip()}")
        print(f"   Intentá correr este script como Administrador")


def eliminar_tarea(nombre):
    subprocess.run(["schtasks", "/delete", "/f", "/tn", nombre],
                   capture_output=True)


if __name__ == "__main__":
    print("\nConfigurando BStock Scheduler en Windows...\n")
    print(f"  Python  : {PYTHON}")
    print(f"  Pipeline: {PIPELINE}\n")

    # Eliminar si ya existían
    eliminar_tarea("BStock_Inicio")
    eliminar_tarea("BStock_Cierre")

    # Crear nuevas
    crear_tarea("BStock_Inicio", "09:00", "inicio")
    crear_tarea("BStock_Cierre", "18:30", "cierre")

    print("\nListo. Podés verificar en:")
    print("  Inicio → Programador de tareas → Biblioteca de Tareas")
    print("  Buscar: BStock_Inicio y BStock_Cierre\n")
